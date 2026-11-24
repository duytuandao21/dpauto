import { useLegacyVisitFixtures } from "./legacy-visit-fixture";
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
  useLegacyVisitFixtures(api);
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
  // Migration 0025 hides legacy services; these workflow tests still book RUA_XE.
  await api.db.db.execute(
    sql`UPDATE services SET active=true,bookable=true WHERE code='RUA_XE'`,
  );
  service = expect(
    await guest.call("GET", "public/services"),
    200,
  ).services.find((s: any) => s.code === "RUA_XE").id;
});
after(async () => {
  if (app) await app.close();
});

test("phase1: daily booking codes are padded, concurrent-safe, reset by Vietnam creation day, and requests stay pending", async () => {
  const payloads = await Promise.all(
    Array.from({ length: 5 }, () => payload("2026-12-01")),
  );
  const results = await Promise.all(
    payloads.map((p) => guest.call("POST", "public/bookings", p)),
  );
  const codes = results.map((r) => expect(r, 201).bookingCode).sort();
  assert.deepEqual(
    codes,
    [1, 2, 3, 4, 5].map((n) => `DP-DV13112026-${String(n).padStart(3, "0")}`),
  );
  const list = expect(
    await manager.call("GET", "admin/bookings?status=PENDING"),
    200,
  );
  assert.equal(list.length, 5);
  assert.ok(
    list.every(
      (b: any) =>
        b.status === "PENDING" &&
        b.lastContactOutcome === null &&
        b.confirmedStartAt === null,
    ),
  );
  const replayKey = randomUUID();
  const again = await guest.call(
    "POST",
    "public/bookings",
    payloads[0],
    replayKey,
  );
  const replay = await guest.call(
    "POST",
    "public/bookings",
    payloads[0],
    replayKey,
  );
  assert.equal(expect(again, 201).bookingCode, expect(replay, 201).bookingCode);
  config.now = () => new Date("2026-11-13T17:01:00Z");
  assert.equal((await book("2026-12-01")).bookingCode, "DP-DV14112026-001");
  config.now = () => new Date("2026-11-13T00:00:00Z");
});

