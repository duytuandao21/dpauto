import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { migrate } from "../scripts/migrate";
import { bootstrap } from "../scripts/bootstrap";
import { loadConfig } from "../src/config";
import { createApp } from "../src/app";
import { sql, one, rows } from "../src/database";
import { slotId, slotWindows } from "../src/capacity/capacity";

const url = process.env.DP_TEST_DATABASE_URL;
if (!url || !url.includes("dpauto_test@127.0.0.1:"))
  throw Error("Use the isolated booking test runner.");
const config = {
  ...loadConfig({
    DATABASE_URL: url,
    APP_ORIGIN: "http://localhost:4001",
    API_SECRET: "booking-slots-isolated-secret-".repeat(3),
    NODE_ENV: "test",
  }),
  now: () => new Date("2026-11-13T00:00:00Z"),
};
let app: Awaited<ReturnType<typeof createApp>>["app"],
  api: Awaited<ReturnType<typeof createApp>>["api"];
let seq = 0,
  phone = 0,
  service: string,
  advisor: string;
const initialPassword = "Temporary slots password 123!",
  password = "Changed slots password 456!";
class Client {
  cookie = "";
  csrf = "";
  async call(
    method: string,
    path: string,
    payload?: unknown,
    key = randomUUID(),
  ) {
    const response = await app.inject({
      method: method as any,
      url: "/api/v1/" + path,
      remoteAddress:
        "127.1." + Math.floor(++seq / 200) + "." + ((seq % 200) + 1),
      headers: {
        origin: config.origin,
        ...(this.cookie ? { cookie: this.cookie } : {}),
        ...(method !== "GET"
          ? {
              "content-type": "application/json",
              "x-csrf-token": this.csrf,
              "idempotency-key": key,
            }
          : {}),
      },
      ...(payload !== undefined ? { payload: JSON.stringify(payload) } : {}),
    });
    const set = response.headers["set-cookie"];
    if (set)
      this.cookie = String(Array.isArray(set) ? set[0] : set).split(";")[0];
    const body = response.body ? JSON.parse(response.body) : {};
    if (body.data?.csrfToken) this.csrf = body.data.csrfToken;
    return { status: response.statusCode, body };
  }
  async login(email: string, pw = initialPassword) {
    await this.call("GET", "admin/auth/csrf");
    const r = await this.call("POST", "admin/auth/login", {
      email,
      password: pw,
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
  }
}
const manager = new Client(),
  guest = new Client();
const expect = (r: any, status: number) => {
  assert.equal(r.status, status, JSON.stringify(r.body));
  return r.body.data;
};
async function versions() {
  const s = (await one(
    api.db.db,
    sql`SELECT * FROM stations WHERE code=${config.stationCode}`,
  ))!;
  return {
    catalogVersion: s.catalog_version,
    policyVersion: s.configuration_version,
  };
}
async function payload(date: string, time = "08:30") {
  return {
    customer: {
      name: "Khách hàng",
      phone: "0900" + String(++phone).padStart(6, "0"),
    },
    serviceIds: [service],
    requestedDate: date,
    requestedPeriod: time < "12:00" ? "MORNING" : "AFTERNOON",
    catalogVersion: (await versions()).catalogVersion,
    notice: {
      privacyNoticeVersion: "BOOKING_V1",
      privacyNoticeAcknowledged: true,
    },
  };
}
async function book(date: string, time = "08:30") {
  return expect(
    await guest.call("POST", "public/bookings", await payload(date, time)),
    201,
  );
}
async function calendar(date: string) {
  return expect(
    await manager.call(
      "GET",
      `admin/capacity/calendar?from=${date}&to=${date}`,
    ),
    200,
  ).buckets;
}
async function confirm(id: string, time: string) {
  const assigned = expect(
    await manager.call("POST", `admin/bookings/${id}/assign`, {
      expectedVersion: 1,
      reason: "Phân công cố vấn",
      advisorId: advisor,
    }),
    200,
  );
  return expect(
    await manager.call("POST", `admin/bookings/${id}/confirm`, {
      expectedVersion: assigned.version,
      reason: "Khách đồng ý",
      customerAgreed: true,
      confirmedStartAt: time,
    }),
    200,
  );
}
before(async () => {
  await migrate(url!);
  ({ app, api } = await createApp(config));
  await bootstrap(api.db, config, {
    name: "Quản lý",
    email: "manager@example.test",
    password: initialPassword,
    phone: "0901234567",
    stationName: "Toàn Trung",
    address: "Hồ Chí Minh",
    directionsUrl: "https://maps.app.goo.gl/test",
  });
  await manager.login("manager@example.test");
  expect(
    await manager.call("POST", "admin/auth/change-password", {
      currentPassword: initialPassword,
      newPassword: password,
    }),
    200,
  );
  advisor = expect(
    await manager.call("POST", "admin/staff", {
      name: "Cố vấn",
      phone: "0901234568",
      email: "advisor@example.test",
      jobRole: "ADVISOR",
      active: true,
      account: {
        email: "advisor@example.test",
        temporaryPassword: initialPassword,
        role: "ADVISOR",
        permissions: [],
      },
    }),
    201,
  ).id;
  const advisorClient = new Client();
  await advisorClient.login("advisor@example.test");
  expect(
    await advisorClient.call("POST", "admin/auth/change-password", {
      currentPassword: initialPassword,
      newPassword: password,
    }),
    200,
  );
  service = expect(
    await guest.call("GET", "public/services"),
    200,
  ).services.find((s: any) => s.code === "RUA_XE").id;
});
after(async () => {
  if (app) await app.close();
});

test("default hours and catalog work without any resource configuration", async () => {
  const policy = expect(
    await manager.call("GET", "admin/capacity/policy"),
    200,
  );
  assert.equal(policy.slotMinutes, 60);
  assert.equal(policy.maxBookingsPerSlot, 5);
  assert.equal(policy.hours.length, 7);
  const catalog = expect(await guest.call("GET", "public/services"), 200);
  assert.ok(catalog.services.length >= 11);
  const resources = await one(
    api.db.db,
    sql`SELECT count(*)::int AS n FROM resource_units`,
  );
  assert.equal(resources!.n, 0);
  const windows = slotWindows("2026-11-20", policy.hours, 60);
  assert.equal(windows.length, 10);
  assert.equal(
    new Date(windows[0].start).toISOString(),
    "2026-11-20T00:30:00.000Z",
  );
  assert.equal(
    new Date(windows.at(-1)!.end).toISOString(),
    "2026-11-20T10:30:00.000Z",
  );
  assert.ok(
    z.uuid().safeParse(slotId(policy.stationId, windows[0].start)).success,
  );
  const created = expect(
    await manager.call("POST", "admin/services", {
      code: "NEW_SERVICE",
      name: "Dịch vụ mới",
      categoryCode: "OTHER",
      active: true,
      bookable: true,
      sortOrder: 999,
      estimatedDurationMinutes: 120,
    }),
    201,
  );
  assert.ok(created.id);
});

test("customers request a day + period only: unlimited, nothing held, pending until an advisor confirms", async () => {
  const open = expect(
    await guest.call("GET", "public/availability?date=2026-11-20"),
    200,
  );
  assert.deepEqual(
    open.periods.map((p: any) => [p.period, p.status]),
    [
      ["MORNING", "AVAILABLE"],
      ["AFTERNOON", "AVAILABLE"],
    ],
  );
  const past = expect(
    await guest.call("GET", "public/availability?date=2026-11-12"),
    200,
  );
  assert.ok(past.periods.every((p: any) => p.status === "UNAVAILABLE"));
  // More requests than the old per-slot limit (5) are all accepted.
  const requests = await Promise.all(
    Array.from({ length: 7 }, () => payload("2026-11-20")),
  );
  const keys = requests.map(() => randomUUID());
  const responses = await Promise.all(
    requests.map((p, i) => guest.call("POST", "public/bookings", p, keys[i])),
  );
  assert.equal(responses.filter((r) => r.status === 201).length, 7);
  const replay = expect(
    await guest.call("POST", "public/bookings", requests[0], keys[0]),
    201,
  );
  assert.equal(replay.bookingId, responses[0].body.data.bookingId);
  assert.equal(replay.status, "PENDING");
  assert.equal(replay.requestedPeriod, "MORNING");
  const stored = expect(
    await manager.call("GET", "admin/bookings/" + replay.bookingId),
    200,
  );
  assert.equal(stored.requestedPeriod, "MORNING");
  assert.equal(stored.scheduledStartAt, "2026-11-20T00:30:00.000Z");
  assert.equal(stored.confirmedStartAt, null);
  const slot = (await calendar("2026-11-20")).find(
    (s: any) => s.startAt === "2026-11-20T00:30:00.000Z",
  );
  assert.equal(slot.pendingCount, 7);
  assert.equal(slot.confirmedCount, 0);
  assert.equal(slot.freeUnits, 5);
  const afternoon = expect(
    await guest.call(
      "POST",
      "public/bookings",
      await payload("2026-11-20", "14:00"),
    ),
    201,
  );
  assert.equal(
    expect(
      await manager.call("GET", "admin/bookings/" + afternoon.bookingId),
      200,
    ).scheduledStartAt,
    "2026-11-20T05:30:00.000Z",
  );
  // An exact time from the customer is no longer accepted.
  const exact = await guest.call("POST", "public/bookings", {
    ...(await payload("2026-11-20")),
    requestedStartAt: "2026-11-20T08:30:00+07:00",
  });
  assert.equal(exact.status, 400);
});

test("advisor sets the official time; overload and same-time conflicts warn but never block; cancel and reschedule", async () => {
  for (let i = 0; i < 6; i++) await book("2026-11-25");
  const list = expect(
    await manager.call(
      "GET",
      "admin/bookings?from=2026-11-25&to=2026-11-25&limit=20",
    ),
    200,
  );
  assert.equal(list.length, 6);
  const receipts = [];
  // Off-grid exact time (09:00 inside the 08:30 slot) is allowed.
  for (const b of list)
    receipts.push(await confirm(b.id, "2026-11-25T09:00:00+07:00"));
  assert.ok(receipts.every((r) => r.status === "CONFIRMED"));
  assert.equal(receipts[0].confirmedStartAt, "2026-11-25T02:00:00.000Z");
  assert.deepEqual(receipts[0].warnings, []);
  assert.ok(receipts[1].warnings.includes("ADVISOR_TIME_CONFLICT"));
  assert.ok(receipts[5].warnings.includes("SLOT_OVERLOADED"));
  let slot = (await calendar("2026-11-25")).find(
    (s: any) => s.startAt === "2026-11-25T01:30:00.000Z",
  );
  assert.equal(slot.confirmedCount, 6);
  assert.equal(slot.pendingCount, 0);
  assert.equal(slot.freeUnits, 0);
  const key = randomUUID(),
    input = { expectedVersion: 3, reason: "Khách hủy lịch" };
  expect(
    await manager.call(
      "POST",
      `admin/bookings/${list[0].id}/cancel`,
      input,
      key,
    ),
    200,
  );
  expect(
    await manager.call(
      "POST",
      `admin/bookings/${list[0].id}/cancel`,
      input,
      key,
    ),
    200,
  );
  slot = (await calendar("2026-11-25")).find(
    (s: any) => s.startAt === slot.startAt,
  );
  assert.equal(slot.confirmedCount, 5);
  // Still pending: move to another day and period agreed with the customer.
  const source = await book("2026-11-26");
  const movedPeriod = expect(
    await manager.call(
      "POST",
      `admin/bookings/${source.bookingId}/reschedule`,
      {
        expectedVersion: 1,
        reason: "Khách đổi sang chiều hôm sau",
        customerAgreed: true,
        requestedDate: "2026-11-27",
        requestedPeriod: "AFTERNOON",
      },
    ),
    200,
  );
  assert.equal(movedPeriod.status, "PENDING");
  assert.equal(movedPeriod.requestedPeriod, "AFTERNOON");
  assert.equal(movedPeriod.scheduledStartAt, "2026-11-27T05:30:00.000Z");
  // Period changes are only for pending requests.
  const confirmedPeriod = await manager.call(
    "POST",
    `admin/bookings/${list[1].id}/reschedule`,
    {
      expectedVersion: 3,
      reason: "Đổi buổi",
      customerAgreed: true,
      requestedDate: "2026-11-27",
      requestedPeriod: "MORNING",
    },
  );
  assert.equal(confirmedPeriod.status, 409);
  assert.equal(confirmedPeriod.body.error.code, "INVALID_TRANSITION");
  // A confirmed booking moved into a full slot is saved, with a warning.
  const other = await book("2026-11-26");
  await confirm(other.bookingId, "2026-11-26T10:00:00+07:00");
  const moved = expect(
    await manager.call("POST", `admin/bookings/${other.bookingId}/reschedule`, {
      expectedVersion: 3,
      reason: "Đổi giờ theo khách",
      customerAgreed: true,
      newStartAt: "2026-11-25T09:15:00+07:00",
      policyVersion: (await versions()).policyVersion,
    }),
    200,
  );
  assert.equal(moved.scheduledStartAt, "2026-11-25T02:15:00.000Z");
  assert.ok(moved.warnings.includes("SLOT_OVERLOADED"));
  // Giving a pending request an exact time clears its period.
  const exact = expect(
    await manager.call(
      "POST",
      `admin/bookings/${source.bookingId}/reschedule`,
      {
        expectedVersion: movedPeriod.version,
        reason: "Hẹn giờ cụ thể",
        customerAgreed: true,
        newStartAt: "2026-11-27T14:00:00+07:00",
        policyVersion: (await versions()).policyVersion,
      },
    ),
    200,
  );
  assert.equal(exact.requestedPeriod, null);
  const neither = await manager.call(
    "POST",
    `admin/bookings/${source.bookingId}/reschedule`,
    { expectedVersion: exact.version, reason: "Thiếu", customerAgreed: true },
  );
  assert.equal(neither.status, 400);
});

test("receiving a booked car keeps its original place; walk-in intake has no resource prerequisite", async () => {
  const b = await book("2026-11-22");
  await confirm(b.bookingId, "2026-11-22T08:30:00+07:00");
  const intake = {
    request: "Kiểm tra xe",
    odometer: 12000,
    conditions: { operation: [] },
    receptionNote: "Tiếp nhận",
    photos: [],
  };
  const received = await manager.call(
    "POST",
    `admin/bookings/${b.bookingId}/receive`,
    {
      expectedVersion: 3,
      policyVersion: (await versions()).policyVersion,
      vehicle: { model: "Toyota Vios", plate: "51A12345" },
      vehicleChangeReason: "Bổ sung xe",
      vehicleVerified: true,
      intake,
    },
  );
  expect(received, 201);
  const slot = (await calendar("2026-11-22")).find(
    (s: any) => s.heldUnits === 1,
  );
  assert.equal(slot.confirmedCount, 1);
  // Closed visits still count as admitted appointments, independent of reservation release.
  await api.db.db.execute(
    sql`UPDATE bookings SET status='COMPLETED' WHERE id=${b.bookingId}`,
  );
  assert.equal(
    (await calendar("2026-11-22")).find((s: any) => s.id === slot.id).heldUnits,
    1,
  );
  const walkin = await manager.call("POST", "admin/service-visits", {
    customer: { name: "Khách đến trực tiếp", phone: "0909999999" },
    vehicle: { model: "Kia", plate: "51B23456" },
    vehicleVerified: true,
    advisorId: advisor,
    serviceIds: [service],
    ...(await versions()),
    notice: {
      privacyNoticeVersion: "BOOKING_V1",
      privacyNoticeAcknowledged: true,
    },
    intake,
  });
  expect(walkin, 201);
});

test("slot/day closures keep bookings; reopening and validation use the new settings", async () => {
  const date = "2026-11-23",
    b = await book(date),
    slot = (await calendar(date)).find((s: any) => s.heldUnits === 1);
  const closed = expect(
    await manager.call("PATCH", "admin/capacity/buckets/" + slot.id, {
      expectedVersion: slot.version,
      startAt: slot.startAt,
      reason: "Tạm đóng",
      closed: true,
    }),
    200,
  );
  // A closed slot no longer rejects the morning; the request lands on the next open slot.
  const shifted = expect(
    await guest.call("POST", "public/bookings", await payload(date)),
    201,
  );
  assert.equal(
    expect(
      await manager.call("GET", "admin/bookings/" + shifted.bookingId),
      200,
    ).scheduledStartAt,
    "2026-11-23T01:30:00.000Z",
  );
  assert.equal(
    (await calendar(date)).find((s: any) => s.id === slot.id).heldUnits,
    1,
  );
  expect(
    await manager.call("PATCH", "admin/capacity/buckets/" + slot.id, {
      expectedVersion: closed.version,
      startAt: slot.startAt,
      reason: "Mở lại",
      closed: false,
    }),
    200,
  );
  const block = expect(
    await manager.call("POST", "admin/capacity/blocks", {
      startsAt: date + "T00:00:00+07:00",
      endsAt: date + "T23:59:59+07:00",
      reason: "Nghỉ",
      kind: "HOLIDAY",
    }),
    201,
  );
  assert.ok((await calendar(date)).every((s: any) => s.closed));
  const closedDay = await guest.call(
    "POST",
    "public/bookings",
    await payload(date, "14:00"),
  );
  assert.equal(closedDay.status, 422);
  assert.equal(closedDay.body.error.code, "PERIOD_UNAVAILABLE");
  assert.ok(
    expect(
      await guest.call("GET", "public/availability?date=" + date),
      200,
    ).periods.every((p: any) => p.status === "UNAVAILABLE"),
  );
  expect(
    await manager.call("DELETE", "admin/capacity/blocks/" + block.id, {
      expectedVersion: block.version,
      reason: "Mở lại ngày",
    }),
    204,
  );
  // Pending requests do not consume the slot.
  assert.equal(
    (await calendar(date)).find((s: any) => s.id === slot.id).freeUnits,
    5,
  );
  const p = expect(await manager.call("GET", "admin/capacity/policy"), 200);
  const invalid = await manager.call("PUT", "admin/capacity/policy", {
    expectedVersion: p.configurationVersion,
    reason: "Sai giờ",
    bookingEnabled: true,
    slotMinutes: 60,
    maxBookingsPerSlot: 5,
    hours: [...p.hours, p.hours[0]],
  });
  assert.equal(invalid.status, 400);
});

test("advisor cannot change booking limits and CMS accounts cannot operate bookings", async () => {
  const a = new Client();
  await a.login("advisor@example.test", password);
  const p = expect(await manager.call("GET", "admin/capacity/policy"), 200);
  const settings = {
    expectedVersion: p.configurationVersion,
    reason: "Thiết lập",
    bookingEnabled: true,
    slotMinutes: 60,
    maxBookingsPerSlot: 5,
    hours: p.hours,
  };
  assert.equal(
    (await a.call("PUT", "admin/capacity/policy", settings)).status,
    403,
  );
  expect(
    await manager.call("POST", "admin/staff", {
      name: "Biên tập",
      phone: "0901234578",
      email: "cms@example.test",
      jobRole: "MANAGER",
      active: true,
      account: {
        email: "cms@example.test",
        temporaryPassword: initialPassword,
        role: "CMS_ADMIN",
        permissions: ["cms.read", "cms.write"],
      },
    }),
    201,
  );
  const cms = new Client();
  await cms.login("cms@example.test");
  expect(
    await cms.call("POST", "admin/auth/change-password", {
      currentPassword: initialPassword,
      newPassword: password,
    }),
    200,
  );
  assert.equal((await cms.call("GET", "admin/capacity/policy")).status, 403);
  assert.equal(
    (await cms.call("GET", "admin/bookings?from=2026-11-20&to=2026-11-20"))
      .status,
    403,
  );
  assert.equal(
    (await cms.call("GET", "admin/cms/documents?kind=PAGE")).status,
    200,
  );
});
test("web requests form a shared queue: the advisor who confirms claims it; a manager must name one", async () => {
  const a = new Client();
  await a.login("advisor@example.test", password);
  expect(
    await manager.call("POST", "admin/staff", {
      name: "Cố vấn 2",
      phone: "0901234579",
      email: "advisor2@example.test",
      jobRole: "ADVISOR",
      active: true,
      account: {
        email: "advisor2@example.test",
        temporaryPassword: initialPassword,
        role: "ADVISOR",
        permissions: [],
      },
    }),
    201,
  );
  const other = new Client();
  await other.login("advisor2@example.test");
  expect(
    await other.call("POST", "admin/auth/change-password", {
      currentPassword: initialPassword,
      newPassword: password,
    }),
    200,
  );
  const r1 = await book("2026-11-26"),
    r2 = await book("2026-11-26", "14:00");
  const ids = async (c: Client) =>
    expect(
      await c.call("GET", "admin/bookings?from=2026-11-26&to=2026-11-26"),
      200,
    ).map((b: any) => b.id);
  assert.ok((await ids(a)).includes(r1.bookingId));
  assert.ok((await ids(other)).includes(r1.bookingId));
  assert.ok(
    expect(
      await a.call("GET", `admin/bookings/${r1.bookingId}`),
      200,
    ).allowedActions.includes("confirm"),
  );
  const body = (at: string) => ({
    expectedVersion: 1,
    reason: "Khách đồng ý",
    customerAgreed: true,
    confirmedStartAt: at,
  });
  expect(
    await a.call(
      "POST",
      `admin/bookings/${r1.bookingId}/confirm`,
      body("2026-11-26T09:15:00+07:00"),
    ),
    200,
  );
  const claimed = expect(
    await manager.call("GET", `admin/bookings/${r1.bookingId}`),
    200,
  );
  assert.equal(claimed.status, "CONFIRMED");
  assert.equal(claimed.assignedAdvisor.id, advisor);
  assert.ok(!(await ids(other)).includes(r1.bookingId));
  assert.equal(
    (await other.call("GET", `admin/bookings/${r1.bookingId}`)).status,
    404,
  );
  const m = body("2026-11-26T14:30:00+07:00");
  assert.equal(
    (
      await a.call("POST", `admin/bookings/${r2.bookingId}/confirm`, {
        ...m,
        advisorId: advisor,
      })
    ).status,
    403,
  );
  const missing = await manager.call(
    "POST",
    `admin/bookings/${r2.bookingId}/confirm`,
    m,
  );
  assert.equal(missing.body.error?.code, "ADVISOR_REQUIRED");
  expect(
    await manager.call("POST", `admin/bookings/${r2.bookingId}/confirm`, {
      ...m,
      advisorId: advisor,
    }),
    200,
  );
  assert.equal(
    expect(await manager.call("GET", `admin/bookings/${r2.bookingId}`), 200)
      .assignedAdvisor.id,
    advisor,
  );
});
