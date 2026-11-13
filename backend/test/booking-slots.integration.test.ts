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
    requestedStartAt: `${date}T${time}:00+07:00`,
    ...(await versions()),
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

test("six concurrent public submissions commit at most five; retries do not use another place", async () => {
  const requests = await Promise.all(
    Array.from({ length: 6 }, () => payload("2026-11-20")),
  );
  const keys = requests.map(() => randomUUID());
  const responses = await Promise.all(
    requests.map((p, i) => guest.call("POST", "public/bookings", p, keys[i])),
  );
  assert.equal(responses.filter((r) => r.status === 201).length, 5);
  assert.equal(
    responses.filter(
      (r) => r.status === 409 && r.body.error.code === "CAPACITY_FULL",
    ).length,
    1,
  );
  const index = responses.findIndex((r) => r.status === 201);
  const replay = expect(
    await guest.call("POST", "public/bookings", requests[index], keys[index]),
    201,
  );
  assert.equal(replay.bookingId, responses[index].body.data.bookingId);
  const slot = (await calendar("2026-11-20")).find(
    (s: any) => s.startAt === "2026-11-20T01:30:00.000Z",
  );
  assert.equal(slot.heldUnits, 5);
  assert.equal(slot.pendingCount, 5);
  assert.equal(slot.freeUnits, 0);
});

test("confirmation preserves five places; cancellation opens one immediately and rescheduling rolls back on full", async () => {
  for (let i = 0; i < 5; i++) await book("2026-11-25");
  const list = expect(
    await manager.call(
      "GET",
      "admin/bookings?from=2026-11-25&to=2026-11-25&limit=20",
    ),
    200,
  );
  for (const b of list) await confirm(b.id, b.scheduledStartAt);
  let slot = (await calendar("2026-11-25")).find((s: any) => s.heldUnits === 5);
  assert.equal(slot.pendingCount, 0);
  assert.equal(slot.confirmedCount, 5);
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
  assert.equal(slot.heldUnits, 4);
  assert.equal(slot.freeUnits, 1);
  const replacement = await book("2026-11-25");
  const source = await book("2026-11-26");
  const failed = await manager.call(
    "POST",
    `admin/bookings/${source.bookingId}/reschedule`,
    {
      expectedVersion: 1,
      reason: "Đổi giờ theo khách",
      customerAgreed: true,
      newStartAt: "2026-11-25T08:30:00+07:00",
      policyVersion: (await versions()).policyVersion,
    },
  );
  assert.equal(failed.status, 409);
  assert.equal(failed.body.error.code, "CAPACITY_FULL");
  const unchanged = expect(
    await manager.call("GET", "admin/bookings/" + source.bookingId),
    200,
  );
  assert.equal(unchanged.scheduledStartAt, "2026-11-26T01:30:00.000Z");
  expect(
    await manager.call(
      "POST",
      `admin/bookings/${replacement.bookingId}/reschedule`,
      {
        expectedVersion: 1,
        reason: "Đổi sang giờ còn chỗ",
        customerAgreed: true,
        newStartAt: "2026-11-25T09:30:00+07:00",
        policyVersion: (await versions()).policyVersion,
      },
    ),
    200,
  );
  slot = (await calendar("2026-11-25")).find(
    (s: any) => s.startAt === slot.startAt,
  );
  assert.equal(slot.freeUnits, 1);
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
  const rejected = await guest.call(
    "POST",
    "public/bookings",
    await payload(date),
  );
  assert.equal(rejected.status, 409);
  assert.equal(rejected.body.error.code, "SLOT_CLOSED");
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
  expect(
    await manager.call("DELETE", "admin/capacity/blocks/" + block.id, {
      expectedVersion: block.version,
      reason: "Mở lại ngày",
    }),
    204,
  );
  assert.equal(
    (await calendar(date)).find((s: any) => s.id === slot.id).freeUnits,
    4,
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
  const offGrid = await guest.call(
    "POST",
    "public/bookings",
    await payload("2026-11-24", "09:00"),
  );
  assert.equal(offGrid.status, 422);
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