test("phase2: unreachable remains shared, callback and contact count are recorded; one save confirms and claims", async () => {
  const user = new Client();
  await user.login("advisor@example.test", password);
  const created = await book("2026-11-21");
  const id = created.bookingId;
  const contacted = expect(
    await user.call("POST", `admin/bookings/${id}/contact-events`, {
      expectedVersion: 1,
      channel: "OTHER",
      outcome: "UNREACHED",
      callbackAt: "2026-11-14T08:00:00+07:00",
    }),
    201,
  );
  const pending = expect(
    await manager.call("GET", `admin/bookings/${id}`),
    200,
  );
  assert.equal(pending.assignedAdvisor, null);
  assert.equal(pending.status, "PENDING");
  assert.equal(pending.contactAttempts, 1);
  assert.equal(pending.callbackAt, "2026-11-14T01:00:00.000Z");
  const query = new URLSearchParams({
    action: "confirm",
    expectedVersion: String(contacted.version),
    startAt: "2026-11-21T18:00:00+07:00",
  });
  const preview = expect(
    await user.call("GET", `admin/bookings/${id}/preview?${query}`),
    200,
  );
  assert.ok(preview.warnings.includes("OUTSIDE_HOURS"));
  assert.equal(
    expect(await manager.call("GET", `admin/bookings/${id}`), 200).version,
    contacted.version,
  );
  const confirmed = expect(
    await user.call("POST", `admin/bookings/${id}/confirm`, {
      expectedVersion: contacted.version,
      customerAgreed: true,
      confirmedStartAt: "2026-11-21T09:15:00+07:00",
      internalNote: "Khách đã chốt giờ",
    }),
    200,
  );
  assert.equal(confirmed.status, "CONFIRMED");
  const detail = expect(await user.call("GET", `admin/bookings/${id}`), 200);
  assert.equal(detail.assignedAdvisor.id, advisor);
  assert.equal(detail.internalNote, "Khách đã chốt giờ");
  assert.equal(detail.requestedPeriod, "MORNING");
  assert.equal(detail.callbackAt, null);
  const event = await one(
    api.db.db,
    sql`SELECT * FROM booking_contact_events WHERE booking_id=${id} AND outcome='AGREED'`,
  );
  assert.equal(event!.channel, "OTHER");
  assert.equal(event!.customer_accepted, true);
  const moved = expect(
    await user.call("POST", `admin/bookings/${id}/reschedule`, {
      expectedVersion: confirmed.version,
      newStartAt: "2026-11-21T10:00:00+07:00",
      customerAgreed: true,
      policyVersion: (await versions()).policyVersion,
      reason: "Khách cần đến muộn",
    }),
    200,
  );
  const cancelled = expect(
    await user.call("POST", `admin/bookings/${id}/cancel`, {
      expectedVersion: moved.version,
      reason: "Xe gặp sự cố trên đường",
    }),
    200,
  );
  assert.equal(cancelled.status, "CANCELLED");
  const history = expect(
    await user.call("GET", `admin/bookings/${id}/events`),
    200,
  );
  assert.ok(
    history.some(
      (e: any) =>
        e.reason === "Khách cần đến muộn" &&
        e.newStartAt === "2026-11-21T03:00:00.000Z",
    ),
  );
  assert.ok(history.some((e: any) => e.reason === "Xe gặp sự cố trên đường"));
  // Delete works in any status: hidden from lists/detail, row and history kept, replay is safe.
  const key = randomUUID();
  const del = () =>
    user.call("DELETE", `admin/bookings/${id}`, { expectedVersion: cancelled.version }, key);
  assert.equal(expect(await del(), 200).deleted, true);
  assert.equal(expect(await del(), 200).deleted, true);
  expect(await user.call("GET", `admin/bookings/${id}`), 404);
  const row = await one(
    api.db.db,
    sql`SELECT status,deleted_at FROM bookings WHERE id=${id}`,
  );
  assert.equal(row!.status, "CANCELLED");
  assert.ok(row!.deleted_at);
  assert.equal(
    (await one(api.db.db, sql`SELECT count(*)::int AS n FROM capacity_reservations WHERE booking_id=${id} AND status='ACTIVE'`))!.n,
    0,
  );
});

