import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { migrate } from "../scripts/migrate";
import { bootstrap } from "../scripts/bootstrap";
import { loadConfig } from "../src/config";
import { createApp } from "../src/app";
import { sql, one, rows } from "../src/database";

const url = process.env.DP_TEST_DATABASE_URL;
if (!url || !url.includes("dpauto_test@127.0.0.1:"))
  throw Error("Run through test:phase1; never target a business database.");
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

test("schema constraints and seeded configuration are isolated", async () => {
  const tables = await rows(
    api.db.db,
    sql`SELECT tablename FROM pg_tables WHERE schemaname='public'`,
  );
  assert.equal(tables.length, 78);
  const counts = await one(
    api.db.db,
    sql`SELECT (SELECT count(*) FROM customers)::int AS customers,(SELECT count(*) FROM bookings)::int AS bookings`,
  );
  assert.equal(counts!.customers, 0);
  assert.equal(counts!.bookings, 0);
  assert.equal(
    (await app.inject({ url: "/api/v1/internal/health/ready" })).statusCode,
    200,
  );
});
test("public catalog, availability, real pending receipt and atomic side effects", async () => {
  const client = new Client(),
    catalog = await client.call("GET", "public/services");
  assert.equal(catalog.status, 200);
  assert.equal(catalog.body.data.services.length, 14);
  const versions = await settingsVersion(),
    query = new URLSearchParams({
      date: "2026-11-20",
      serviceIds: service,
      ...Object.fromEntries(
        Object.entries(versions).map(([k, v]) => [k, String(v)]),
      ),
    });
  const availability = await client.call("GET", "public/availability?" + query);
  assert.equal(availability.status, 200);
  assert(
    availability.body.data.slots.some((s: any) => s.status === "AVAILABLE"),
  );
  const r = await client.call(
    "POST",
    "public/bookings",
    await bookingPayload(),
  );
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.data.status, "PENDING");
  assert.equal(r.body.data.reservationStatus, "ACTIVE");
  assert(!JSON.stringify(r.body.data).includes("phone"));
  const integrity = await one(
    api.db.db,
    sql`SELECT (SELECT count(*) FROM capacity_reservations WHERE booking_id=${r.body.data.bookingId})::int AS holds,(SELECT count(*) FROM consents WHERE booking_id=${r.body.data.bookingId})::int AS consents,(SELECT count(*) FROM booking_events WHERE booking_id=${r.body.data.bookingId})::int AS events,(SELECT count(*) FROM outbox_jobs WHERE aggregate_id=${r.body.data.bookingId})::int AS outbox`,
  );
  assert.deepEqual(integrity, { holds: 1, consents: 1, events: 1, outbox: 1 });
});
test("idempotency concurrent replay creates once; changed payload conflicts", async () => {
  const payload = await bookingPayload("2026-11-22"),
    key = randomUUID(),
    client = new Client();
  const result = await Promise.all([
    client.call("POST", "public/bookings", payload, key),
    client.call("POST", "public/bookings", payload, key),
  ]);
  assert(result.every((r) => r.status === 201));
  assert.equal(result[0].body.data.bookingId, result[1].body.data.bookingId);
  const changed = await client.call(
    "POST",
    "public/bookings",
    { ...payload, note: "Different" },
    key,
  );
  assert.equal(changed.status, 409);
  assert.equal(changed.body.error.code, "IDEMPOTENCY_CONFLICT");
});
test("successful replan preserves requested origin and cancel releases once", async () => {
  const first = await createBooking("2026-11-25");
  const moved = await manager.call(
    "POST",
    `admin/bookings/${first.bookingId}/reschedule`,
    {
      expectedVersion: 1,
      newStartAt: "2026-11-26T10:00:00+07:00",
      reason: "Customer requested",
      customerAgreed: true,
      policyVersion: (await settingsVersion()).policyVersion,
    },
  );
  assert.equal(moved.status, 200);
  assert.equal(moved.body.data.requestedStartAt, first.requestedStartAt);
  assert.notEqual(moved.body.data.scheduledStartAt, first.scheduledStartAt);
  const payload = { expectedVersion: 2, reason: "Cancelled by customer" },
    key = randomUUID();
  assert.equal(
    (
      await manager.call(
        "POST",
        `admin/bookings/${first.bookingId}/cancel`,
        payload,
        key,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await manager.call(
        "POST",
        `admin/bookings/${first.bookingId}/cancel`,
        payload,
        key,
      )
    ).status,
    200,
  );
  const held = await one(
    api.db.db,
    sql`SELECT count(*)::int AS n FROM reservation_allocations a JOIN capacity_reservations r ON r.id=a.reservation_id WHERE r.booking_id=${first.bookingId} AND a.released_at IS NULL`,
  );
  assert.equal(held!.n, 0);
});
test("transfer immediately removes former advisor detail, customer and replay access", async () => {
  const ownPayload = {
      ...(await bookingPayload("2026-11-27")),
      source: "PHONE",
    },
    key = randomUUID();
  const made = await a.call("POST", "admin/bookings", ownPayload, key);
  assert.equal(made.status, 201, JSON.stringify(made.body));
  const id = made.body.data.bookingId;
  const before = (await a.call("GET", `admin/bookings/${id}`)).body.data;
  const moved = await manager.call("POST", `admin/bookings/${id}/transfer`, {
    expectedVersion: 1,
    toAdvisorId: advisorB.id,
    reason: "Reassigned",
  });
  assert.equal(moved.status, 200);
  assert.equal((await a.call("GET", `admin/bookings/${id}`)).status, 404);
  assert.equal(
    (await a.call("GET", `admin/customers/${before.customerId}`)).status,
    404,
  );
  assert.equal(
    (await a.call("POST", "admin/bookings", ownPayload, key)).status,
    404,
  );
  assert.equal((await b.call("GET", `admin/bookings/${id}`)).status, 200);
  const timeline = await a.call("GET", `admin/bookings/${id}/events`);
  assert.equal(timeline.status, 200);
  assert(timeline.body.data.every((e: any) => e.reason === null));
  const history = await a.call(
    "GET",
    "admin/my-history?from=2026-11-12&to=2026-11-12",
  );
  assert.equal(history.status, 200);
  assert(history.body.data.some((h: any) => h.bookingId === id));
  assert(!JSON.stringify(history.body.data).includes("phone"));
});
test("strict boundary validation, role checks, wrong origin and scoped cursors", async () => {
  assert.equal(
    (
      await new Client().call(
        "GET",
        "admin/bookings?from=2026-11-12&to=2026-11-30",
      )
    ).status,
    401,
  );
  assert.equal((await a.call("GET", "admin/capacity/policy")).status, 403);
  assert.equal(
    (
      await a.call(
        "GET",
        "admin/bookings?from=2026-11-12&to=2026-11-30&advisorId=" + advisorB.id,
      )
    ).status,
    403,
  );
  const bad = await new Client().call("POST", "public/bookings", {
    ...(await bookingPayload("2026-11-28")),
    status: "CONFIRMED",
  });
  assert.equal(bad.status, 400);
  assert.equal(
    (
      await new Client().call(
        "GET",
        "public/availability?date=2026-02-30&serviceIds=" +
          service +
          "&catalogVersion=1&policyVersion=1",
      )
    ).status,
    400,
  );
  const csrf = await app.inject({
    method: "POST",
    url: "/api/v1/admin/bookings",
    headers: {
      origin: "https://wrong.example",
      cookie: manager.cookie,
      "content-type": "application/json",
      "x-csrf-token": manager.csrf,
    },
    payload: {},
  });
  assert.equal(csrf.statusCode, 403);
  const first = await manager.call(
    "GET",
    "admin/bookings?from=2026-11-12&to=2026-11-30&limit=1",
  );
  assert(first.body.page.nextCursor);
  const wrong = await manager.call(
    "GET",
    "admin/bookings?from=2026-11-13&to=2026-11-30&limit=1&cursor=" +
      encodeURIComponent(first.body.page.nextCursor),
  );
  assert.equal(wrong.status, 400);
});
test("maintenance block rejects held footprint; safe block has audited retirement", async () => {
  const held = await manager.call("POST", "admin/capacity/blocks", {
    startsAt: "2026-11-21T08:00:00+07:00",
    endsAt: "2026-11-21T11:00:00+07:00",
    kind: "MAINTENANCE",
    reason: "Maintenance",
  });
  assert.equal(held.status, 409);
  const safe = await manager.call("POST", "admin/capacity/blocks", {
    startsAt: "2026-12-20T08:00:00+07:00",
    endsAt: "2026-12-20T11:00:00+07:00",
    kind: "MAINTENANCE",
    reason: "Maintenance",
  });
  assert.equal(safe.status, 201);
  const deleted = await manager.call(
    "DELETE",
    "admin/capacity/blocks/" + safe.body.data.id,
    { expectedVersion: 1, reason: "Maintenance finished" },
  );
  assert.equal(deleted.status, 204);
});
test("no-show requires manual check and grace; no arbitrary arrive endpoint", async () => {
  const first = await createBooking("2026-11-12", "12:00");
  const confirmed = await manager.call(
    "POST",
    `admin/bookings/${first.bookingId}/confirm`,
    {
      expectedVersion: 1,
      confirmedStartAt: first.scheduledStartAt,
      customerAgreed: true,
      reason: "Agreed",
    },
  );
  assert.equal(confirmed.status, 200);
  const payload = {
    expectedVersion: 2,
    reason: "Checked by phone",
    checkedManually: true,
  };
  assert.equal(
    (
      await manager.call(
        "POST",
        `admin/bookings/${first.bookingId}/no-show`,
        payload,
      )
    ).status,
    422,
  );
  const old = clock;
  clock = new Date("2026-11-12T05:16:00Z");
  try {
    const lateManager = new Client();
    await lateManager.login("manager@example.test", changed);
    const r = await lateManager.call(
      "POST",
      `admin/bookings/${first.bookingId}/no-show`,
      payload,
    );
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.data.status, "NO_SHOW");
  } finally {
    clock = old;
  }
  assert.equal(
    (await manager.call("POST", `admin/bookings/${first.bookingId}/arrive`, {}))
      .status,
    404,
  );
});
test("offboard and last-authority guards; account reset revokes sessions", async () => {
  const current = (await manager.call("GET", "admin/staff?limit=100")).body
    .data;
  const managerStaff = current.find((s: any) => s.jobRole === "MANAGER");
  const last = await manager.call("PATCH", "admin/staff/" + managerStaff.id, {
    expectedVersion: managerStaff.version,
    reason: "Disable last manager",
    active: false,
  });
  assert.equal(last.status, 409);
  const own = current.find((s: any) => s.id === advisorA.id);
  const offboard = await manager.call("PATCH", "admin/staff/" + own.id, {
    expectedVersion: own.version,
    reason: "Offboard",
    active: false,
  });
  assert.equal(offboard.status, 409);
  const target = current.find((s: any) => s.id === advisorB.id);
  const reset = await manager.call(
    "POST",
    "admin/staff/" + target.id + "/reset-password",
    {
      expectedVersion: target.version,
      reason: "Password reset",
      temporaryPassword: "Reset temporary password 789!",
    },
  );
  assert.equal(reset.status, 200);
  assert.equal((await b.call("GET", "admin/auth/me")).status, 401);
  const limited = await b.login(
    "b@example.test",
    "Reset temporary password 789!",
  );
  assert.equal(limited.mustChangePassword, true);
  assert.equal((await b.call("GET", "admin/services")).status, 403);
});
test("customer/vehicle reads, contacts, capacity limits, dashboard and append-only audit", async () => {
  const made = await createBooking("2026-11-30");
  const detail = (await manager.call("GET", `admin/bookings/${made.bookingId}`))
    .body.data;
  assert.equal(
    (await manager.call("GET", "admin/customers/" + detail.customerId)).status,
    200,
  );
  const contact = await manager.call(
    "POST",
    `admin/bookings/${made.bookingId}/contact-events`,
    {
      expectedVersion: 1,
      channel: "PHONE",
      outcome: "PROPOSED_TIME",
      proposedStartAt: "2026-12-01T09:00:00+07:00",
      customerAccepted: false,
    },
  );
  assert.equal(contact.status, 201);
  const after = (await manager.call("GET", `admin/bookings/${made.bookingId}`))
    .body.data;
  assert.equal(after.scheduledStartAt, made.scheduledStartAt);
  const calendar = await manager.call(
    "GET",
    "admin/capacity/calendar?from=2026-11-30&to=2026-11-30",
  );
  assert.equal(calendar.status, 200, JSON.stringify(calendar.body));
  const bucket = calendar.body.data.buckets.find((v: any) => v.heldUnits > 0);
  assert(bucket);
  assert.equal(
    (
      await manager.call("PATCH", "admin/capacity/buckets/" + bucket.id, {
        expectedVersion: bucket.version,
        startAt: bucket.startAt,
        capacityLimit: 0,
        reason: "Too low",
      })
    ).status,
    409,
  );
  const dashboard = await manager.call(
    "GET",
    "admin/dashboard?date=2026-11-30",
  );
  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.body.data.counts.total, 1);
  const audits = await manager.call(
    "GET",
    "admin/audit-logs?from=2026-11-12&to=2026-11-12",
  );
  assert.equal(audits.status, 200);
  assert(!JSON.stringify(audits.body).includes(password));
  await assert.rejects(
    api.db.db.execute(sql`UPDATE audit_logs SET summary='bad'`),
  );
});
