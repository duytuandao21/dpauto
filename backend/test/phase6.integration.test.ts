import { before, beforeEach, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { migrate } from "../scripts/migrate";
import { bootstrap } from "../scripts/bootstrap";
import { loadConfig } from "../src/config";
import { createApp } from "../src/app";
import { sql, one, rows } from "../src/database";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Notifications } from "../src/notifications";
import { csv, shiftHours } from "../src/operations-utils";
import { day } from "../src/common";
import type { Context } from "../src/common";
import type { Conn } from "../src/database";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname, basename } from "node:path";
import { legacyFixture } from "./legacy-fixtures";
import { readLegacyFile, emptyTotals, shaBytes } from "../src/legacy-file";
import {
  operatorContext,
  freezeStation,
  checkpoint,
  checkpointChanges,
} from "../src/ops-control";
import { backupDatabase, restoreDatabase, readProof } from "../src/backup";
import { activateCutover, cutoverPlan } from "../src/cutover";

const url = process.env.DP_TEST_DATABASE_URL;
if (!url || !url.includes("dpauto_test@127.0.0.1:"))
  throw Error("Run through test:phase6; never target a business database.");
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
    const body = response.headers["content-type"]?.startsWith("image/")
      ? { binary: response.rawPayload.length }
      : response.body
        ? JSON.parse(response.body)
        : {};
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
let technician: any;
const limited = new Client();
const grants = [
  "staff.manage",
  "roles.manage",
  "inventory.manage",
  "inventory.adjust",
  "inventory.cost.read",
  "finance.read",
  "payments.collect",
  "payments.refund",
  "reports.export",
  "cms.read",
  "cms.write",
  "cms.publish",
  "notifications.manage",
];
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
  const tech = await manager.call("POST", "admin/staff", {
    name: "Kỹ thuật viên",
    phone: "0901234567",
    email: "tech@example.test",
    jobRole: "TECHNICIAN",
    active: true,
  });
  assert.equal(tech.status, 201, JSON.stringify(tech.body));
  technician = tech.body.data;
  const me = (
    await manager.call("GET", "admin/staff?limit=100")
  ).body.data.find((s: any) => s.account?.email === "manager@example.test");
  const allowed = await manager.call("PATCH", `admin/staff/${me.id}`, {
    expectedVersion: me.version,
    reason: "Cấp quyền kho và tiền trong DB tạm",
    account: { permissions: grants },
  });
  assert.equal(allowed.status, 200, JSON.stringify(allowed.body));
  await manager.login("manager@example.test", changed);
  const limitedStaff = await manager.call("POST", "admin/staff", {
    name: "Thu ngân",
    phone: "0901234567",
    email: "cash@example.test",
    jobRole: "MANAGER",
    active: true,
    account: {
      email: "cash@example.test",
      temporaryPassword: password,
      role: "MANAGER",
      permissions: ["payments.collect"],
    },
  });
  assert.equal(limitedStaff.status, 201, JSON.stringify(limitedStaff.body));
  await limited.login("cash@example.test");
  assert.equal(
    (
      await limited.call("POST", "admin/auth/change-password", {
        currentPassword: password,
        newPassword: changed,
      })
    ).status,
    200,
  );
});
after(async () => {
  await app?.close();
});