test("phase2: two advisors cannot overwrite the same request and other advisors cannot read the claimed booking", async () => {
  const second = expect(
    await manager.call("POST", "admin/staff", {
      name: "Cố vấn 2",
      phone: "0901234569",
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
  const a = new Client(),
    b = new Client();
  await a.login("advisor@example.test", password);
  await b.login("advisor2@example.test");
  expect(
    await b.call("POST", "admin/auth/change-password", {
      currentPassword: initialPassword,
      newPassword: password,
    }),
    200,
  );
  const created = await book("2026-11-22");
  const body = {
    expectedVersion: 1,
    customerAgreed: true,
    confirmedStartAt: "2026-11-22T09:00:00+07:00",
  };
  const result = await Promise.all([
    a.call("POST", `admin/bookings/${created.bookingId}/confirm`, body),
    b.call("POST", `admin/bookings/${created.bookingId}/confirm`, body),
  ]);
  assert.equal(result.filter((r) => r.status === 200).length, 1);
  assert.ok(result.every((r) => [200, 404, 409].includes(r.status)));
  const detail = expect(
    await manager.call("GET", `admin/bookings/${created.bookingId}`),
    200,
  );
  const loser = detail.assignedAdvisor.id === second.id ? a : b;
  assert.equal(
    (await loser.call("GET", `admin/bookings/${created.bookingId}`)).status,
    404,
  );
  const assignments = await one(
    api.db.db,
    sql`SELECT count(*)::int AS n FROM booking_assignments WHERE booking_id=${created.bookingId}`,
  );
  assert.equal(assignments!.n, 1);
});

test("phase3: internal create-and-confirm is atomic, idempotent and records agreement; pending supports periods", async () => {
  const user = new Client();
  await user.login("advisor@example.test", password);
  const publicBody = await payload("2026-11-24");
  const { requestedDate, requestedPeriod, ...common } = publicBody;
  const input = {
    ...common,
    ...(await versions()),
    source: "PHONE",
    requestedStartAt: "2026-11-24T09:30:00+07:00",
    confirmNow: true,
    customerAgreed: true,
  };
  const key = randomUUID();
  const created = expect(
    await user.call("POST", "admin/bookings", input, key),
    201,
  );
  assert.equal(created.status, "CONFIRMED");
  assert.equal(created.version, 1);
  assert.equal(created.confirmedStartAt, "2026-11-24T02:30:00.000Z");
  assert.equal(
    expect(await user.call("POST", "admin/bookings", input, key), 201)
      .bookingId,
    created.bookingId,
  );
  const detail = expect(
    await user.call("GET", `admin/bookings/${created.bookingId}`),
    200,
  );
  assert.equal(detail.assignedAdvisor.id, advisor);
  assert.equal(detail.lastContactOutcome, "AGREED");
  const events = expect(
    await user.call("GET", `admin/bookings/${created.bookingId}/events`),
    200,
  );
  assert.ok(events.some((e: any) => e.eventType === "BOOKING_CREATED"));
  assert.ok(events.some((e: any) => e.eventType === "BOOKING_CONFIRM"));
  const pending = expect(
    await user.call("POST", "admin/bookings", {
      ...(await payload("2026-11-25")),
      ...(await versions()),
      source: "PHONE",
    }),
    201,
  );
  assert.equal(pending.status, "PENDING");
  assert.equal(pending.requestedPeriod, "MORNING");
  assert.equal(pending.confirmedStartAt, null);
  const before = await one(
    api.db.db,
    sql`SELECT count(*)::int AS n FROM bookings`,
  );
  const invalid = await manager.call("POST", "admin/bookings", {
    ...input,
    customer: { name: "Khách chưa phân công", phone: "0902223334" },
  });
  assert.equal(invalid.status, 422);
  assert.equal(invalid.body.error.code, "ADVISOR_REQUIRED");
  assert.equal(
    (await one(api.db.db, sql`SELECT count(*)::int AS n FROM bookings`))!.n,
    before!.n,
  );
  assert.equal(
    (
      await manager.call("POST", "admin/bookings", {
        ...input,
        customerAgreed: undefined,
      })
    ).status,
    400,
  );
  const previewParams = new URLSearchParams({
    startAt: "2026-11-24T09:30:00+07:00",
    serviceIds: service,
    catalogVersion: String((await versions()).catalogVersion),
  });
  assert.ok(
    expect(
      await user.call("GET", `admin/bookings/create-preview?${previewParams}`),
      200,
    ).warnings.includes("ADVISOR_TIME_CONFLICT"),
  );
});

test("phase4: intake keeps safeguards, creates one visit under concurrent submission and preserves inspection gate", async () => {
  const user = new Client();
  await user.login("advisor@example.test", password);
  const { requestedDate, requestedPeriod, ...common } =
    await payload("2026-11-26");
  const created = expect(
    await user.call("POST", "admin/bookings", {
      ...common,
      ...(await versions()),
      source: "PHONE",
      requestedStartAt: "2026-11-26T09:30:00+07:00",
      confirmNow: true,
      customerAgreed: true,
      vehicle: { model: "Toyota Vios", plate: "51G-112.34" },
      customerNote: "Khách cần kiểm tra phanh",
    }),
    201,
  );
  const detail = expect(
    await user.call("GET", `admin/bookings/${created.bookingId}`),
    200,
  );
  const intake = {
    request: detail.customerNote,
    odometer: 35000,
    conditions: {
      exterior: "",
      interior: "",
      engine: "",
      dashboard: "",
      tires: "",
      operation: [],
    },
    receptionNote: "",
    photos: [],
  };
  const input = {
    expectedVersion: created.version,
    vehicle: { model: "Actual replacement vehicle" },
    vehicleVerified: true,
    policyVersion: (await versions()).policyVersion,
    intake: { ...intake, odometer: null },
  };
  const path = `admin/bookings/${created.bookingId}/receive`;
  assert.equal(
    (await user.call("POST", path, { ...input, vehicleVerified: false }))
      .status,
    400,
  );
  const responses = await Promise.all([
    user.call("POST", path, input),
    user.call("POST", path, input),
  ]);
  assert.ok(
    responses.every((r) => [200, 201].includes(r.status)),
    JSON.stringify(responses),
  );
  assert.equal(responses[0].body.data.visitId, responses[1].body.data.visitId);
  const visitId = responses[0].body.data.visitId;
  assert.equal(
    (await one(
      api.db.db,
      sql`SELECT count(*)::int AS n FROM service_visits WHERE booking_id=${created.bookingId}`,
    ))!.n,
    1,
  );
  const visit = expect(
    await user.call("GET", `admin/service-visits/${visitId}`),
    200,
  );
  assert.equal(visit.stage, "RECEIVED");
  assert.equal(visit.intake.request, detail.customerNote);
  assert.equal(visit.services[0].id, service);
  assert.equal(
    expect(await user.call("GET", `admin/bookings/${created.bookingId}`), 200)
      .status,
    "ARRIVED",
  );
  const inspected = await user.call(
    "POST",
    `admin/service-visits/${visitId}/inspection`,
    { expectedVersion: visit.version, reason: "Kiểm tra ban đầu" },
  );
  assert.equal(inspected.status, 422);
  assert.equal(inspected.body.error.code, "INSPECTION_EMPTY");
});

test("phase5: interval preview warns before save, adjacent intervals do not clash, original period survives changes, requests are unlimited", async () => {
  const user = new Client();
  await user.login("advisor@example.test", password);
  const first = await book("2026-11-27");
  const fixed = expect(
    await user.call("POST", `admin/bookings/${first.bookingId}/confirm`, {
      expectedVersion: 1,
      customerAgreed: true,
      confirmedStartAt: "2026-11-27T09:00:00+07:00",
    }),
    200,
  );
  const second = await book("2026-11-27");
  const query = (at: string) =>
    new URLSearchParams({
      action: "confirm",
      expectedVersion: "1",
      startAt: at,
    });
  const preview = expect(
    await user.call(
      "GET",
      `admin/bookings/${second.bookingId}/preview?${query("2026-11-27T09:01:00+07:00")}`,
    ),
    200,
  );
  assert.ok(preview.warnings.includes("ADVISOR_TIME_CONFLICT"));
  const end = fixed.reservation.endAt;
  assert.ok(
    !expect(
      await user.call(
        "GET",
        `admin/bookings/${second.bookingId}/preview?${query(end)}`,
      ),
      200,
    ).warnings.includes("ADVISOR_TIME_CONFLICT"),
  );
  const original = expect(
    await manager.call("GET", `admin/bookings/${second.bookingId}`),
    200,
  );
  assert.equal(original.status, "PENDING");
  assert.equal(original.version, 1);
  const moved = expect(
    await user.call("POST", `admin/bookings/${second.bookingId}/reschedule`, {
      expectedVersion: 1,
      requestedDate: "2026-11-28",
      requestedPeriod: "AFTERNOON",
      customerAgreed: true,
    }),
    200,
  );
  expect(
    await user.call("POST", `admin/bookings/${second.bookingId}/confirm`, {
      expectedVersion: moved.version,
      confirmedStartAt: "2026-11-28T14:15:00+07:00",
      customerAgreed: true,
    }),
    200,
  );
  const detail = expect(
    await user.call("GET", `admin/bookings/${second.bookingId}`),
    200,
  );
  assert.equal(detail.originalRequestedPeriod, "MORNING");
  assert.equal(detail.requestedPeriod, "AFTERNOON");
  assert.equal(detail.requestedStartAt, original.requestedStartAt);
  assert.equal(detail.confirmedStartAt, "2026-11-28T07:15:00.000Z");
  const inputs = await Promise.all(
    Array.from({ length: 7 }, () => payload("2026-12-02")),
  );
  const results = await Promise.all(
    inputs.map((p) => guest.call("POST", "public/bookings", p)),
  );
  assert.ok(
    results.every((r) => r.status === 201 && r.body.data.status === "PENDING"),
    JSON.stringify(results),
  );
  const availability = expect(
    await guest.call("GET", "public/availability?date=2026-12-02"),
    200,
  );
  assert.equal(
    availability.periods.find((p: any) => p.period === "MORNING").status,
    "AVAILABLE",
  );
  const countsBefore = await one(
    api.db.db,
    sql`SELECT count(*)::int AS n FROM booking_contact_events WHERE booking_id=${results[0].body.data.bookingId}`,
  );
  assert.equal(
    (
      await user.call(
        "POST",
        `admin/bookings/${results[0].body.data.bookingId}/contact-events`,
        {
          expectedVersion: 1,
          channel: "OTHER",
          outcome: "UNREACHED",
          callbackAt: "2026-11-12T09:00:00+07:00",
        },
      )
    ).status,
    422,
  );
  assert.equal(
    (await one(
      api.db.db,
      sql`SELECT count(*)::int AS n FROM booking_contact_events WHERE booking_id=${results[0].body.data.bookingId}`,
    ))!.n,
    countsBefore!.n,
  );
});

test("phase6: manager sees future backlog, confirms in one save and can transfer without expanding advisor scope", async () => {
  const created = await book("2026-12-10");
  const pending = expect(
    await manager.call("GET", "admin/bookings?status=PENDING"),
    200,
  );
  assert.ok(
    pending.some((b: any) => b.id === created.bookingId && !b.assignedAdvisor),
  );
  const day = expect(
    await manager.call("GET", "admin/bookings?from=2026-11-13&to=2026-11-13"),
    200,
  );
  assert.ok(!day.some((b: any) => b.id === created.bookingId));
  const params = new URLSearchParams({
    action: "confirm",
    expectedVersion: "1",
    startAt: "2026-12-10T09:30:00+07:00",
    advisorId: advisor,
  });
  expect(
    await manager.call(
      "GET",
      `admin/bookings/${created.bookingId}/preview?${params}`,
    ),
    200,
  );
  const confirmed = expect(
    await manager.call("POST", `admin/bookings/${created.bookingId}/confirm`, {
      expectedVersion: 1,
      confirmedStartAt: "2026-12-10T09:30:00+07:00",
      advisorId: advisor,
      customerAgreed: true,
    }),
    200,
  );
  assert.equal(confirmed.status, "CONFIRMED");
  const second = expect(
    await manager.call("POST", "admin/staff", {
      name: "Cố vấn nhận chuyển",
      phone: "0901234569",
      email: "transfer@example.test",
      jobRole: "ADVISOR",
      active: true,
      account: {
        email: "transfer@example.test",
        temporaryPassword: initialPassword,
        role: "ADVISOR",
        permissions: [],
      },
    }),
    201,
  );
  const next = new Client();
  await next.login("transfer@example.test");
  expect(
    await next.call("POST", "admin/auth/change-password", {
      currentPassword: initialPassword,
      newPassword: password,
    }),
    200,
  );
  const transferred = expect(
    await manager.call("POST", `admin/bookings/${created.bookingId}/transfer`, {
      expectedVersion: confirmed.version,
      toAdvisorId: second.id,
      reason: "Điều phối theo ca làm",
    }),
    200,
  );
  assert.equal(
    expect(await next.call("GET", `admin/bookings/${created.bookingId}`), 200)
      .assignedAdvisor.id,
    second.id,
  );
  const old = new Client();
  await old.login("advisor@example.test", password);
  assert.equal(
    (await old.call("GET", `admin/bookings/${created.bookingId}`)).status,
    404,
  );
  assert.equal(
    (
      await old.call("POST", `admin/bookings/${created.bookingId}/assign`, {
        expectedVersion: transferred.version,
        advisorId: advisor,
        reason: "Tự phân công",
      })
    ).status,
    403,
  );
  const history = expect(
    await manager.call("GET", `admin/bookings/${created.bookingId}/events`),
    200,
  );
  assert.ok(history.some((e: any) => e.reason === "Điều phối theo ca làm"));
});

test("customers: one record per phone across bookings; delete waits for open work, then frees the phone", async () => {
  const p = await payload("2026-12-03");
  const a = expect(await guest.call("POST", "public/bookings", p), 201);
  const b = expect(
    await guest.call("POST", "public/bookings", {
      ...p,
      customer: { ...p.customer, name: "Tên khác" },
    }),
    201,
  );
  const owners = await rows(
    api.db.db,
    sql`SELECT DISTINCT customer_id FROM bookings WHERE id IN (${a.bookingId}::uuid,${b.bookingId}::uuid)`,
  );
  assert.equal(owners.length, 1);
  const id = owners[0].customer_id;
  const customer = expect(await manager.call("GET", `admin/customers/${id}`), 200);
  const blocked = await manager.call("DELETE", `admin/customers/${id}`, {
    expectedVersion: customer.version,
  });
  assert.equal(blocked.status, 409, JSON.stringify(blocked.body));
  await api.db.db.execute(
    sql`UPDATE bookings SET status='CANCELLED',cancelled_at=now(),cancel_reason='Test',change_kind='CANCELLED' WHERE customer_id=${id}`,
  );
  expect(
    await manager.call("DELETE", `admin/customers/${id}`, {
      expectedVersion: customer.version,
    }),
    200,
  );
  expect(await manager.call("GET", `admin/customers/${id}`), 404);
  const c = expect(await guest.call("POST", "public/bookings", p), 201);
  const fresh = (await one(
    api.db.db,
    sql`SELECT customer_id FROM bookings WHERE id=${c.bookingId}::uuid`,
  ))!.customer_id;
  assert.notEqual(fresh, id);
});

test("partners: picking a sale makes the partner the customer; snapshots keep old names; inactive sales are refused", async () => {
  const [partner] = expect(await manager.call("GET", "admin/partners"), 200);
  assert.equal(partner.name, "Xe Lướt Toàn Trung");
  const sale = expect(
    await manager.call("POST", `admin/partners/${partner.id}/sales`, { name: "Sale A" }),
    201,
  );
  const body = {
    ...(await payload("2026-12-04")),
    ...(await versions()),
    source: "AT_STATION",
    partnerSaleId: sale.id,
  };
  const noPhone = await manager.call("POST", "admin/bookings", body);
  assert.equal(noPhone.status, 422, JSON.stringify(noPhone.body));
  expect(
    await manager.call("PATCH", `admin/partners/${partner.id}`, {
      expectedVersion: partner.version,
      name: partner.name,
      phone: "0912345678",
      active: true,
    }),
    200,
  );
  const booking = expect(await manager.call("POST", "admin/bookings", body), 201);
  const row = (await one(
    api.db.db,
    sql`SELECT b.partner_snapshot,c.name,c.phone_normalized FROM bookings b JOIN customers c ON c.id=b.customer_id WHERE b.id=${booking.bookingId}::uuid`,
  ))!;
  assert.equal(row.name, "Xe Lướt Toàn Trung");
  assert.equal(row.phone_normalized, "+84912345678");
  expect(
    await manager.call("PATCH", `admin/partner-sales/${sale.id}`, {
      expectedVersion: 1,
      name: "Sale B",
      active: false,
    }),
    200,
  );
  const detail = expect(await manager.call("GET", `admin/bookings/${booking.bookingId}`), 200);
  assert.equal(detail.partner.saleName, "Sale A");
  const inactive = await manager.call("POST", "admin/bookings", body);
  assert.equal(inactive.status, 422);
  assert.equal(inactive.body.error.code, "PARTNER_SALE_INVALID");
});
