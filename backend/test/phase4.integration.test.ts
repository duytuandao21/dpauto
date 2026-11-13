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
  throw Error("Run through test:phase4; never target a business database.");
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
async function warehouse() {
  return success(manager, "POST", "admin/stock/warehouses", {
    code: "WH_" + randomUUID().slice(0, 8).toUpperCase(),
    name: "Kho thực trong fixture",
  });
}
async function part(unit = "Lần") {
  return success(manager, "POST", "admin/stock/parts", {
    code: "PART_" + randomUUID().slice(0, 8).toUpperCase(),
    name: "Lọc dầu",
    unit,
  });
}
async function draft(warehouseId: string, kind: string, lines: any[]) {
  return success(manager, "POST", "admin/stock/documents", {
    commandId: randomUUID(),
    warehouseId,
    kind,
    reason: "Chứng từ có căn cứ",
    counterparty: "Nhà cung cấp fixture",
    lines,
  });
}
async function postDoc(d: any) {
  return success(manager, "POST", `admin/stock/documents/${d.id}/post`, {
    expectedVersion: d.version,
    reason: "Xác nhận số lượng thực tế",
  });
}
async function stock(
  warehouseId: string,
  partId: string,
  qty = "2",
  unitCost = "100",
) {
  const d = await draft(warehouseId, "RECEIPT", [
    { partId, quantity: qty, unitCost },
  ]);
  await postDoc(d);
  return d;
}
async function getBalance(warehouseId: string, partId: string) {
  return (
    await success(
      manager,
      "GET",
      `admin/stock/balances?warehouseId=${warehouseId}&partId=${partId}`,
    )
  )[0];
}
async function requestPart(
  id: string,
  lineId: string,
  warehouseId: string,
  partId: string,
) {
  return ok(manager, id, `admin/service-visits/${id}/stock-requests`, {
    quoteLineId: lineId,
    warehouseId,
    partId,
  });
}
async function cash(id: string, amount: string) {
  return ok(manager, id, "admin/finance/payments", {
    commandId: randomUUID(),
    visitId: id,
    kind: "COLLECT",
    amount,
    method: "CASH",
    reference: "Thu tiền trực tiếp",
    payerName: "Khách hàng",
  });
}
async function payment(id: string) {
  return success(manager, "GET", "admin/finance/payments/" + id);
}
async function refund(
  id: string,
  amount: string,
  allocationId?: string,
  kind = "REFUND",
) {
  const p = await payment(id);
  return manager.call("POST", `admin/finance/payments/${id}/refund`, {
    commandId: randomUUID(),
    kind,
    amount,
    expectedRefundable: p.refundable,
    allocationId,
    method: "CASH",
    reference: "Chi trả thực tế",
    reason: "Điều chỉnh có căn cứ",
  });
}

