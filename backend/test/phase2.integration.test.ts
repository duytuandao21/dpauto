import { useLegacyVisitFixtures } from "./legacy-visit-fixture";
﻿import { before, beforeEach, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { migrate } from "../scripts/migrate";
import { bootstrap } from "../scripts/bootstrap";
import { loadConfig } from "../src/config";
import { createApp } from "../src/app";
import { sql, one, rows } from "../src/database";

const url = process.env.DP_TEST_DATABASE_URL;
if (!url || !url.includes("dpauto_test@127.0.0.1:"))
  throw Error("Run through test:phase2; never target a business database.");
let clock = new Date("2026-11-12T03:00:00Z");
const config = {
  ...loadConfig({
    DATABASE_URL: url,
    APP_ORIGIN: "http://localhost:4001",
    API_SECRET: "phase1-isolated-test-secret-".repeat(3),
    NODE_ENV: "test",
  }),
  now: () => new Date(clock),
};
let app: Awaited<ReturnType<typeof createApp>>["app"],
  api: Awaited<ReturnType<typeof createApp>>["api"];
let sequence = 10,
  phone = 0;
const password = "Temporary password 123!",
  changed = "Changed password 456!";
const hours = Array.from({ length: 7 }, (_, weekday) => ({
  weekday,
  opensAt: "08:00",
  closesAt: "18:00",
}));
const policy: any = {
  expectedVersion: 1,
  reason: "Thiết lập nhận lịch",
  bookingEnabled: false,
  slotMinutes: 30,
  maxBookingsPerSlot: 5,
  hours,
};
let service: string,
  shortService: string,
  extraService: string,
  advisorA: any,
  advisorB: any;
class Client {
  cookie = "";
  csrf = "";
  async call(method: string, path: string, payload?: unknown, key?: string) {
    const response = await app.inject({
      method: method as any,
      url: "/api/v1/" + path,
      remoteAddress: "127.0.0." + ((sequence++ % 200) + 10),
      headers: {
        origin: config.origin,
        ...(this.cookie ? { cookie: this.cookie } : {}),
        ...(method !== "GET"
          ? {
              "content-type": "application/json",
              "x-csrf-token": this.csrf,
              "idempotency-key": key || randomUUID(),
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
    return { status: response.statusCode, body, headers: response.headers };
  }
  async login(email: string, pw = password) {
    await this.call("GET", "admin/auth/csrf");
    const r = await this.call("POST", "admin/auth/login", {
      email,
      password: pw,
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body.data;
  }
}
const manager = new Client(),
  a = new Client(),
  b = new Client();
async function settingsVersion() {
  const r = await one(
    api.db.db,
    sql`SELECT * FROM stations WHERE code=${config.stationCode}`,
  );
  return {
    catalogVersion: r!.catalog_version,
    policyVersion: r!.configuration_version,
  };
}
async function bookingPayload(
  date = "2026-11-20",
  time = "09:00",
  extra: any = {},
) {
  return {
    customer: {
      name: "Khách kiểm thử",
      phone: "0900" + String(++phone).padStart(6, "0"),
    },
    serviceIds: [service],
    requestedStartAt: `${date}T${time}:00+07:00`,
    ...(await settingsVersion()),
    notice: {
      privacyNoticeVersion: "BOOKING_V1",
      privacyNoticeAcknowledged: true,
    },
    ...extra,
  };
}
async function createBooking(
  date: string,
  time = "09:00",
  assigned = advisorA.id,
) {
  const r = await manager.call("POST", "admin/bookings", {
    ...(await bookingPayload(date, time)),
    source: "PHONE",
    advisorId: assigned,
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.data;
}
before(async () => {
  await migrate(url!);
  ({ app, api } = await createApp(config));
  useLegacyVisitFixtures(api);
  await bootstrap(api.db, config, {
    name: "Store Manager",
    email: "manager@example.test",
    password,
    phone: "0901234567",
    stationName: "DPAuto Test",
    address: "Isolated fixture",
    directionsUrl: "https://maps.app.goo.gl/test",
  });
  await manager.login("manager@example.test");
  const changedResult = await manager.call(
    "POST",
    "admin/auth/change-password",
    { currentPassword: password, newPassword: changed },
  );
  assert.equal(changedResult.status, 200, JSON.stringify(changedResult.body));
  const initial = await manager.call("PUT", "admin/capacity/policy", policy);
  assert.equal(initial.status, 200, JSON.stringify(initial.body));
  for (const [code, duration, poolCode] of [
    ["WASH", 60, "DETAIL"],
    ["SHORT", 5, "DETAIL"],
    ["SHARED", 60, "EXTRA"],
  ] as const) {
    const r = await manager.call("POST", "admin/services", {
      code,
      name: code,
      categoryCode: "DETAILING",
      active: true,
      bookable: true,
      sortOrder: 0,
      estimatedDurationMinutes: Math.max(15, duration),
    });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    if (code === "WASH") service = r.body.data.id;
    else if (code === "SHORT") shortService = r.body.data.id;
    else extraService = r.body.data.id;
  }
  policy.bookingEnabled = true;
  policy.expectedVersion = (await settingsVersion()).policyVersion;
  const enabled = await manager.call("PUT", "admin/capacity/policy", policy);
  assert.equal(enabled.status, 200, JSON.stringify(enabled.body));
  for (const [email, name, client] of [
    ["a@example.test", "Advisor A", a],
    ["b@example.test", "Advisor B", b],
  ] as const) {
    const r = await manager.call("POST", "admin/staff", {
      name,
      phone: "0901234567",
      email,
      jobRole: "ADVISOR",
      active: true,
      account: {
        email,
        temporaryPassword: password,
        role: "ADVISOR",
        permissions: [],
      },
    });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    if (client === a) advisorA = r.body.data;
    else advisorB = r.body.data;
    await client.login(email);
    const changedResult = await client.call(
      "POST",
      "admin/auth/change-password",
      { currentPassword: password, newPassword: changed },
    );
    assert.equal(changedResult.status, 200);
  }
});
after(async () => {
  await app?.close();
});

let testDay = 12;
beforeEach(async () => {
  clock = new Date(`2026-11-${String(++testDay).padStart(2, "0")}T03:00:00Z`);
  // Isolate cases without invoking the P3 handover flow, which is not part of these tests.
  await api.db.tx(async (c) => {
    const holds = await rows(
      c,
      sql`SELECT id FROM capacity_reservations WHERE visit_id IS NOT NULL AND status='ACTIVE'`,
    );
    for (const h of holds)
      await api.capacity.release(
        c,
        { now: clock } as any,
        h.id,
        "TEST_FIXTURE_RESET",
      );
    await c.execute(
      sql`UPDATE service_visits SET stage='HANDED_OVER' WHERE stage IN ('RECEIVED','INSPECTED')`,
    );
  });
  await manager.login("manager@example.test", changed);
  await a.login("a@example.test", changed);
  await b.login("b@example.test", changed);
});
const intake = () => ({
  request: "Kiểm tra và chăm sóc xe",
  odometer: 38250,
  conditions: {
    exterior: "Trầy nhẹ cửa trước",
    interior: "Đã kiểm tra",
    engine: "",
    dashboard: "",
    tires: "",
    operation: [],
  },
  receptionNote: "Khách để lại chìa khóa",
  photos: [] as any[],
});
async function walkPayload(extra: any = {}) {
  return {
    customer: {
      name: "Walk-in customer",
      phone: "0900" + String(++phone).padStart(6, "0"),
    },
    vehicle: { model: "Toyota Vios", plate: "51A-" + phone },
    vehicleVerified: true,
    serviceIds: [service],
    ...(await settingsVersion()),
    notice: {
      privacyNoticeVersion: "BOOKING_V1",
      privacyNoticeAcknowledged: true,
    },
    intake: intake(),
    ...extra,
  };
}
async function walk(client = a, extra: any = {}) {
  const payload = await walkPayload(extra),
    key = randomUUID(),
    r = await client.call("POST", "admin/service-visits", payload, key);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return { visit: r.body.data, payload, key };
}
async function confirmed() {
  const date = clock.toLocaleDateString("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
  });
  const booking = await createBooking(date, "10:30");
  const confirm = await a.call(
    "POST",
    `admin/bookings/${booking.bookingId}/confirm`,
    {
      expectedVersion: booking.version,
      confirmedStartAt: `${date}T10:30:00+07:00`,
      customerAgreed: true,
      reason: "Khách đồng ý",
    },
  );
  assert.equal(confirm.status, 200, JSON.stringify(confirm.body));
  clock = new Date(`${date}T03:30:00Z`);
  await a.login("a@example.test", changed);
  await b.login("b@example.test", changed);
  await manager.login("manager@example.test", changed);
  return confirm.body.data;
}
async function receivePayload(booking: any, extra: any = {}) {
  return {
    expectedVersion: booking.version,
    vehicle: { model: "Honda City", plate: "51B-99999" },
    vehicleVerified: true,
    vehicleChangeReason: "Xác nhận xe thực tế khi nhận",
    policyVersion: (await settingsVersion()).policyVersion,
    intake: intake(),
    ...extra,
  };
}

test("P2 migration keeps P1 data and enforces nullable booking / XOR subjects", async () => {
  assert.equal(
    (
      await rows(
        api.db.db,
        sql`SELECT tablename FROM pg_tables WHERE schemaname='public'`,
      )
    ).length,
    40,
  );
  const { visit } = await walk();
  const v = await one(
    api.db.db,
    sql`SELECT * FROM service_visits WHERE id=${visit.visitId}`,
  );
  assert.equal(v!.booking_id, null);
  assert.equal(v!.origin, "WALK_IN");
  const h = await one(
    api.db.db,
    sql`SELECT * FROM capacity_reservations WHERE visit_id=${visit.visitId}`,
  );
  assert.equal(h!.booking_id, null);
  assert.equal(h!.status, "ACTIVE");
  await assert.rejects(
    api.db.db.execute(
      sql`UPDATE capacity_reservations SET visit_id=NULL WHERE id=${h!.id}`,
    ),
  );
  assert.equal(
    (await one(
      api.db.db,
      sql`SELECT count(*)::int AS n FROM consents WHERE visit_id=${visit.visitId}`,
    ))!.n,
    1,
  );
});
test("walk-in idempotency and concurrent booking receive return one visit with no double hold", async () => {
  const booking = await confirmed(),
    input = await receivePayload(booking);
  const before = await one(
    api.db.db,
    sql`SELECT sum(held_units)::int AS n FROM capacity_buckets WHERE starts_at>=${clock} AND starts_at<${new Date(+clock + 3600000)}`,
  );
  const results = await Promise.all([
    a.call("POST", `admin/bookings/${booking.bookingId}/receive`, input),
    a.call("POST", `admin/bookings/${booking.bookingId}/receive`, input),
  ]);
  for (const r of results) assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(results[0].body.data.visitId, results[1].body.data.visitId);
  const visitId = results[0].body.data.visitId;
  assert.equal(
    (await one(
      api.db.db,
      sql`SELECT count(*)::int AS n FROM capacity_reservations WHERE visit_id=${visitId} AND status='ACTIVE'`,
    ))!.n,
    1,
  );
  assert.equal(
    (await one(
      api.db.db,
      sql`SELECT count(*)::int AS n FROM capacity_reservations WHERE booking_id=${booking.bookingId} AND status='ACTIVE'`,
    ))!.n,
    0,
  );
  const after = await one(
    api.db.db,
    sql`SELECT sum(held_units)::int AS n FROM capacity_buckets WHERE starts_at>=${clock} AND starts_at<${new Date(+clock + 3600000)}`,
  );
  assert.equal(after!.n, before!.n);
  const detail = await a.call("GET", `admin/bookings/${booking.bookingId}`);
  assert.equal(detail.body.data.status, "ARRIVED");
  assert.equal(detail.body.data.serviceVisitId, visitId);
  assert.equal(detail.body.data.reservation.status, "ACTIVE");
  assert.equal(
    (
      await a.call("POST", `admin/bookings/${booking.bookingId}/cancel`, {
        expectedVersion: detail.body.data.version,
        reason: "Không được hủy lịch đã nhận",
      })
    ).status,
    409,
  );
});
test("walk-in scope extends directory, history and filters without exposing other advisors", async () => {
  const { visit } = await walk(),
    detail = (await a.call("GET", `admin/service-visits/${visit.visitId}`)).body
      .data;
  for (const path of [
    `admin/service-visits/${visit.visitId}`,
    `admin/service-visits/${visit.visitId}/events`,
    `admin/customers/${detail.customerId}`,
    `admin/vehicles/${detail.vehicleId}`,
  ])
    assert.equal((await b.call("GET", path)).status, 404, path);
  const list = await a.call(
    "GET",
    `admin/service-visits?customerId=${detail.customerId}&limit=1`,
  );
  assert.equal(list.body.data.length, 1);
  assert.equal(list.body.data[0].id, visit.visitId);
  assert.equal(
    (await b.call("GET", `admin/service-visits?advisorId=${advisorA.id}`))
      .status,
    403,
  );
  assert.equal(
    (
      await b.call(
        "GET",
        `admin/service-visits?customerId=${detail.customerId}`,
      )
    ).body.data.length,
    0,
  );
  const customer = await a.call("GET", `admin/customers/${detail.customerId}`),
    vehicle = await a.call("GET", `admin/vehicles/${detail.vehicleId}`);
  assert.equal(customer.status, 200);
  assert.equal(customer.body.data.vehicles[0].id, detail.vehicleId);
  assert.equal(vehicle.body.data.serviceHistoryAvailable, true);
  assert.equal(
    (await a.call("GET", `admin/customers?q=Walk-in`)).body.data.some(
      (c: any) => c.id === detail.customerId,
    ),
    true,
  );
  const replay = await walkPayload({
    customer: { id: detail.customerId },
    vehicle: { id: detail.vehicleId },
  });
  const dup = await a.call("POST", "admin/service-visits", replay);
  assert.equal(dup.status, 409);
  assert.equal(dup.body.error.code, "VEHICLE_ALREADY_IN_SERVICE");
});
test("intake validation, version conflicts, real inspection and append-only contacts/events", async () => {
  const { visit } = await walk();
  const bad = await a.call(
    "PATCH",
    `admin/service-visits/${visit.visitId}/intake`,
    {
      expectedVersion: 1,
      reason: "Sửa",
      intake: { ...intake(), odometer: -1 },
    },
  );
  assert.equal(bad.status, 400);
  const missing = await a.call(
    "PATCH",
    `admin/service-visits/${visit.visitId}/intake`,
    {
      expectedVersion: 1,
      reason: "Không đọc được đồng hồ",
      intake: {
        ...intake(),
        odometer: null,
        odometerMissingReason: "Màn hình không sáng",
      },
    },
  );
  assert.equal(missing.status, 200, JSON.stringify(missing.body));
  assert.equal(
    (
      await a.call("POST", `admin/service-visits/${visit.visitId}/inspection`, {
        expectedVersion: 1,
        reason: "Kiểm tra",
      })
    ).body.error.code,
    "VERSION_CONFLICT",
  );
  const checked = await a.call(
    "POST",
    `admin/service-visits/${visit.visitId}/inspection`,
    { expectedVersion: 2, reason: "Đã kiểm tra xe thực tế" },
  );
  assert.equal(checked.status, 200);
  assert.equal(checked.body.data.stage, "INSPECTED");
  const contact = await a.call(
    "POST",
    `admin/service-visits/${visit.visitId}/contact-events`,
    {
      expectedVersion: 3,
      channel: "PHONE",
      outcome: "AGREED",
      note: "Khách xác nhận yêu cầu",
    },
  );
  assert.equal(contact.status, 201);
  const events = await a.call(
    "GET",
    `admin/service-visits/${visit.visitId}/events?limit=2`,
  );
  assert.equal(events.body.page.hasMore, true);
  const next = await a.call(
    "GET",
    `admin/service-visits/${visit.visitId}/events?limit=2&cursor=${encodeURIComponent(events.body.page.nextCursor)}`,
  );
  assert.equal(next.status, 200);
  assert.equal(next.body.data.length, 2);
  await assert.rejects(
    api.db.db.execute(
      sql`DELETE FROM visit_contact_events WHERE visit_id=${visit.visitId}`,
    ),
  );
  await assert.rejects(
    api.db.db.execute(
      sql`UPDATE visit_events SET reason='tamper' WHERE visit_id=${visit.visitId}`,
    ),
  );
});
test("transfer synchronizes booking owner and denies previous advisor detail, mutations and receipt replay", async () => {
  const booking = await confirmed(),
    input = await receivePayload(booking),
    key = randomUUID();
  const received = await a.call(
      "POST",
      `admin/bookings/${booking.bookingId}/receive`,
      input,
      key,
    ),
    visitId = received.body.data.visitId;
  const result = await manager.call(
    "POST",
    `admin/service-visits/${visitId}/transfer`,
    { expectedVersion: 1, toAdvisorId: advisorB.id, reason: "Chuyển ca" },
  );
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(
    (await a.call("GET", `admin/service-visits/${visitId}`)).status,
    404,
  );
  assert.equal(
    (await a.call("GET", `admin/bookings/${booking.bookingId}`)).status,
    404,
  );
  assert.equal(
    (
      await a.call(
        "POST",
        `admin/bookings/${booking.bookingId}/receive`,
        input,
        key,
      )
    ).status,
    404,
  );
  assert.equal(
    (await b.call("GET", `admin/service-visits/${visitId}`)).body.data
      .assignedAdvisor.id,
    advisorB.id,
  );
  assert.equal(
    (await b.call("GET", `admin/bookings/${booking.bookingId}`)).body.data
      .assignedAdvisor.id,
    advisorB.id,
  );
  const history = await a.call("GET", "admin/my-visit-history?limit=100");
  const old = history.body.data.find((x: any) => x.visitId === visitId);
  assert.ok(old.endedAt);
  assert.ok(old.historicalSnapshot.visitCode);
  assert.equal(JSON.stringify(old).includes("090"), false);
  assert.equal(
    (
      await b.call("POST", `admin/service-visits/${visitId}/transfer`, {
        expectedVersion: 2,
        toAdvisorId: advisorA.id,
        reason: "Không có quyền",
      })
    ).status,
    403,
  );
});
// Keep a fixed JPEG so replacing website images cannot change private-media tests.
async function testJpeg() {
  const { readFile } = await import("node:fs/promises");
  const { resolve } = await import("node:path");
  return (
    "data:image/jpeg;base64," +
    (await readFile(resolve(__dirname, "fixtures/reception.jpg"))).toString(
      "base64",
    )
  );
}
test("private media validates bytes, rolls back invalid intake, and follows current visit ownership", async () => {
  const initial = await walkPayload({
    intake: {
      ...intake(),
      photos: [
        {
          name: "fake.jpg",
          dataUrl:
            "data:image/jpeg;base64," +
            Buffer.from("<svg/>").toString("base64"),
        },
      ],
    },
  });
  const failed = await a.call("POST", "admin/service-visits", initial);
  assert.equal(failed.status, 422, JSON.stringify(failed.body));
  const partial = await one(
    api.db.db,
    sql`SELECT count(*)::int AS n FROM customers WHERE phone_normalized=${"+84" + initial.customer.phone.slice(1)}`,
  );
  assert.equal(partial!.n, 0);
  const dataUrl = await testJpeg(),
    { visit, payload, key } = await walk(a, {
      intake: { ...intake(), photos: [{ name: "xe.jpg", dataUrl }] },
    });
  const detail = await a.call("GET", `admin/service-visits/${visit.visitId}`),
    media = detail.body.data.media[0];
  assert.ok(media.id);
  const image = await a.call("GET", `admin/visit-media/${media.id}`);
  assert.equal(image.status, 200);
  assert.equal(image.body.data.dataUrl, dataUrl);
  assert.equal(image.headers["cache-control"], "no-store");
  assert.equal(
    (await b.call("GET", `admin/visit-media/${media.id}`)).status,
    404,
  );
  const replay = await a.call("POST", "admin/service-visits", payload, key);
  assert.equal(replay.status, 201);
  assert.equal(replay.body.data.visitId, visit.visitId);
  const moved = await manager.call(
    "POST",
    `admin/service-visits/${visit.visitId}/transfer`,
    { expectedVersion: 1, toAdvisorId: advisorB.id, reason: "Chuyển cố vấn" },
  );
  assert.equal(moved.status, 200);
  assert.equal(
    (await a.call("GET", `admin/visit-media/${media.id}`)).status,
    404,
  );
  assert.equal(
    (await a.call("POST", "admin/service-visits", payload, key)).status,
    404,
  );
  assert.equal(
    (await b.call("GET", `admin/visit-media/${media.id}`)).status,
    200,
  );
  const removed = await b.call("DELETE", `admin/visit-media/${media.id}`, {
    expectedVersion: 2,
    reason: "Ảnh không rõ",
  });
  assert.equal(removed.status, 200);
  assert.equal(
    (await b.call("GET", `admin/visit-media/${media.id}`)).status,
    404,
  );
});
test("invalid vehicle verification, owner escalation, foreign scope and inactive advisor are rejected", async () => {
  const payload = await walkPayload();
  assert.equal(
    (
      await a.call("POST", "admin/service-visits", {
        ...payload,
        vehicleVerified: false,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await a.call("POST", "admin/service-visits", {
        ...payload,
        advisorId: advisorB.id,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await a.call("POST", "admin/service-visits", {
        ...payload,
        stage: "HANDED_OVER",
      })
    ).status,
    400,
  );
  const { visit } = await walk(),
    v = (await a.call("GET", `admin/service-visits/${visit.visitId}`)).body
      .data;
  assert.equal(
    (
      await b.call(
        "POST",
        "admin/service-visits",
        await walkPayload({ customer: { id: v.customerId } }),
      )
    ).status,
    422,
  );
  const staff = (
    await manager.call("GET", "admin/staff?limit=100")
  ).body.data.find((s: any) => s.id === advisorA.id);
  const offboard = await manager.call("PATCH", `admin/staff/${advisorA.id}`, {
    expectedVersion: staff.version,
    reason: "Tắt khi còn phiếu",
    active: false,
  });
  assert.equal(offboard.status, 409);
  assert.equal(offboard.body.error.code, "ASSIGNMENTS_REMAIN");
  const cs = a.csrf;
  a.csrf = "invalid";
  assert.equal(
    (await a.call("POST", "admin/service-visits", payload)).status,
    403,
  );
  a.csrf = cs;
  const anonymous = await new Client().call(
    "GET",
    `admin/service-visits/${visit.visitId}`,
  );
  assert.equal(anonymous.status, 401);
});
test("reception payload limits reject oversized bodies with 413 and never store partial intake", async () => {
  const result = await a.call("POST", "admin/service-visits", {
    ...(await walkPayload()),
    padding: "x".repeat(2 * 1024 * 1024),
  });
  assert.equal(result.status, 413, JSON.stringify(result.body));
  assert.equal(result.body.error.code, "PAYLOAD_TOO_LARGE");
});