let testDay = 12;
beforeEach(async () => {
  await api.db.db.execute(
    sql`UPDATE station_write_guards SET frozen=false,version=version+1`,
  );
  clock = new Date(`2026-11-${String(++testDay).padStart(2, "0")}T03:00:00Z`);
  // Isolate cases without invoking the P3 handover flow, which is not part of these tests.
  await api.db.tx(async (c) => {
    await c.execute(
      sql`UPDATE work_orders SET status='ABORTED' WHERE status IN ('NOT_STARTED','IN_PROGRESS','PAUSED')`,
    );
    await c.execute(
      sql`UPDATE resource_occupancies SET ended_at=${clock},release_reason='TEST_FIXTURE_RESET' WHERE ended_at IS NULL`,
    );
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
      sql`UPDATE service_visits SET stage='HANDED_OVER' WHERE stage NOT IN ('HANDED_OVER','ABORTED')`,
    );
  });
  await manager.login("manager@example.test", changed);
  await a.login("a@example.test", changed);
  await b.login("b@example.test", changed);
  await limited.login("cash@example.test", changed);
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

async function act(
  client: Client,
  id: string,
  path: string,
  body: any = {},
  method = "POST",
  key?: string,
) {
  const current = await client.call("GET", `admin/service-visits/${id}`);
  assert.equal(current.status, 200, JSON.stringify(current.body));
  return client.call(
    method,
    path,
    {
      expectedVersion: current.body.data.version,
      reason: "Thao tác kiểm thử có căn cứ",
      ...body,
    },
    key,
  );
}
async function ok(
  client: Client,
  id: string,
  path: string,
  body: any = {},
  method = "POST",
) {
  const r = await act(client, id, path, body, method);
  assert.ok(
    [200, 201].includes(r.status),
    `${path}: ${r.status} ${JSON.stringify(r.body)}`,
  );
  return r.body.data;
}
const evidence = {
  customerName: "Khách hàng",
  channel: "IN_PERSON",
  note: "Khách đã đối chiếu đúng bản báo giá và xác nhận",
};
async function quote(id: string, price = "0", kind = "SERVICE", decide = true) {
  const current = (await a.call("GET", `admin/service-visits/${id}/workflow`))
    .body.data;
  const receipt = await ok(a, id, `admin/service-visits/${id}/quotes`, {
    baseRevisionId: current.quotes.at(-1)?.id,
  });
  const qid = receipt.revisionId;
  await ok(
    a,
    id,
    `admin/quote-revisions/${qid}`,
    {
      calculationPolicy: "VND_LINE_HALF_UP_V1",
      discountPercent: "0",
      note: "Báo giá theo yêu cầu",
      lines: [
        {
          kind,
          serviceId: kind === "SERVICE" ? service : undefined,
          name: "Chăm sóc xe",
          code: "WASH",
          unit: "Lần",
          quantity: "1",
          unitPrice: price,
          discountPercent: "0",
          vatPercent: "0",
        },
      ],
    },
    "PATCH",
  );
  await ok(a, id, `admin/quote-revisions/${qid}/submit`);
  if (decide)
    await ok(a, id, `admin/quote-revisions/${qid}/decision`, {
      decision: "APPROVED",
      evidence,
    });
  const data = (await a.call("GET", `admin/service-visits/${id}/workflow`)).body
    .data;
  return data.quotes.find((q: any) => q.id === qid);
}
async function received() {
  const { visit } = await walk();
  await ok(
    a,
    visit.visitId,
    `admin/service-visits/${visit.visitId}/inspection`,
  );
  return visit.visitId as string;
}
async function item(id: string, line?: string, exemptionId?: string) {
  return ok(a, id, `admin/service-visits/${id}/work-items`, {
    label: "Thực hiện chăm sóc xe",
    quoteLineId: line,
    exemptionId,
    technicianIds: [technician.id],
    dueAt: new Date(+clock + 3600000).toISOString(),
  });
}
async function doneWork(id: string, price = "0") {
  const q = await quote(id, price),
    i = await item(id, q.lines[0].id);
  await ok(a, id, `admin/service-visits/${id}/work/start`);
  await ok(a, id, `admin/work-items/${i.workItemId}/progress`, {
    status: "IN_PROGRESS",
  });
  await ok(a, id, `admin/work-items/${i.workItemId}/progress`, {
    status: "DONE",
  });
  await ok(a, id, `admin/service-visits/${id}/work/finish`);
  return { quote: q, item: i };
}
async function passed(id: string, itemId: string) {
  await ok(a, id, `admin/service-visits/${id}/acceptances`, {
    inspectorId: technician.id,
    result: "PASSED",
    note: "Đã kiểm tra thực tế",
    checks: [{ workItemId: itemId, passed: true, note: "" }],
  });
  return ok(a, id, `admin/service-visits/${id}/ready`);
}

async function success(
  client: Client,
  method: string,
  path: string,
  body?: any,
  key?: string,
) {
  const r = await client.call(method, path, body, key);
  assert.ok(
    [200, 201].includes(r.status),
    `${path}: ${r.status} ${JSON.stringify(r.body)}`,
  );
  return r.body.data;
}

let folder: string;
before(async () => {
  folder = await mkdtemp(join(tmpdir(), "dpauto-phase6-"));
});
after(async () => {
  if (folder) {
    assert.equal(dirname(folder), resolve(tmpdir()));
    assert.ok(basename(folder).startsWith("dpauto-phase6-"));
    await rm(folder, { recursive: true, force: true });
  }
});
async function task<T>(fn: (c: Conn, ctx: Context) => Promise<T>) {
  return api.db.tx(async (c) =>
    fn(c, await operatorContext(c, config, "manager@example.test")),
  );
}
async function freeze(value = true) {
  return task(async (c, ctx) =>
    freezeStation(
      c,
      ctx,
      value,
      (
        await one(
          c,
          sql`SELECT version FROM station_write_guards WHERE station_id=${ctx.station.id}`,
        )
      )?.version || 0,
      "Điểm chốt kiểm thử biệt lập",
    ),
  );
}
async function source(media = false) {
  const f = legacyFixture(
    "0900" + String(++phone).padStart(6, "0"),
    "SRC_" + randomUUID().slice(0, 8),
  );
  if (media) {
    const bytes = await readFile(resolve(__dirname, "fixtures/reception.jpg")),
      file = "media-" + phone + ".jpg";
    await writeFile(join(folder, file), bytes);
    f.records.push({
      type: "MEDIA",
      key: "m-1",
      sourceVersion: "1",
      data: {
        historyKey: "h-1",
        name: "garage.jpg",
        relativePath: file,
        sha256: shaBytes(bytes),
        bytes: bytes.length,
        contentType: "image/jpeg",
      },
    });
    f.expected.counts.MEDIA = 1;
    f.expected.totals.mediaBytes = bytes.length;
  }
  return f;
}
async function stage(f: ReturnType<typeof legacyFixture>) {
  const path = join(folder, randomUUID() + ".json");
  await writeFile(path, JSON.stringify(f));
  const checked = await readLegacyFile(path);
  return task((c, ctx) => api.legacy.stage(c, ctx, checked));
}
async function plan(id: string) {
  return task((c, ctx) => api.legacy.plan(c, ctx, id, true));
}
async function review(
  id: string,
  rowId: string,
  decision: string,
  extra: any = {},
) {
  const p = await plan(id);
  return task((c, ctx) =>
    api.legacy.review(c, ctx, id, rowId, {
      expectedVersion: p.version,
      decision,
      reason: "Đối chiếu bản nguồn có checksum",
      ...extra,
    }),
  );
}
async function entities(id: string) {
  const p = await plan(id);
  for (const r of p.records || [])
    if (["CUSTOMER", "VEHICLE"].includes(r.entity_type))
      await review(id, r.id, "CREATE");
}
async function apply(id: string) {
  const p = await plan(id);
  assert.equal(p.ready, true, JSON.stringify(p.issues));
  return task((c, ctx) => api.legacy.apply(c, ctx, id, p.fingerprint));
}

test("P6 staging, review, atomic import and scoped archival media do not invent visits or ledger movements", async () => {
  const f = await source(true),
    b1 = await stage(f),
    b2 = await stage(f);
  assert.equal(b1.id, b2.id);
  assert.ok("replayed" in b2 && b2.replayed);
  const before = (await one(
    api.db.db,
    sql`SELECT (SELECT count(*)::int FROM service_visits) AS visits,(SELECT count(*)::int FROM cash_entries) AS cash,(SELECT count(*)::int FROM stock_ledger) AS stock`,
  ))!;
  assert.equal((await plan(b1.id)).ready, false);
  await entities(b1.id);
  await assert.rejects(
    () => apply(b1.id),
    (e) => (e as any).code === "FREEZE_REQUIRED",
  );
  await freeze();
  await apply(b1.id);
  assert.equal((await apply(b1.id)).replayed, true);
  const after = (await one(
    api.db.db,
    sql`SELECT (SELECT count(*)::int FROM service_visits) AS visits,(SELECT count(*)::int FROM cash_entries) AS cash,(SELECT count(*)::int FROM stock_ledger) AS stock`,
  ))!;
  assert.deepEqual(after, before);
  const c = (await one(
      api.db.db,
      sql`SELECT customer_id FROM legacy_identities WHERE source_system=${f.sourceSystem} AND entity_type='CUSTOMER'`,
    ))!.customer_id,
    v = (await one(
      api.db.db,
      sql`SELECT vehicle_id FROM legacy_identities WHERE source_system=${f.sourceSystem} AND entity_type='VEHICLE'`,
    ))!.vehicle_id;
  const h = await success(
    manager,
    "GET",
    `admin/customers/${c}/legacy-records`,
  );
  assert.equal(h.length, 1);
  assert.equal(h[0].data.code, "CRM-H001");
  assert.equal(h[0].media.length, 1);
  assert.equal(
    (await a.call("GET", `admin/customers/${c}/legacy-records`)).status,
    404,
  );
  assert.equal(
    (await manager.call("GET", `admin/vehicles/${randomUUID()}`)).status,
    404,
  );
  assert.deepEqual(
    await success(manager, "GET", `admin/vehicles?customerId=${randomUUID()}`),
    [],
  );
  const m = h[0].media[0].id;
  assert.equal(
    (await manager.call("GET", "admin/legacy-media/" + m)).status,
    200,
  );
  assert.equal((await a.call("GET", "admin/legacy-media/" + m)).status, 404);
  const historyId = h[0].id;
  await assert.rejects(() =>
    api.db.db.execute(
      sql`UPDATE legacy_records SET payload='{}' WHERE id=${historyId}`,
    ),
  );
  await freeze(false);
  const booking = await success(manager, "POST", "admin/bookings", {
    ...(await bookingPayload(day(clock), "11:00", {
      customer: { id: c },
      vehicle: { id: v },
    })),
    source: "PHONE",
    advisorId: advisorA.id,
  });
  assert.equal(
    (await a.call("GET", `admin/customers/${c}/legacy-records`)).status,
    200,
  );
  await success(
    manager,
    "POST",
    `admin/bookings/${booking.bookingId}/transfer`,
    {
      expectedVersion: booking.version,
      toAdvisorId: advisorB.id,
      reason: "Đổi người phụ trách",
    },
  );
  assert.equal((await a.call("GET", "admin/legacy-media/" + m)).status, 404);
  assert.equal((await b.call("GET", "admin/legacy-media/" + m)).status, 200);
  await assert.rejects(
    () => task((conn, ctx) => operatorContext(conn, config, "a@example.test")),
    (e) => (e as any).code === "OPERATOR_NOT_AUTHORIZED",
  );
});

test("P6 quarantine blocks promotion and abandoned batches preserve their evidence", async () => {
  const f = await source();
  f.records[3].data.status = "UNKNOWN";
  const b1 = await stage(f);
  assert.equal(b1.valid, false);
  const p = await plan(b1.id);
  assert.equal(p.ready, false);
  const r = p.records!.find((r) => r.entity_type === "HISTORY")!;
  assert.equal(r.payload, null);
  await assert.rejects(
    () => review(b1.id, r.id, "ARCHIVE"),
    (e) => (e as any).code === "LEGACY_SOURCE_REQUIRES_CORRECTION",
  );
  await freeze();
  await assert.rejects(
    () => task((c, ctx) => api.legacy.apply(c, ctx, b1.id, p.fingerprint)),
    (e) => (e as any).code === "LEGACY_REVIEW_REQUIRED",
  );
  await task((c, ctx) =>
    api.legacy.abandon(
      c,
      ctx,
      b1.id,
      p.version,
      "Nguồn chưa đúng cấu trúc, giữ bản chờ trích xuất lại",
    ),
  );
  assert.equal(
    (await one(
      api.db.db,
      sql`SELECT status FROM legacy_batches WHERE id=${b1.id}`,
    ))!.status,
    "ABANDONED",
  );
  assert.equal(
    (await one(
      api.db.db,
      sql`SELECT count(*)::int AS n FROM legacy_records WHERE batch_id=${b1.id}`,
    ))!.n,
    4,
  );
});

test("P6 source changes require explicit mapping approval and never overwrite customer edits in the new system", async () => {
  const f = await source(),
    first = await stage(f);
  await entities(first.id);
  await freeze();
  await apply(first.id);
  const identity = (await one(
    api.db.db,
    sql`SELECT * FROM legacy_identities WHERE source_system=${f.sourceSystem} AND entity_type='CUSTOMER'`,
  ))!;
  await api.db.db.execute(
    sql`UPDATE customers SET name='Tên đã cập nhật tại DPAuto',version=version+1 WHERE id=${identity.customer_id}`,
  );
  const updated = structuredClone(f);
  updated.records[0].data.name = "Tên khác trong CRM";
  updated.records[0].sourceVersion = "2";
  const next = await stage(updated),
    p = await plan(next.id),
    r = p.records!.find((r) => r.entity_type === "CUSTOMER")!;
  await review(next.id, r.id, "LINK", { targetId: identity.customer_id });
  assert.equal((await plan(next.id)).ready, false);
  await review(next.id, r.id, "LINK", {
    targetId: identity.customer_id,
    ackSourceChange: true,
  });
  await apply(next.id);
  assert.equal(
    (await one(
      api.db.db,
      sql`SELECT name FROM customers WHERE id=${identity.customer_id}`,
    ))!.name,
    "Tên đã cập nhật tại DPAuto",
  );
  assert.equal(
    (await one(
      api.db.db,
      sql`SELECT source_version FROM legacy_identities WHERE id=${identity.id}`,
    ))!.source_version,
    "2",
  );
  assert.equal(
    (await one(
      api.db.db,
      sql`SELECT count(*)::int AS n FROM legacy_records WHERE entity_type='CUSTOMER' AND batch_id IN (${first.id},${next.id}) AND status='IMPORTED'`,
    ))!.n,
    2,
  );
});

test("P6 same-phone candidates require a decision; changed link targets roll the whole import back", async () => {
  const firstSource = await source(),
    first = await stage(firstSource);
  await entities(first.id);
  await freeze();
  await apply(first.id);
  const target = (await one(
    api.db.db,
    sql`SELECT customer_id FROM legacy_identities WHERE source_system=${firstSource.sourceSystem} AND entity_type='CUSTOMER'`,
  ))!.customer_id;
  const f = await source();
  f.records[0].data.phone = firstSource.records[0].data.phone;
  const next = await stage(f),
    p = await plan(next.id),
    customer = p.records!.find((r) => r.entity_type === "CUSTOMER")!,
    vehicle = p.records!.find((r) => r.entity_type === "VEHICLE")!;
  await assert.rejects(
    () => review(next.id, customer.id, "CREATE"),
    (e) => (e as any).code === "LEGACY_MATCH_REQUIRES_REVIEW",
  );
  await review(next.id, customer.id, "LINK", { targetId: target });
  await review(next.id, vehicle.id, "CREATE");
  const count = (await one(
    api.db.db,
    sql`SELECT count(*)::int AS n FROM vehicles`,
  ))!.n;
  await api.db.db.execute(
    sql`UPDATE customers SET version=version+1 WHERE id=${target}`,
  );
  await assert.rejects(
    () => apply(next.id),
    (e) => (e as any).code === "LEGACY_TARGET_CHANGED",
  );
  assert.equal(
    (await one(api.db.db, sql`SELECT count(*)::int AS n FROM vehicles`))!.n,
    count,
  );
  assert.equal(
    (await one(
      api.db.db,
      sql`SELECT status FROM legacy_batches WHERE id=${next.id}`,
    ))!.status,
    "STAGED",
  );
});

test("P6 opening balances and active orders stay with the legacy owner without operational proof", async () => {
  const f = await source();
  f.scopeMode = "CUTOVER";
  f.records.push(
    {
      type: "STOCK",
      key: "s-1",
      sourceVersion: "1",
      data: {
        mode: "OPENING",
        code: "ST-1",
        asOf: f.cutoffAt,
        warehouseCode: "OLD_WH",
        partCode: "OLD_PART",
        unit: "chai",
        quantity: "2.500",
        value: "12500",
      },
    },
    {
      type: "FINANCE",
      key: "f-1",
      sourceVersion: "1",
      data: {
        mode: "OPENING",
        code: "DEBT-1",
        asOf: f.cutoffAt,
        customerKey: "c-1",
        kind: "DEBT",
        amount: "10000",
        currency: "VND",
      },
    },
    {
      type: "ACTIVE_ORDER",
      key: "a-1",
      sourceVersion: "1",
      data: {
        customerKey: "c-1",
        vehicleKey: "v-1",
        code: "ACTIVE-1",
        asOf: f.cutoffAt,
        status: "Đang làm",
        summary: "Nguồn đang phụ trách",
      },
    },
  );
  f.expected.counts.STOCK = 1;
  f.expected.counts.FINANCE = 1;
  f.expected.counts.ACTIVE_ORDER = 1;
  Object.assign(f.expected.totals, {
    stockValue: "12500",
    stockQuantities: { '["OLD_WH","OLD_PART","chai"]': "2.500" },
    openingDebt: "10000",
    activeOrders: 1,
  });
  const batch = await stage(f);
  await entities(batch.id);
  const p = await plan(batch.id);
  for (const r of p.records!.filter((r) =>
    ["STOCK", "FINANCE", "ACTIVE_ORDER"].includes(r.entity_type),
  ))
    await review(batch.id, r.id, "KEEP_LEGACY");
  await freeze();
  await apply(batch.id);
  const cp = await task((c, ctx) => checkpoint(c, ctx, "Trước chuyển đổi"));
  const full = await task((c, ctx) => cutoverPlan(c, ctx, cp.id, "FULL"));
  assert.equal(full.ready, false);
  assert.ok(full.issues.includes("LEGACY_WRITE_OWNERS_REMAIN"));
  const managerCustomer = (await one(
    api.db.db,
    sql`SELECT customer_id FROM legacy_identities WHERE source_system=${f.sourceSystem} AND entity_type='CUSTOMER'`,
  ))!.customer_id;
  assert.equal(
    (
      await manager.call(
        "GET",
        `admin/customers/${managerCustomer}/legacy-records?kind=FINANCE`,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await a.call(
        "GET",
        `admin/customers/${managerCustomer}/legacy-records?kind=FINANCE`,
      )
    ).status,
    404,
  );
  assert.equal(
    (await task((c, ctx) => cutoverPlan(c, ctx, cp.id, "NEW_BUSINESS"))).ready,
    true,
  );
});

test("P6 operational proofs verify actual stock, credit and debt without posting a second ledger entry", async () => {
  const f = await source(),
    base = await stage(f);
  await entities(base.id);
  await freeze();
  await apply(base.id);
  await freeze(false);
  const cid = (await one(
    api.db.db,
    sql`SELECT customer_id FROM legacy_identities WHERE source_system=${f.sourceSystem} AND entity_type='CUSTOMER'`,
  ))!.customer_id;
  const warehouse = await success(manager, "POST", "admin/stock/warehouses", {
      code: "W_" + randomUUID().slice(0, 6).toUpperCase(),
      name: "Kho đối chiếu",
    }),
    part = await success(manager, "POST", "admin/stock/parts", {
      code: "P_" + randomUUID().slice(0, 6).toUpperCase(),
      name: "Vật tư",
      unit: "chai",
    });
  const draft = await success(manager, "POST", "admin/stock/documents", {
    commandId: randomUUID(),
    warehouseId: warehouse.id,
    kind: "RECEIPT",
    reason: "Chứng từ có căn cứ",
    lines: [{ partId: part.id, quantity: "2.500", unitCost: "5000" }],
  });
  await success(manager, "POST", `admin/stock/documents/${draft.id}/post`, {
    expectedVersion: draft.version,
    reason: "Ghi sổ đã duyệt",
  });
  const line = (await one(
    api.db.db,
    sql`SELECT id FROM stock_document_lines WHERE document_id=${draft.id}`,
  ))!.id;
  const payment = await success(manager, "POST", "admin/finance/payments", {
    commandId: randomUUID(),
    expectedVersion: 1,
    customerId: cid,
    kind: "DEPOSIT",
    amount: "10000",
    method: "CASH",
    reference: "CARRYOVER-001",
    payerName: "Khách nguồn",
    reason: "Chứng từ đối chiếu gốc",
  });
  const id = await received();
  await quote(id, "10000");
  const debt = {
    entity_type: "FINANCE",
    payload: {
      mode: "OPENING",
      kind: "DEBT",
      amount: "10000",
      asOf: clock.toISOString(),
    },
  };
  assert.equal(
    (await task((c, ctx) => api.legacy.proof(c, ctx, debt, "VISIT", id)))
      .outstanding,
    "10000",
  );
  await assert.rejects(
    () =>
      task((c, ctx) =>
        api.legacy.proof(
          c,
          ctx,
          { ...debt, payload: { ...debt.payload, amount: "9999" } },
          "VISIT",
          id,
        ),
      ),
    (e) => (e as any).code === "LEGACY_DEBT_PROOF_MISMATCH",
  );
  assert.equal(
    (
      await task((c, ctx) =>
        api.legacy.proof(
          c,
          ctx,
          { entity_type: "ACTIVE_ORDER", payload: {} },
          "VISIT",
          id,
        ),
      )
    ).id,
    id,
  );
  const g = legacyFixture(String(f.records[0].data.phone), f.sourceSystem);
  g.cutoffAt = clock.toISOString();
  g.exportedAt = g.cutoffAt;
  g.records = [
    {
      type: "STOCK",
      key: "s-proof",
      sourceVersion: "1",
      data: {
        mode: "OPENING",
        code: "RECEIPT-1",
        asOf: g.cutoffAt,
        warehouseCode: (await one(
          api.db.db,
          sql`SELECT code FROM warehouses WHERE id=${warehouse.id}`,
        ))!.code,
        partCode: (await one(
          api.db.db,
          sql`SELECT code FROM parts WHERE id=${part.id}`,
        ))!.code,
        unit: "chai",
        quantity: "2.500",
        value: "12500",
      },
    },
    {
      type: "FINANCE",
      key: "f-proof",
      sourceVersion: "1",
      data: {
        mode: "OPENING",
        code: "CARRYOVER-001",
        asOf: g.cutoffAt,
        customerKey: "c-1",
        kind: "DEPOSIT",
        amount: "10000",
        currency: "VND",
      },
    },
  ];
  g.expected = {
    counts: {
      CUSTOMER: 0,
      VEHICLE: 0,
      LINK: 0,
      HISTORY: 0,
      MEDIA: 0,
      ACTIVE_ORDER: 0,
      STOCK: 1,
      FINANCE: 1,
    },
    totals: {
      ...emptyTotals(),
      stockValue: "12500",
      stockQuantities: {
        [JSON.stringify([
          g.records[0].data.warehouseCode,
          g.records[0].data.partCode,
          "chai",
        ])]: "2.500",
      },
      deposits: "10000",
    },
  };
  const batch = await stage(g),
    p = await plan(batch.id),
    s = p.records!.find((r) => r.entity_type === "STOCK")!,
    fin = p.records!.find((r) => r.entity_type === "FINANCE")!;
  await assert.rejects(
    () =>
      task((c, ctx) =>
        api.legacy.proof(
          c,
          ctx,
          { ...s, payload: { ...s.payload, quantity: "3" } },
          "STOCK_LINE",
          line,
        ),
      ),
    (e) => (e as any).code === "LEGACY_STOCK_PROOF_MISMATCH",
  );
  await review(batch.id, s.id, "ARCHIVE", {
    liveType: "STOCK_LINE",
    liveId: line,
  });
  await review(batch.id, fin.id, "ARCHIVE", {
    liveType: "CASH",
    liveId: payment.id,
  });
  const count = (await one(
    api.db.db,
    sql`SELECT (SELECT count(*)::int FROM stock_ledger) AS stock,(SELECT count(*)::int FROM cash_entries) AS cash`,
  ))!;
  await freeze();
  await apply(batch.id);
  assert.deepEqual(
    await one(
      api.db.db,
      sql`SELECT (SELECT count(*)::int FROM stock_ledger) AS stock,(SELECT count(*)::int FROM cash_entries) AS cash`,
    ),
    count,
  );
  assert.equal(
    (await one(
      api.db.db,
      sql`SELECT ownership FROM legacy_identities WHERE source_system=${f.sourceSystem} AND entity_type='FINANCE'`,
    ))!.ownership,
    "DPAUTO",
  );
});

test("P6 freeze blocks mutations and worker delivery while allowing reads, replay and compatible readiness", async () => {
  const payload = {
      ...(await bookingPayload(day(clock), "11:00")),
      source: "PHONE",
      advisorId: advisorA.id,
    },
    key = randomUUID(),
    created = await success(manager, "POST", "admin/bookings", payload, key);
  await api.db.db.execute(
    sql`UPDATE outbox_jobs SET scheduled_at=${clock} WHERE aggregate_id=${created.bookingId}`,
  );
  await freeze();
  assert.equal(
    (await manager.call("POST", "admin/bookings", payload, key)).status,
    201,
  );
  const rejected = await manager.call("POST", "admin/bookings", {
    ...payload,
    customer: { name: "Mới", phone: "0908888888" },
  });
  assert.equal(rejected.status, 503);
  assert.equal(rejected.body.error.code, "STATION_FROZEN");
  const before = (await one(
    api.db.db,
    sql`SELECT count(*)::int AS n FROM notifications`,
  ))!.n;
  await api.notifications.work(50);
  assert.equal(
    (await one(api.db.db, sql`SELECT count(*)::int AS n FROM notifications`))!
      .n,
    before,
  );
  assert.equal(
    (
      await manager.call(
        "GET",
        `admin/bookings?from=${day(clock)}&to=${day(clock)}`,
      )
    ).status,
    200,
  );
  assert.equal(
    (await manager.call("GET", "internal/health/ready")).status,
    200,
  );
  const migration = (await one(
    api.db.db,
    sql`SELECT name,checksum FROM dpauto_migrations ORDER BY name DESC LIMIT 1`,
  ))!;
  await api.db.db.execute(
    sql`UPDATE dpauto_migrations SET checksum='bad' WHERE name=${migration.name}`,
  );
  assert.equal(
    (await manager.call("GET", "internal/health/ready")).status,
    503,
  );
  await api.db.db.execute(
    sql`UPDATE dpauto_migrations SET checksum=${migration.checksum} WHERE name=${migration.name}`,
  );
});

test("P6 consistent backup restores only into an empty isolated database; cutover requires proof and preserves post-start deltas", async () => {
  await freeze();
  const cp = await task((c, ctx) =>
      checkpoint(c, ctx, "Chốt trước triển khai"),
    ),
    path = join(folder, "backup.dump");
  const backup = await backupDatabase(api.db, config, cp.id, path);
  assert.ok(backup.sha256);
  await assert.rejects(
    () =>
      restoreDatabase(
        config,
        path,
        config.databaseUrl,
        "postgres",
        join(folder, "forbidden.json"),
      ),
    (e) => (e as any).code === "RESTORE_TARGET_NOT_ISOLATED",
  );
  const name = "dpauto_restore_" + randomUUID().replace(/-/g, ""),
    target = new URL(config.databaseUrl);
  target.pathname = "/" + name;
  await api.db.db.execute(sql`CREATE DATABASE ${sql.identifier(name)}`);
  const report = join(folder, "restore.json");
  assert.equal(
    (await restoreDatabase(config, path, target.toString(), name, report))
      .verified,
    true,
  );
  await assert.rejects(
    () =>
      restoreDatabase(
        config,
        path,
        target.toString(),
        name,
        join(folder, "second.json"),
      ),
    (e) => (e as any).code === "RESTORE_TARGET_NOT_EMPTY",
  );
  const proof = await readProof(report, config.secret);
  await assert.rejects(
    () =>
      task((c, ctx) =>
        activateCutover(c, ctx, config, {
          checkpointId: cp.id,
          mode: "NEW_BUSINESS",
          approval: cp.fingerprint,
          restore: proof,
          trainingConfirmed: false,
          sourceFreezeConfirmed: false,
          reason: "Chưa đủ điều kiện",
        }),
      ),
    (e) => (e as any).code === "CUTOVER_SIGNOFF_REQUIRED",
  );
  const activated = await task((c, ctx) =>
    activateCutover(c, ctx, config, {
      checkpointId: cp.id,
      mode: "NEW_BUSINESS",
      approval: cp.fingerprint,
      restore: proof,
      trainingConfirmed: true,
      sourceFreezeConfirmed: false,
      reason: "Nghiệp vụ mới; hồ sơ cũ tiếp tục CRM",
    }),
  );
  assert.equal(activated.frozen, false);
  await createBooking(day(clock), "12:30");
  await freeze();
  const change = await task((c, ctx) => checkpointChanges(c, ctx, cp.id));
  assert.equal(change.rollback, "FORWARD_FIX_REQUIRED");
  assert.ok(change.changedTables.includes("bookings"));
  await assert.rejects(
    () => backupDatabase(api.db, config, cp.id, join(folder, "stale.dump")),
    (e) => (e as any).code === "CHECKPOINT_STALE",
  );
});