test("P4 permissions do not grant money, adjustment or costs by job title; strict boundaries and immutable history", async () => {
  assert.equal(
    (await limited.call("GET", "admin/finance/payments")).status,
    403,
  );
  assert.equal(
    (
      await limited.call("POST", "admin/stock/parts", {
        code: "DENIED",
        name: "Không được tạo",
        unit: "cái",
      })
    ).status,
    403,
  );
  assert.equal((await a.call("GET", "admin/stock/parts")).status, 200);
  assert.equal((await a.call("GET", "admin/finance/payments")).status, 403);
  const w = await warehouse(),
    p = await part();
  await stock(w.id, p.id);
  const balance = (
    await success(limited, "GET", `admin/stock/balances?warehouseId=${w.id}`)
  )[0];
  assert.equal(balance.carryingValue, undefined);
  const receipts = await success(
      limited,
      "GET",
      `admin/stock/documents?warehouseId=${w.id}`,
    ),
    doc = await success(
      limited,
      "GET",
      "admin/stock/documents/" + receipts[0].id,
    );
  assert.equal(doc.lines[0].unitCost, undefined);
  assert.equal(doc.lines[0].valueDelta, undefined);
  await assert.rejects(
    api.db.db.execute(sql`DELETE FROM stock_ledger WHERE warehouse_id=${w.id}`),
  );
});
test("P4 moving average, partial returns, scrap, stocktake and stale counts reconcile to immutable stock ledger", async () => {
  const w = await warehouse(),
    p = await part();
  await stock(w.id, p.id, "2", "100");
  await stock(w.id, p.id, "2", "200");
  let balance = await getBalance(w.id, p.id);
  assert.equal(balance.onHand, "4.000");
  assert.equal(balance.carryingValue, "600");
  const count = await draft(w.id, "STOCKTAKE", [
    {
      partId: p.id,
      quantity: "5",
      unitCost: "150",
      expectedBalanceVersion: balance.version,
    },
  ]);
  await stock(w.id, p.id, "1", "100");
  assert.equal(
    (
      await manager.call("POST", `admin/stock/documents/${count.id}/post`, {
        expectedVersion: count.version,
        reason: "Số đếm đã cũ",
      })
    ).body.error.code,
    "COUNT_STALE",
  );
  balance = await getBalance(w.id, p.id);
  const count2 = await draft(w.id, "STOCKTAKE", [
    {
      partId: p.id,
      quantity: "4",
      unitCost: "0",
      expectedBalanceVersion: balance.version,
    },
  ]);
  await postDoc(count2);
  balance = await getBalance(w.id, p.id);
  assert.equal(balance.carryingValue, "560");
  const adjustment = await draft(w.id, "ADJUSTMENT", [
    { partId: p.id, quantity: "-5" },
  ]);
  assert.equal(
    (
      await manager.call(
        "POST",
        `admin/stock/documents/${adjustment.id}/post`,
        { expectedVersion: adjustment.version, reason: "Không được âm kho" },
      )
    ).status,
    409,
  );
  const sums = await one(
    api.db.db,
    sql`SELECT sum(quantity_delta)::text AS qty,sum(value_delta)::text AS value FROM stock_ledger WHERE warehouse_id=${w.id} AND part_id=${p.id}`,
  );
  assert.equal(sums!.qty, balance.onHand);
  assert.equal(sums!.value, balance.carryingValue);
});
test("P4 concurrent issues cannot oversell; posting replay and new command keys cannot double issue", async () => {
  const w = await warehouse(),
    p = await part();
  await stock(w.id, p.id, "1", "300");
  const first = await received(),
    second = await received(),
    q1 = await quote(first, "0", "PART"),
    q2 = await quote(second, "0", "PART");
  const r1 = await requestPart(first, q1.lines[0].id, w.id, p.id),
    r2 = await requestPart(second, q2.lines[0].id, w.id, p.id);
  const d1 = await draft(w.id, "ISSUE", [
      { partId: p.id, quantity: "1", requestId: r1.requestId },
    ]),
    d2 = await draft(w.id, "ISSUE", [
      { partId: p.id, quantity: "1", requestId: r2.requestId },
    ]);
  const key = randomUUID(),
    body = { expectedVersion: d1.version, reason: "Xuất có đối chiếu" };
  const results = await Promise.all([
    manager.call("POST", `admin/stock/documents/${d1.id}/post`, body, key),
    manager.call("POST", `admin/stock/documents/${d2.id}/post`, {
      ...body,
      expectedVersion: d2.version,
    }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const won = results[0].status === 200 ? d1 : d2;
  if (won.id === d1.id)
    assert.equal(
      (
        await manager.call(
          "POST",
          `admin/stock/documents/${d1.id}/post`,
          body,
          key,
        )
      ).status,
      200,
    );
  assert.equal((await getBalance(w.id, p.id)).onHand, "0.000");
  assert.equal(
    (
      await manager.call("POST", `admin/stock/documents/${won.id}/post`, {
        expectedVersion: won.version + 1,
        reason: "Không xuất lại",
      })
    ).body.error.code,
    "DOCUMENT_POSTED",
  );
  const issue = await success(
      manager,
      "GET",
      "admin/stock/documents/" + won.id,
    ),
    ret = await draft(w.id, "RETURN", [
      {
        partId: p.id,
        quantity: "0.5",
        originalLineId: issue.lines[0].id,
        returnCondition: "RESTOCK",
      },
    ]);
  await postDoc(ret);
  assert.equal((await getBalance(w.id, p.id)).onHand, "0.500");
  assert.equal((await getBalance(w.id, p.id)).carryingValue, "150");
  const scrap = await draft(w.id, "RETURN", [
    {
      partId: p.id,
      quantity: "0.5",
      originalLineId: issue.lines[0].id,
      returnCondition: "SCRAP",
    },
  ]);
  await postDoc(scrap);
  assert.equal((await getBalance(w.id, p.id)).onHand, "0.500");
  const tooMuch = await draft(w.id, "RETURN", [
    {
      partId: p.id,
      quantity: "0.001",
      originalLineId: issue.lines[0].id,
      returnCondition: "RESTOCK",
    },
  ]);
  assert.equal(
    (
      await manager.call("POST", `admin/stock/documents/${tooMuch.id}/post`, {
        expectedVersion: tooMuch.version,
        reason: "Không trả vượt đã xuất",
      })
    ).body.error.code,
    "RETURN_EXCEEDS_ISSUED",
  );
});
test("P4 stock reservation is partial and release is separate; duplicate request lines cannot exceed approved quantity", async () => {
  const w = await warehouse(),
    p = await part(),
    id = await received(),
    q = await quote(id, "0", "PART");
  await stock(w.id, p.id, "2", "99");
  const r = await requestPart(id, q.lines[0].id, w.id, p.id),
    requests = (await success(a, "GET", `admin/service-visits/${id}/workflow`))
      .stock.lines;
  await success(
    manager,
    "POST",
    `admin/stock/requests/${r.requestId}/reservation`,
    {
      expectedVersion: requests[0].request.version,
      action: "RESERVE",
      quantity: "0.5",
      reason: "Giữ một phần hàng",
    },
  );
  assert.equal((await getBalance(w.id, p.id)).reserved, "0.500");
  const bad = await draft(w.id, "ISSUE", [
    { partId: p.id, quantity: "0.6", requestId: r.requestId },
    { partId: p.id, quantity: "0.6", requestId: r.requestId },
  ]);
  assert.equal(
    (
      await manager.call("POST", `admin/stock/documents/${bad.id}/post`, {
        expectedVersion: bad.version,
        reason: "Không xuất vượt phạm vi",
      })
    ).status,
    409,
  );
  assert.equal((await getBalance(w.id, p.id)).onHand, "2.000");
  assert.equal((await getBalance(w.id, p.id)).reserved, "0.500");
  const latest = (
    await success(a, "GET", `admin/service-visits/${id}/workflow`)
  ).stock.lines[0].request;
  await success(
    manager,
    "POST",
    `admin/stock/requests/${r.requestId}/reservation`,
    {
      expectedVersion: latest.version,
      action: "RELEASE",
      quantity: "0.5",
      reason: "Trả giữ hàng",
    },
  );
  assert.equal((await getBalance(w.id, p.id)).reserved, "0.000");
});
test("P4 booking deposit allocates on reception exactly once, without a second cash entry", async () => {
  const booking = await confirmed(),
    b0 = await success(manager, "GET", "admin/bookings/" + booking.bookingId),
    key = randomUUID(),
    body = {
      commandId: randomUUID(),
      expectedVersion: b0.version,
      bookingId: booking.bookingId,
      kind: "DEPOSIT",
      amount: "100000",
      method: "BANK_TRANSFER",
      reference: "GD-DA-XAC-NHAN",
      payerName: "Khách đặt lịch",
      reason: "Đã đối chiếu chuyển khoản",
    };
  const deposit = await success(
    manager,
    "POST",
    "admin/finance/payments",
    body,
    key,
  );
  assert.equal(
    (await manager.call("POST", "admin/finance/payments", body, key)).status,
    201,
  );
  const fresh = await success(a, "GET", "admin/bookings/" + booking.bookingId);
  const received = await success(
    a,
    "POST",
    `admin/bookings/${booking.bookingId}/receive`,
    await receivePayload(fresh),
  );
  const current = await success(
    a,
    "GET",
    `admin/service-visits/${received.visitId}/workflow`,
  );
  assert.equal(current.settlement.netReceived, "100000");
  assert.equal(current.paymentStatus, "UNASSESSED");
  assert.equal(
    (await one(
      api.db.db,
      sql`SELECT count(*)::int AS n FROM cash_entries WHERE booking_id=${booking.bookingId}`,
    ))!.n,
    1,
  );
  assert.equal((await payment(deposit.id)).available, "0");
  assert.equal(
    (await b.call("GET", `admin/service-visits/${received.visitId}/workflow`))
      .status,
    404,
  );
  await assert.rejects(
    api.db.db.execute(
      sql`UPDATE cash_entries SET amount=1 WHERE id=${deposit.id}`,
    ),
  );
});
test("P4 refunds serialize against remaining funds; allocation, receipt and reversal are immutable and bounded", async () => {
  const id = await received(),
    paid = await cash(id, "100"),
    p = await payment(paid.id),
    allocationId = p.allocations[0].id;
  const body = {
    commandId: randomUUID(),
    kind: "REFUND",
    amount: "70",
    expectedRefundable: "100",
    allocationId,
    method: "CASH",
    reference: "PC-01",
    reason: "Hoàn có đối chiếu",
  };
  const results = await Promise.all([
    manager.call("POST", `admin/finance/payments/${paid.id}/refund`, body),
    manager.call("POST", `admin/finance/payments/${paid.id}/refund`, {
      ...body,
      commandId: randomUUID(),
    }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const current = await payment(paid.id);
  assert.equal(current.refundable, "30");
  assert.equal(
    (await refund(paid.id, "31", allocationId)).body.error.code,
    "REFUND_EXCEEDS_BALANCE",
  );
  const reversed = await refund(paid.id, "30", undefined, "REVERSAL");
  assert.equal(reversed.status, 200, JSON.stringify(reversed.body));
  assert.equal((await payment(paid.id)).refundable, "0");
  assert.equal(
    (await success(a, "GET", `admin/service-visits/${id}/workflow`)).settlement
      .netReceived,
    "0",
  );
  await assert.rejects(
    api.db.db.execute(
      sql`DELETE FROM cash_reductions WHERE entry_id=${reversed.body.data.id}`,
    ),
  );
  assert.equal(
    (
      await limited.call(
        "POST",
        `admin/finance/payments/${paid.id}/refund`,
        body,
      )
    ).status,
    403,
  );
});
test("P4 paid handover requires real allocated funds, fulfillment and current acceptance; credits allow audited refund and settled abort", async () => {
  const id = await received(),
    { item: i } = await doneWork(id, "10000");
  await passed(id, i.workItemId);
  const partial = await cash(id, "4000");
  assert.equal(
    (
      await act(a, id, `admin/service-visits/${id}/handover`, {
        recipientName: "Khách",
        evidenceNote: "Chưa thu đủ",
        vehicleMoved: true,
        paymentBasis: "SETTLED",
      })
    ).body.error.code,
    "PAYMENT_REQUIRED",
  );
  await cash(id, "6000");
  await ok(a, id, `admin/service-visits/${id}/handover`, {
    recipientName: "Khách",
    evidenceNote: "Đã đối chiếu xe và tiền",
    vehicleMoved: true,
    paymentBasis: "SETTLED",
  });
  const p = await payment(partial.id);
  assert.equal(
    (await refund(partial.id, "1", p.allocations[0].id)).body.error.code,
    "REFUND_REOPENS_SETTLED_VISIT",
  );
  await ok(manager, id, `admin/service-visits/${id}/credits`, {
    commandId: randomUUID(),
    amount: "100",
    evidence: "Khách đồng ý giảm giá sau kiểm tra",
    reason: "Điều chỉnh giảm có căn cứ",
  });
  assert.equal(
    (await refund(partial.id, "100", p.allocations[0].id)).status,
    200,
  );
  const report = await success(
    manager,
    "GET",
    `admin/finance/summary?from=${clock.toISOString().slice(0, 10)}&to=${clock.toISOString().slice(0, 10)}`,
  );
  assert.equal(report.cashIn, "10000");
  assert.equal(report.cashOut, "100");
  assert.equal(report.netCash, "9900");
  const next = await received();
  await quote(next, "100");
  const r = await cash(next, "100");
  await ok(manager, next, `admin/service-visits/${next}/credits`, {
    commandId: randomUUID(),
    amount: "100",
    evidence: "Khách hủy toàn bộ phạm vi, chưa làm",
    reason: "Giảm nghĩa vụ trước hoàn",
  });
  const entry = await payment(r.id);
  assert.equal(
    (await refund(r.id, "100", entry.allocations[0].id)).status,
    200,
  );
  await ok(manager, next, `admin/service-visits/${next}/abort`, {
    vehicleMoved: true,
    evidenceNote: "Đã hoàn và đối soát xong",
  });
});
test("P4 approved parts block acceptance until issued; returns invalidate previous quality approval", async () => {
  const w = await warehouse(),
    p = await part(),
    id = await received(),
    q = await quote(id, "10000"),
    parts = await quote(id, "5000", "PART"),
    r = await requestPart(id, parts.lines[0].id, w.id, p.id),
    i = await item(id, q.lines[0].id);
  await stock(w.id, p.id, "2", "3000");
  await ok(a, id, `admin/service-visits/${id}/work/start`);
  await ok(a, id, `admin/work-items/${i.workItemId}/progress`, {
    status: "IN_PROGRESS",
  });
  await ok(a, id, `admin/work-items/${i.workItemId}/progress`, {
    status: "DONE",
  });
  await ok(a, id, `admin/service-visits/${id}/work/finish`);
  const check = {
    inspectorId: technician.id,
    result: "PASSED",
    note: "Đã kiểm tra",
    checks: [{ workItemId: i.workItemId, passed: true, note: "" }],
  };
  assert.equal(
    (await act(a, id, `admin/service-visits/${id}/acceptances`, check)).body
      .error.code,
    "STOCK_SETTLEMENT_REQUIRED",
  );
  const issue = await draft(w.id, "ISSUE", [
    { partId: p.id, quantity: "1", requestId: r.requestId },
  ]);
  await postDoc(issue);
  await ok(a, id, `admin/service-visits/${id}/work/resume`);
  await ok(a, id, `admin/service-visits/${id}/work/finish`);
  await passed(id, i.workItemId);
  const issued = await success(
      manager,
      "GET",
      "admin/stock/documents/" + issue.id,
    ),
    returned = await draft(w.id, "RETURN", [
      {
        partId: p.id,
        quantity: "1",
        originalLineId: issued.lines[0].id,
        returnCondition: "RESTOCK",
      },
    ]);
  await postDoc(returned);
  const changed = await success(
    a,
    "GET",
    `admin/service-visits/${id}/workflow`,
  );
  assert.equal(changed.stage, "IN_PROGRESS");
  assert.equal(changed.stock.fulfilled, false);
  assert.ok(changed.acceptances[0].scopeVersion !== changed.work.scopeVersion);
});
test("P4 customer credit needs no fake booking; allocations, credits and reconciliation report actual remaining obligations", async () => {
  assert.equal(
    (
      await rows(
        api.db.db,
        sql`SELECT tablename FROM pg_tables WHERE schemaname='public'`,
      )
    ).length,
    77,
  );
  const deposit = await success(manager, "POST", "admin/finance/payments", {
    commandId: randomUUID(),
    expectedVersion: 1,
    customer: { name: "Khách gửi cọc chưa hẹn", phone: "0901234567" },
    kind: "DEPOSIT",
    amount: "100",
    method: "CASH",
    reference: "Cọc trực tiếp",
    payerName: "Khách gửi cọc",
    reason: "Chưa có lịch hẹn",
  });
  const original = await payment(deposit.id);
  assert.equal(original.bookingId, null);
  assert.equal(original.visitId, null);
  assert.ok(original.customerId);
  const before = await success(
    manager,
    "GET",
    "admin/customers/" + original.customerId,
  );
  assert.equal(before.name, "Khách gửi cọc chưa hẹn");
  const received = await walk(manager, {
      customer: { id: original.customerId },
      advisorId: advisorA.id,
    }),
    id = received.visit.visitId;
  await quote(id, "300");
  await ok(manager, id, `admin/finance/payments/${deposit.id}/allocate`, {
    commandId: randomUUID(),
    visitId: id,
    amount: "50",
    expectedAvailable: "100",
  });
  assert.equal((await refund(deposit.id, "20")).status, 200);
  await ok(manager, id, `admin/finance/payments/${deposit.id}/allocate`, {
    commandId: randomUUID(),
    visitId: id,
    amount: "30",
    expectedAvailable: "30",
  });
  let workflow = await success(a, "GET", `admin/service-visits/${id}/workflow`);
  assert.equal(workflow.settlement.netReceived, "80");
  assert.equal(workflow.settlement.outstanding, "220");
  assert.equal(
    (await refund(deposit.id, "80", undefined, "REVERSAL")).status,
    200,
  );
  await ok(manager, id, `admin/service-visits/${id}/credits`, {
    commandId: randomUUID(),
    amount: "100",
    reason: "Giảm phần việc theo khách xác nhận",
    evidence: "Đã thống nhất với khách",
  });
  workflow = await success(a, "GET", `admin/service-visits/${id}/workflow`);
  assert.equal(workflow.settlement.total, "200");
  assert.equal(workflow.financialCredits[0].amount, "100");
  const report = await success(
    manager,
    "GET",
    `admin/finance/summary?from=${clock.toISOString().slice(0, 10)}&to=${clock.toISOString().slice(0, 10)}`,
  );
  assert.equal(report.cashIn, "100");
  assert.equal(report.cashOut, "100");
  assert.equal(report.netCash, "0");
  assert.equal(report.outstanding, "200");
  const accounts = await success(
    manager,
    "GET",
    "admin/finance/accounts?outstandingOnly=true",
  );
  assert.ok(
    accounts.some((v: any) => v.id === id && v.balance.total === "200"),
  );
  assert.equal(
    (
      await act(manager, id, `admin/service-visits/${id}/credits`, {
        commandId: randomUUID(),
        amount: "201",
        evidence: "Không được giảm quá nghĩa vụ",
      })
    ).status,
    409,
  );
  const other = await receivedOther();
  const cross = await act(
    manager,
    other,
    `admin/finance/payments/${deposit.id}/allocate`,
    {
      commandId: randomUUID(),
      visitId: other,
      amount: "1",
      expectedAvailable: "0",
    },
  );
  assert.equal(cross.body.error.code, "PAYMENT_SUBJECT_INVALID");
  const w = await warehouse(),
    p = await part();
  await stock(w.id, p.id);
  assert.deepEqual(
    await success(manager, "GET", "admin/stock/reconciliation"),
    [],
  );
  await api.db.db.execute(
    sql`UPDATE stock_balances SET on_hand=on_hand+1 WHERE warehouse_id=${w.id} AND part_id=${p.id}`,
  );
  const differences = await success(
    manager,
    "GET",
    "admin/stock/reconciliation",
  );
  assert.equal(differences[0].partId, p.id);
  assert.equal(differences[0].ledgerQuantity, "2.000");
});
async function receivedOther() {
  const r = await walk();
  return r.visit.visitId as string;
}
test("P4 amount boundaries roll back excess collections, allocations and approved obligations; external transfers cannot be posted twice", async () => {
  const id = await received(),
    maximum = "999999999999999999";
  await cash(id, maximum);
  const tooMuch = await act(manager, id, "admin/finance/payments", {
    commandId: randomUUID(),
    visitId: id,
    kind: "COLLECT",
    amount: "1",
    method: "CASH",
    reference: "Không vượt miền tiền",
    payerName: "Khách",
  });
  assert.equal(tooMuch.status, 422);
  assert.equal(
    (await success(a, "GET", `admin/service-visits/${id}/workflow`)).settlement
      .netReceived,
    maximum,
  );
  const v = await success(a, "GET", `admin/service-visits/${id}`),
    customer = await success(manager, "GET", "admin/customers/" + v.customerId),
    body = {
      commandId: randomUUID(),
      expectedVersion: customer.version,
      customerId: customer.id,
      kind: "DEPOSIT",
      amount: "1",
      method: "BANK_TRANSFER",
      reference: "BANK-UNIQUE-TRANSFER",
      payerName: "Khách",
      reason: "Đã đối chiếu giao dịch",
    };
  const deposit = await success(
    manager,
    "POST",
    "admin/finance/payments",
    body,
  );
  assert.equal(
    (
      await manager.call("POST", "admin/finance/payments", {
        ...body,
        commandId: randomUUID(),
      })
    ).status,
    409,
  );
  const allocate = await act(
    manager,
    id,
    `admin/finance/payments/${deposit.id}/allocate`,
    {
      commandId: randomUUID(),
      visitId: id,
      amount: "1",
      expectedAvailable: "1",
    },
  );
  assert.equal(allocate.status, 422);
  assert.equal((await payment(deposit.id)).available, "1");
  const q = await ok(a, id, `admin/service-visits/${id}/quotes`);
  await ok(
    a,
    id,
    `admin/quote-revisions/${q.revisionId}`,
    {
      calculationPolicy: "VND_LINE_HALF_UP_V1",
      discountPercent: "0",
      note: "Kiểm tra giới hạn",
      lines: [
        {
          kind: "PART",
          name: "Phạm vi lớn",
          code: "BIG",
          unit: "Lần",
          quantity: "1000",
          unitPrice: "999999999999999",
          discountPercent: "0",
          vatPercent: "0",
        },
      ],
    },
    "PATCH",
  );
  await ok(a, id, `admin/quote-revisions/${q.revisionId}/submit`);
  await ok(a, id, `admin/quote-revisions/${q.revisionId}/decision`, {
    decision: "APPROVED",
    evidence,
  });
  const next = await quote(id, "1000", "PART", false),
    approve = await act(a, id, `admin/quote-revisions/${next.id}/decision`, {
      decision: "APPROVED",
      evidence,
    });
  assert.equal(approve.status, 422);
  assert.equal(
    (await success(a, "GET", `admin/service-visits/${id}/workflow`)).quotes.at(
      -1,
    ).status,
    "SUBMITTED",
  );
});
