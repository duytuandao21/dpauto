import { useLegacyVisitFixtures } from "./legacy-visit-fixture";
import { before, beforeEach, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { migrate } from "../scripts/migrate";
import { bootstrap } from "../scripts/bootstrap";
import { loadConfig } from "../src/config";
import { createApp } from "../src/app";
import { sql, one, rows } from "../src/database";

const url = process.env.DP_TEST_DATABASE_URL;
if (!url || !url.includes("dpauto_test@127.0.0.1:"))
  throw Error("Run through test:phase3; never target a business database.");
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
let technician: any;
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
  const tech = await manager.call("POST", "admin/staff", {
    name: "Kỹ thuật viên",
    phone: "0901234567",
    email: "tech@example.test",
    jobRole: "TECHNICIAN",
    active: true,
  });
  assert.equal(tech.status, 201, JSON.stringify(tech.body));
  technician = tech.body.data;
});
after(async () => {
  await app?.close();
});

let testDay = 12;
beforeEach(async () => {
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

test("Ticket UI empty draft does not expose the database default zero as an estimate", async () => {
  const id = await received();
  const draft = await ok(a, id, `admin/service-visits/${id}/quotes`);
  const stored = await one(api.db.db, sql`SELECT total::text AS total FROM quote_revisions WHERE id=${draft.revisionId}`);
  assert.equal(stored!.total, "0");
  const r = await a.call("GET", "admin/service-visits?ticketStage=QUOTE");
  assert.equal(r.status, 200);
  const row = r.body.data.find((value: any) => value.id === id);
  assert.equal(row.pricing.hasOpenQuote, true);
  assert.equal(row.pricing.estimateTotal, null);
  assert.equal(row.pricing.approvedTotal, null);
});

test("Ticket UI list preserves scoped search, exact pricing and cursor pagination", async () => {
  const first = await walk();
  const id = first.visit.visitId;
  const other = await walk(b);
  const list = async (suffix = "", client = a) => {
    const params = new URLSearchParams(suffix.replace(/^&/, ""));
    if (!params.has("limit")) params.set("limit", "20");
    const r = await client.call("GET", `admin/service-visits?${params}`);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body;
  };
  let row = (await list(`&q=${first.visit.code}`)).data[0];
  assert.equal(row.ticketStage, "QUOTE");
  assert.equal(row.pricing.approvedTotal, null);
  assert.equal(row.pricing.estimateTotal, null);
  assert.equal(row.pricing.payableTotal, null);
  for (const q of [
    first.visit.code,
    first.payload.vehicle.plate,
    "Toyota Vios",
    first.payload.customer.name,
    first.payload.customer.phone,
  ]) {
    assert.ok(
      (await list(`&q=${encodeURIComponent(q)}`)).data.some(
        (v: any) => v.id === id,
      ),
      q,
    );
  }
  assert.equal((await list(`&q=${other.visit.code}`)).data.length, 0);
  assert.equal((await b.call("GET", `admin/service-visits/${id}`)).status, 404);
  const page1 = await list("&limit=1", manager);
  assert.ok(page1.page.nextCursor);
  const page2 = await list(
    `&limit=1&cursor=${encodeURIComponent(page1.page.nextCursor)}`,
    manager,
  );
  assert.notEqual(page1.data[0].id, page2.data[0].id);
  assert.equal(
    (
      await a.call(
        "GET",
        `admin/service-visits?limit=1&cursor=${encodeURIComponent(page1.page.nextCursor)}`,
      )
    ).status,
    400,
  );
  await ok(a, id, `admin/service-visits/${id}/inspection`);
  const draft = await quote(id, "4500000", "SERVICE", false);
  row = (await list(`&q=${first.visit.code}&ticketStage=QUOTE`)).data[0];
  assert.equal(row.pricing.estimateTotal, "4500000");
  assert.equal(row.pricing.approvedTotal, null);
  await ok(a, id, `admin/quote-revisions/${draft.id}/decision`, {
    decision: "APPROVED",
    evidence,
  });
  const change = await quote(id, "500000", "SERVICE", false);
  row = (await list(`&q=${first.visit.code}`)).data[0];
  assert.equal(row.pricing.approvedTotal, "4500000");
  assert.equal(row.pricing.payableTotal, "4500000");
  assert.equal(row.pricing.hasOpenQuote, true);
  await ok(a, id, `admin/quote-revisions/${change.id}/decision`, {
    decision: "APPROVED",
    evidence,
  });
  const actor = await one(
    api.db.db,
    sql`SELECT id FROM users WHERE email_normalized='manager@example.test'`,
  );
  await api.db.db.execute(
    sql`INSERT INTO obligation_credits(visit_id,command_id,amount,reason,evidence,approved_by,occurred_at) VALUES(${id},${randomUUID()},200000,'Fixture credit','Fixture evidence',${actor!.id},${clock})`,
  );
  row = (await list(`&q=${first.visit.code}&ticketStage=WAITING_WORK`)).data[0];
  assert.equal(row.pricing.approvedTotal, "5000000");
  assert.equal(row.pricing.payableTotal, "4800000");
  const workflow = (await a.call("GET", `admin/service-visits/${id}/workflow`))
    .body.data;
  assert.equal(row.pricing.payableTotal, workflow.obligation.total);
  assert.equal(
    (await a.call("GET", "admin/service-visits?ticketStage=INVALID")).status,
    400,
  );
});

test("Ticket UI maps every workflow phase and exceptions without changing visit state on reads", async () => {
  const { visit } = await walk();
  const id = visit.visitId;
  const check = async (expected: string, stage: string) => {
    const before = (await a.call("GET", `admin/service-visits/${id}`)).body
      .data;
    const r = await a.call(
      "GET",
      `admin/service-visits?ticketStage=${expected}&q=${visit.code}`,
    );
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.data[0]?.ticketStage, expected);
    assert.equal(r.body.data[0]?.stage, stage);
    const after = (await a.call("GET", `admin/service-visits/${id}`)).body.data;
    assert.equal(after.version, before.version);
    assert.equal(after.stage, before.stage);
  };
  await check("QUOTE", "RECEIVED");
  await ok(a, id, `admin/service-visits/${id}/inspection`);
  const q = await quote(id);
  const i = await item(id, q.lines[0].id);
  await check("WAITING_WORK", "INSPECTED");
  await ok(a, id, `admin/service-visits/${id}/work/start`);
  await check("IN_PROGRESS", "IN_PROGRESS");
  await ok(a, id, `admin/service-visits/${id}/work/pause`);
  await check("PAUSED", "IN_PROGRESS");
  await ok(a, id, `admin/service-visits/${id}/work/resume`);
  await ok(a, id, `admin/work-items/${i.workItemId}/progress`, {
    status: "IN_PROGRESS",
  });
  await ok(a, id, `admin/work-items/${i.workItemId}/progress`, {
    status: "DONE",
  });
  await ok(a, id, `admin/service-visits/${id}/work/finish`);
  await check("QUALITY_CHECK", "QUALITY_CHECK");
  await ok(a, id, `admin/service-visits/${id}/acceptances`, {
    inspectorId: technician.id,
    result: "NEEDS_WORK",
    note: "Fixture needs rework",
    checks: [{ workItemId: i.workItemId, passed: false, note: "Needs rework" }],
  });
  await check("REWORK", "IN_PROGRESS");
  await ok(a, id, `admin/service-visits/${id}/work/resume`);
  await ok(a, id, `admin/work-items/${i.workItemId}/progress`, {
    status: "DONE",
  });
  await ok(a, id, `admin/service-visits/${id}/work/finish`);
  await passed(id, i.workItemId);
  await check("READY", "READY");
  await ok(a, id, `admin/service-visits/${id}/handover`, {
    recipientName: "Customer",
    evidenceNote: "Verified vehicle and keys",
    vehicleMoved: true,
    paymentBasis: "NO_CHARGE",
  });
  await check("HANDED_OVER", "HANDED_OVER");
  const active = await a.call(
    "GET",
    `admin/service-visits?activeOnly=true&q=${visit.code}`,
  );
  assert.equal(active.body.data.length, 0);
  const stopped = await walk();
  await ok(
    manager,
    stopped.visit.visitId,
    `admin/service-visits/${stopped.visit.visitId}/abort`,
    { evidenceNote: "Fixture: verified vehicle returned", vehicleMoved: true },
  );
  const r = await a.call(
    "GET",
    `admin/service-visits?ticketStage=ABORTED&q=${stopped.visit.code}`,
  );
  assert.equal(r.body.data[0]?.ticketStage, "ABORTED");
});

test("P3 quote submission freezes amounts, evidence and print snapshots; change orders are additive", async () => {
  assert.equal(
    (
      await rows(
        api.db.db,
        sql`SELECT tablename FROM pg_tables WHERE schemaname='public'`,
      )
    ).length,
    77,
  );
  const id = await received(),
    q = await quote(id, "100001");
  assert.equal(q.total, "100001");
  assert.equal(q.status, "APPROVED");
  const edit = await act(
    a,
    id,
    `admin/quote-revisions/${q.id}`,
    {
      calculationPolicy: "VND_LINE_HALF_UP_V1",
      discountPercent: "0",
      note: "Sửa đè",
      lines: [],
    },
    "PATCH",
  );
  assert.equal(edit.status, 400);
  await assert.rejects(
    api.db.db.execute(
      sql`UPDATE quote_lines SET unit_price=0 WHERE revision_id=${q.id}`,
    ),
  );
  await assert.rejects(
    api.db.db.execute(
      sql`UPDATE quote_revisions SET note='tamper' WHERE id=${q.id}`,
    ),
  );
  const second = await quote(id, "50000");
  assert.equal(second.kind, "CHANGE_ORDER");
  const data = await a.call("GET", `admin/service-visits/${id}/workflow`);
  assert.equal(data.body.data.obligation.total, "150001");
  const print = await a.call("GET", `admin/quote-revisions/${q.id}/print`);
  assert.equal(print.status, 200);
  assert.equal(print.body.data.revision.total, "100001");
  assert.equal(print.body.data.snapshot.customer.name, "Walk-in customer");
  assert.equal(JSON.stringify(print.body).includes("unitCost"), false);
});
test("P3 decisions require submitted revision, evidence, version and current advisor scope", async () => {
  const id = await received(),
    q = await quote(id, "0", "SERVICE", false);
  const invalid = await act(a, id, `admin/quote-revisions/${q.id}/decision`, {
    decision: "APPROVED",
  });
  assert.equal(invalid.status, 400);
  assert.equal(
    (await b.call("GET", `admin/quote-revisions/${q.id}/print`)).status,
    404,
  );
  const payload = {
      expectedVersion: (await a.call("GET", `admin/service-visits/${id}`)).body
        .data.version,
      reason: "Ghi nhận quyết định khách",
      decision: "APPROVED",
      evidence,
    },
    key = randomUUID();
  assert.equal(
    (
      await a.call(
        "POST",
        `admin/quote-revisions/${q.id}/decision`,
        payload,
        key,
      )
    ).status,
    200,
  );
  await ok(manager, id, `admin/service-visits/${id}/transfer`, {
    toAdvisorId: advisorB.id,
  });
  assert.equal(
    (await a.call("GET", `admin/service-visits/${id}/workflow`)).status,
    404,
  );
  assert.equal(
    (
      await a.call(
        "POST",
        `admin/quote-revisions/${q.id}/decision`,
        payload,
        key,
      )
    ).status,
    404,
  );
  assert.equal(
    (await b.call("GET", `admin/quote-revisions/${q.id}/print`)).status,
    200,
  );
});
test("P3 work requires approved scope and active technicians, without double capacity hold", async () => {
  const id = await received(),
    r = await item(id);
  const blocked = await act(a, id, `admin/service-visits/${id}/work/start`);
  assert.equal(blocked.status, 422);
  assert.equal(blocked.body.error.code, "WORK_NOT_AUTHORIZED");
  const q = await quote(id);
  await ok(
    a,
    id,
    `admin/work-items/${r.workItemId}`,
    { quoteLineId: q.lines[0].id },
    "PATCH",
  );
  const before = (await one(
    api.db.db,
    sql`SELECT sum(held_units)::int AS n FROM capacity_buckets WHERE starts_at>=${clock} AND starts_at<${new Date(+clock + 3600000)}`,
  ))!.n;
  await ok(a, id, `admin/service-visits/${id}/work/start`);
  const after = (await one(
    api.db.db,
    sql`SELECT sum(held_units)::int AS n FROM capacity_buckets WHERE starts_at>=${clock} AND starts_at<${new Date(+clock + 3600000)}`,
  ))!.n;
  assert.equal(after, before);
  assert.equal(
    (
      await rows(
        api.db.db,
        sql`SELECT * FROM resource_occupancies WHERE visit_id=${id} AND ended_at IS NULL`,
      )
    ).length,
    0,
  );
  const finish = await act(a, id, `admin/service-visits/${id}/work/finish`);
  assert.equal(finish.status, 422);
  assert.equal(finish.body.error.code, "WORK_INCOMPLETE");
  const staff = (
    await manager.call("GET", "admin/staff?limit=100")
  ).body.data.find((s: any) => s.id === technician.id);
  const disable = await manager.call("PATCH", `admin/staff/${technician.id}`, {
    expectedVersion: staff.version,
    reason: "Không được tắt KTV còn việc",
    active: false,
  });
  assert.equal(disable.status, 409);
  const techs = await a.call(
    "GET",
    "admin/staff?active=true&jobRole=TECHNICIAN",
  );
  assert.equal(techs.status, 200);
  assert.equal(techs.body.data[0].email, undefined);
});
test("P3 failed acceptance creates rework history; free handover releases once and closes the linked booking", async () => {
  const booking = await confirmed();
  const received = await a.call(
    "POST",
    `admin/bookings/${booking.bookingId}/receive`,
    await receivePayload(booking),
  );
  assert.equal(received.status, 201, JSON.stringify(received.body));
  const id = received.body.data.visitId;
  await ok(a, id, `admin/service-visits/${id}/inspection`);
  const { item: i } = await doneWork(id);
  await ok(a, id, `admin/service-visits/${id}/acceptances`, {
    inspectorId: technician.id,
    result: "NEEDS_WORK",
    note: "Cần làm sạch lại",
    checks: [{ workItemId: i.workItemId, passed: false, note: "Chưa sạch" }],
  });
  assert.equal(
    (await a.call("GET", `admin/service-visits/${id}`)).body.data.stage,
    "IN_PROGRESS",
  );
  await ok(a, id, `admin/service-visits/${id}/work/resume`);
  await ok(a, id, `admin/work-items/${i.workItemId}/progress`, {
    status: "DONE",
  });
  await ok(a, id, `admin/service-visits/${id}/work/finish`);
  await passed(id, i.workItemId);
  const payload = {
      expectedVersion: (await a.call("GET", `admin/service-visits/${id}`)).body
        .data.version,
      reason: "Khách nhận xe",
      recipientName: "Khách hàng",
      evidenceNote: "Đối chiếu xe và chìa khóa",
      vehicleMoved: true,
      paymentBasis: "NO_CHARGE",
    },
    key = randomUUID();
  const handed = await a.call(
    "POST",
    `admin/service-visits/${id}/handover`,
    payload,
    key,
  );
  assert.equal(handed.status, 200, JSON.stringify(handed.body));
  assert.equal(handed.body.data.stage, "HANDED_OVER");
  const replay = await a.call(
    "POST",
    `admin/service-visits/${id}/handover`,
    payload,
    key,
  );
  assert.equal(replay.status, 200);
  assert.equal(replay.body.data.handoverId, handed.body.data.handoverId);
  assert.equal(
    (await a.call("GET", `admin/bookings/${booking.bookingId}`)).body.data
      .status,
    "COMPLETED",
  );
  assert.equal(
    (await one(
      api.db.db,
      sql`SELECT count(*)::int AS n FROM resource_occupancies WHERE visit_id=${id} AND ended_at IS NULL`,
    ))!.n,
    0,
  );
  assert.equal(
    (await one(
      api.db.db,
      sql`SELECT count(*)::int AS n FROM capacity_reservations WHERE visit_id=${id} AND status='ACTIVE'`,
    ))!.n,
    0,
  );
  const history = (await a.call("GET", `admin/service-visits/${id}/workflow`))
    .body.data;
  assert.equal(history.acceptances.length, 2);
  assert.equal(history.paymentStatus, "SETTLED");
});
test("P3 paid visits cannot hand over and never fabricate a payment or release resources", async () => {
  const id = await received(),
    { item: i } = await doneWork(id, "120000");
  await passed(id, i.workItemId);
  const hand = await act(a, id, `admin/service-visits/${id}/handover`, {
    recipientName: "Khách",
    evidenceNote: "Chưa thu tiền trong hệ thống",
    vehicleMoved: true,
    paymentBasis: "NO_CHARGE",
  });
  assert.equal(hand.status, 409);
  assert.equal(hand.body.error.code, "PAYMENT_REQUIRED");
  assert.equal(
    (await a.call("GET", `admin/service-visits/${id}`)).body.data.stage,
    "READY",
  );
  const bypass = await act(manager, id, `admin/service-visits/${id}/handover`, {
    recipientName: "Khách",
    evidenceNote: "Tự ghi đã trả",
    vehicleMoved: true,
    paymentBasis: "MANAGER_CREDIT",
  });
  assert.equal(bypass.status, 400);
  assert.equal(
    (await one(
      api.db.db,
      sql`SELECT count(*)::int AS n FROM visit_handovers WHERE visit_id=${id}`,
    ))!.n,
    0,
  );
  assert.equal(
    (await one(
      api.db.db,
      sql`SELECT count(*)::int AS n FROM capacity_reservations WHERE visit_id=${id} AND status='ACTIVE'`,
    ))!.n,
    1,
  );
});
test("P3 ready bay release is explicit and does not hand over the vehicle or complete the booking", async () => {
  const id = await received(),
    { item: i } = await doneWork(id, "100");
  await passed(id, i.workItemId);
  const noAck = await act(
    a,
    id,
    `admin/service-visits/${id}/resources/release`,
    { vehicleMoved: false },
  );
  assert.equal(noAck.status, 400);
  await ok(a, id, `admin/service-visits/${id}/resources/release`, {
    vehicleMoved: true,
  });
  const current = (await a.call("GET", `admin/service-visits/${id}/workflow`))
    .body.data;
  assert.equal(current.stage, "READY");
  assert.equal(current.handover, null);
});
test("P3 manager free exemption supports no-quote work; abort preserves history and obeys settlement guards", async () => {
  const id = await received();
  const rejected = await act(
    a,
    id,
    `admin/service-visits/${id}/work-exemptions`,
    { mode: "NO_QUOTE_FREE", scope: "Kiểm tra miễn phí", evidence },
  );
  assert.equal(rejected.status, 403);
  const ex = await ok(
    manager,
    id,
    `admin/service-visits/${id}/work-exemptions`,
    { mode: "NO_QUOTE_FREE", scope: "Kiểm tra miễn phí", evidence },
  );
  const i = await item(id, undefined, ex.exemptionId);
  await ok(a, id, `admin/service-visits/${id}/work/start`);
  await ok(a, id, `admin/work-items/${i.workItemId}/progress`, {
    status: "IN_PROGRESS",
  });
  await ok(a, id, `admin/work-items/${i.workItemId}/progress`, {
    status: "DONE",
  });
  await ok(a, id, `admin/service-visits/${id}/work/finish`);
  await passed(id, i.workItemId);
  await ok(a, id, `admin/service-visits/${id}/handover`, {
    recipientName: "Khách",
    evidenceNote: "Bàn giao kiểm tra miễn phí",
    paymentBasis: "NO_CHARGE",
    vehicleMoved: true,
  });
  const next = await received();
  await ok(manager, next, `admin/service-visits/${next}/abort`, {
    evidenceNote: "Khách yêu cầu dừng trước thi công",
    vehicleMoved: true,
  });
  assert.equal(
    (await a.call("GET", `admin/service-visits/${next}`)).body.data.stage,
    "ABORTED",
  );
  const charged = await received();
  await quote(charged, "1000");
  const blocked = await act(
    manager,
    charged,
    `admin/service-visits/${charged}/abort`,
    { evidenceNote: "Không được xóa nghĩa vụ", vehicleMoved: true },
  );
  assert.equal(blocked.status, 409);
  assert.equal(blocked.body.error.code, "ABORT_SETTLEMENT_REQUIRED");
});
test("P3 rework and quote additions invalidate previous acceptance before resuming work", async () => {
  const id = await received(),
    { item: i } = await doneWork(id);
  await passed(id, i.workItemId);
  const extra = await quote(id, "0");
  assert.equal(
    (await a.call("GET", `admin/service-visits/${id}/workflow`)).body.data.work
      .status,
    "PAUSED",
  );
  const blocked = await act(a, id, `admin/service-visits/${id}/ready`);
  assert.equal(blocked.status, 409);
  await item(id, extra.lines[0].id);
  await ok(a, id, `admin/service-visits/${id}/work/resume`);
  assert.equal(
    (await a.call("GET", `admin/service-visits/${id}/workflow`)).body.data
      .acceptances.length,
    1,
  );
});
test("P3 immutable evidence and acceptance, scoped print, and cross-visit work references are protected", async () => {
  const id = await received(),
    q = await quote(id),
    i = await item(id, q.lines[0].id),
    other = await received();
  const cross = await act(
    a,
    other,
    `admin/service-visits/${other}/work-items`,
    {
      label: "Không dùng dòng của phiếu khác",
      quoteLineId: q.lines[0].id,
      technicianIds: [technician.id],
      dueAt: new Date(+clock + 3600000).toISOString(),
    },
  );
  assert.equal(cross.status, 422);
  await ok(a, id, `admin/service-visits/${id}/work/start`);
  await ok(a, id, `admin/work-items/${i.workItemId}/progress`, {
    status: "IN_PROGRESS",
  });
  await ok(a, id, `admin/work-items/${i.workItemId}/progress`, {
    status: "DONE",
  });
  await ok(a, id, `admin/service-visits/${id}/work/finish`);
  const accepted = await ok(a, id, `admin/service-visits/${id}/acceptances`, {
    inspectorId: technician.id,
    result: "PASSED",
    note: "Đã kiểm tra",
    checks: [{ workItemId: i.workItemId, passed: true, note: "" }],
  });
  assert.equal(
    (await a.call("GET", `admin/acceptances/${accepted.acceptanceId}/print`))
      .status,
    200,
  );
  assert.equal(
    (await b.call("GET", `admin/acceptances/${accepted.acceptanceId}/print`))
      .status,
    404,
  );
  await assert.rejects(
    api.db.db.execute(
      sql`DELETE FROM quote_decisions WHERE revision_id=${q.id}`,
    ),
  );
  await assert.rejects(
    api.db.db.execute(
      sql`UPDATE acceptances SET note='fake' WHERE id=${accepted.acceptanceId}`,
    ),
  );
  const current = (await a.call("GET", `admin/service-visits/${id}`)).body.data;
  assert.equal(current.stage, "QUALITY_CHECK");
  assert.equal(current.progress.inspectionCompleted, true);
  const active = await a.call("GET", "admin/service-visits?activeOnly=true");
  assert.ok(
    active.body.data.every(
      (v: any) => !["HANDED_OVER", "ABORTED"].includes(v.stage),
    ),
  );
});
