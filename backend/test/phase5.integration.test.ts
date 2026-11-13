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

const url = process.env.DP_TEST_DATABASE_URL;
if (!url || !url.includes("dpauto_test@127.0.0.1:"))
  throw Error("Run through test:phase5; never target a business database.");
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

const baseContent = () => ({
  title: "Nội dung chính thức",
  description: "Chăm sóc xe",
  imageId: null,
  blocks: [
    {
      tag: "p",
      text: "Nội dung <script>alert(1)</script> được giữ là văn bản",
    },
  ],
  noindex: false,
  category: "",
});
async function asset() {
  const dataUrl =
    "data:image/jpeg;base64," +
    (await readFile(resolve(__dirname, "fixtures/reception.jpg"))).toString(
      "base64",
    );
  return success(manager, "POST", "admin/cms/assets", {
    name: "garage.jpg",
    alt: "Đội ngũ tại gara",
    dataUrl,
  });
}

test("P5 pure intervals and CSV protect leave boundaries and formula cells", () => {
  assert.deepEqual(
    shiftHours(
      [{ start: 0, end: 100 }],
      [
        { kind: "WORK", start: 20, end: 90 },
        { kind: "LEAVE", start: 40, end: 60 },
      ],
    ),
    [
      { start: 20, end: 40 },
      { start: 60, end: 90 },
    ],
  );
  assert.deepEqual(
    shiftHours(
      [{ start: 0, end: 100 }],
      [{ kind: "LEAVE", start: 0, end: 100 }],
    ),
    [],
  );
  assert.equal(
    csv([["a,b", '"quoted"', "=1+1", " \t@cmd", "-1", "normal\r\nline"]]),
    '"a,b","""quoted""","\'=1+1","\' \t@cmd","\'-1","normal\r\nline"',
  );
});

test("P5 CMS role has no operational permissions, grants cannot cross roles and sessions revoke", async () => {
  const cms = await success(manager, "POST", "admin/staff", {
    name: "CMS Editor",
    phone: "0901234567",
    email: "cms@example.test",
    jobRole: "MANAGER",
    active: true,
    account: {
      email: "cms@example.test",
      temporaryPassword: password,
      role: "CMS_ADMIN",
      permissions: ["cms.read", "cms.write", "cms.publish"],
    },
  });
  const editor = new Client();
  await editor.login("cms@example.test");
  await success(editor, "POST", "admin/auth/change-password", {
    currentPassword: password,
    newPassword: changed,
  });
  for (const path of [
    "admin/dashboard?date=" + day(clock),
    "admin/customers",
    "admin/stock/balances",
    "admin/finance/summary?from=" + day(clock) + "&to=" + day(clock),
    "admin/operations/summary?from=" + day(clock) + "&to=" + day(clock),
    "admin/staff",
    "admin/notifications",
  ])
    assert.equal((await editor.call("GET", path)).status, 403, path);
  assert.equal((await editor.call("GET", "admin/cms/documents")).status, 200);
  assert.equal((await a.call("GET", "admin/cms/documents")).status, 403);
  const doc = await success(editor, "POST", "admin/cms/documents", {
    kind: "PAGE",
    key: "home.services",
    payload: baseContent(),
  });
  assert.equal(
    (await editor.call("GET", "admin/cms/documents/" + doc.id)).status,
    200,
  );
  assert.equal(
    (
      await manager.call("PATCH", "admin/staff/" + cms.id, {
        expectedVersion: 1,
        reason: "Giới hạn quyền nội dung",
        account: { permissions: ["cms.read", "finance.read"] },
      })
    ).status,
    422,
  );
  await success(manager, "PATCH", "admin/staff/" + cms.id, {
    expectedVersion: 1,
    reason: "Chỉ cho xem nội dung",
    account: { permissions: ["cms.read"] },
  });
  assert.equal((await editor.call("GET", "admin/cms/documents")).status, 401);
  await editor.login("cms@example.test", changed);
  assert.equal(
    (
      await editor.call("POST", "admin/cms/documents", {
        kind: "PAGE",
        key: "home.pricing",
        payload: baseContent(),
      })
    ).status,
    403,
  );
});

test("P5 CMS draft/publish/withdraw is atomic, idempotent and keeps media private until publication", async () => {
  const image = await asset(),
    payload = { ...baseContent(), imageId: image.id },
    key = randomUUID();
  const input = { kind: "PAGE", key: "home.hero", payload };
  const doc = await success(manager, "POST", "admin/cms/documents", input, key);
  assert.equal(
    (await success(manager, "POST", "admin/cms/documents", input, key)).id,
    doc.id,
  );
  const pub = () => success(new Client(), "GET", "public/content");
  assert.equal(
    (await pub()).items.some((d: any) => d.key === "home.hero"),
    false,
  );
  assert.equal(
    (await new Client().call("GET", "public/cms/assets/" + image.id)).status,
    404,
  );
  assert.equal(
    (await manager.call("GET", "admin/cms/assets/" + image.id)).status,
    200,
  );
  assert.equal(
    (await a.call("GET", "admin/cms/assets/" + image.id)).status,
    403,
  );
  const published = await success(
    manager,
    "POST",
    `admin/cms/documents/${doc.id}/publish`,
    {
      expectedVersion: doc.version,
      revisionId: doc.revisionId,
      reason: "Duyệt nội dung",
    },
  );
  assert.equal(
    (await new Client().call("GET", "public/cms/assets/" + image.id)).status,
    200,
  );
  const draft = await success(
    manager,
    "PATCH",
    "admin/cms/documents/" + doc.id,
    {
      expectedVersion: published.version,
      payload: { ...payload, title: "BẢN NHÁP KHÔNG PUBLIC" },
    },
  );
  assert.equal(
    (await pub()).items.find((d: any) => d.key === "home.hero").payload.title,
    payload.title,
  );
  const stale = await manager.call(
    "POST",
    `admin/cms/documents/${doc.id}/publish`,
    {
      expectedVersion: published.version,
      revisionId: draft.revisionId,
      reason: "Tab cũ",
    },
  );
  assert.equal(stale.status, 409);
  assert.equal(
    (await pub()).items.find((d: any) => d.key === "home.hero").payload.title,
    payload.title,
  );
  const second = await success(
    manager,
    "POST",
    `admin/cms/documents/${doc.id}/publish`,
    {
      expectedVersion: draft.version,
      revisionId: draft.revisionId,
      reason: "Duyệt bản hai",
    },
  );
  await success(manager, "POST", `admin/cms/documents/${doc.id}/withdraw`, {
    expectedVersion: second.version,
    reason: "Gỡ nội dung",
  });
  const gone = (await pub()).items.find((d: any) => d.key === "home.hero");
  assert.equal(gone.withdrawn, true);
  assert.equal(gone.payload, null);
  assert.equal(
    (await new Client().call("GET", "public/cms/assets/" + image.id)).status,
    404,
  );
  await assert.rejects(() =>
    api.db.db.execute(
      sql`UPDATE cms_revisions SET payload='{}'::jsonb WHERE id=${doc.revisionId}`,
    ),
  );
  const invalid = await manager.call("POST", "admin/cms/assets", {
    name: "bad.svg",
    alt: "bad",
    dataUrl: "data:image/svg+xml;base64,PHN2Zy8+",
  });
  assert.equal(invalid.status, 422);
});

test("P5 news and SEO use strict keys and immutable published snapshots", async () => {
  const image = await asset(),
    payload = { ...baseContent(), date: day(clock), imageId: image.id };
  assert.equal(
    (
      await manager.call("POST", "admin/cms/documents", {
        kind: "NEWS",
        key: "../private",
        payload,
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await manager.call("POST", "admin/cms/documents", {
        kind: "SEO",
        key: "/admin",
        payload,
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await manager.call("POST", "admin/cms/documents", {
        kind: "PAGE",
        key: "chinh-sach-dat-lich",
        payload,
      })
    ).status,
    422,
  );
  const news = await success(manager, "POST", "admin/cms/documents", {
    kind: "NEWS",
    key: "bai-viet-moi",
    payload,
  });
  await success(manager, "POST", `admin/cms/documents/${news.id}/publish`, {
    expectedVersion: news.version,
    revisionId: news.revisionId,
    reason: "Đăng bài",
  });
  const found = (
    await success(new Client(), "GET", "public/content")
  ).items.find((d: any) => d.key === "bai-viet-moi");
  assert.equal(found.payload.blocks[0].text, payload.blocks[0].text);
  assert.equal("createdBy" in found, false);
  const seo = await success(manager, "POST", "admin/cms/documents", {
    kind: "SEO",
    key: "/news/bai-viet-moi",
    payload: { ...payload, noindex: true },
  });
  assert.equal(
    (
      await manager.call("POST", `admin/cms/documents/${seo.id}/publish`, {
        expectedVersion: seo.version,
        revisionId: news.revisionId,
        reason: "Sai phiên bản",
      })
    ).status,
    422,
  );
});

test("P5 operations totals, denominators, alerts and CSV use the actor scope and correct date basis", async () => {
  const own = await walk(),
    other = await walk(b),
    date = day(clock),
    query = `?from=${date}&to=${date}`;
  const m = await success(manager, "GET", "admin/operations/summary" + query),
    aa = await success(a, "GET", "admin/operations/summary" + query),
    bb = await success(b, "GET", "admin/operations/summary" + query);
  assert.equal(m.received, 2);
  assert.equal(aa.received, 1);
  assert.equal(bb.received, 1);
  assert.equal(aa.scope, "OWN");
  assert.deepEqual(m.completionRate, { numerator: 0, denominator: 2 });
  assert.deepEqual(m.noShowRate, { numerator: 0, denominator: 0 });
  assert.equal(aa.finance, undefined);
  assert.ok(m.finance);
  await quote(own.visit.visitId, "0", "SERVICE", false);
  const alerts = await success(a, "GET", "admin/operations/alerts");
  assert.ok(alerts.some((n: any) => n.subjectId === own.visit.visitId));
  assert.ok(!alerts.some((n: any) => n.subjectId === other.visit.visitId));
  const file = await success(
    manager,
    "GET",
    "admin/operations/export" + query + "&type=VISITS",
  );
  assert.equal(file.count, 2);
  assert.ok(file.csv.includes(own.visit.code));
  assert.equal(
    (await a.call("GET", "admin/operations/export" + query + "&type=VISITS"))
      .status,
    403,
  );
  assert.equal(
    (
      await limited.call(
        "GET",
        "admin/operations/export" + query + "&type=CASH",
      )
    ).status,
    403,
  );
  assert.ok(
    await one(
      api.db.db,
      sql`SELECT id FROM audit_logs WHERE action='REPORT_EXPORTED'`,
    ),
  );
  assert.equal(
    (
      await manager.call(
        "GET",
        "admin/operations/summary?from=2026-01-01&to=2026-12-31",
      )
    ).status,
    422,
  );
});

test("P5 technician cannot start work outside the declared shift", async () => {
  const id = await received(),
    q = await quote(id);
  await item(id, q.lines[0].id);
  const date = day(clock);
  await success(manager, "POST", "admin/staff-shifts", {
    staffId: technician.id,
    kind: "WORK",
    startsAt: date + "T11:00:00+07:00",
    endsAt: date + "T18:00:00+07:00",
    note: "Ca làm đã phân công",
  });
  const r = await act(a, id, `admin/service-visits/${id}/work/start`);
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, "TECHNICIAN_OFF_SHIFT");
  assert.equal(
    (await one(
      api.db.db,
      sql`SELECT count(*)::int AS n FROM resource_occupancies WHERE visit_id=${id} AND ended_at IS NULL`,
    ))!.n,
    0,
  );
});

test("P5 outbox concurrent claims deduplicate inbox, preserve transfer scope and block Zalo sends", async () => {
  await api.db.db.execute(
    sql`UPDATE outbox_jobs SET status='PROCESSED' WHERE kind IN ('BOOKING_EVENT','VISIT_EVENT')`,
  );
  const { visit } = await walk();
  await api.db.db.execute(
    sql`UPDATE outbox_jobs SET scheduled_at=${clock} WHERE aggregate_id=${visit.visitId}`,
  );
  const results = await Promise.all([
    api.notifications.work(1),
    api.notifications.work(1),
  ]);
  assert.equal(
    results.reduce((n, r) => n + r.processed, 0),
    1,
  );
  const inbox = await success(a, "GET", "admin/notifications"),
    notice = inbox.find((n: any) => n.subjectId === visit.visitId);
  assert.ok(notice);
  assert.ok(!notice.title.includes("0900"));
  assert.equal(
    (await success(b, "GET", "admin/notifications")).some(
      (n: any) => n.id === notice.id,
    ),
    false,
  );
  const count = (await one(
    api.db.db,
    sql`SELECT count(*)::int AS n FROM notifications WHERE subject_id=${visit.visitId}`,
  ))!.n;
  await api.notifications.work();
  assert.equal(
    (await one(
      api.db.db,
      sql`SELECT count(*)::int AS n FROM notifications WHERE subject_id=${visit.visitId}`,
    ))!.n,
    count,
  );
  assert.ok(
    await one(
      api.db.db,
      sql`SELECT id FROM notification_deliveries WHERE channel='ZALO' AND status='BLOCKED' AND error_code='PROVIDER_NOT_CONFIGURED'`,
    ),
  );
  await ok(
    manager,
    visit.visitId,
    `admin/service-visits/${visit.visitId}/transfer`,
    { toAdvisorId: advisorB.id },
  );
  assert.equal(
    (await success(a, "GET", "admin/notifications")).some(
      (n: any) => n.id === notice.id,
    ),
    false,
  );
  assert.equal(
    (
      await a.call("POST", `admin/notifications/${notice.id}/read`, {
        expectedVersion: notice.version,
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await b.call("POST", `admin/notifications/${notice.id}/read`, {
        expectedVersion: notice.version,
      })
    ).status,
    404,
  );
});

test("P5 provider failure retries with leases, logs and a five-attempt ceiling without undoing business data", async () => {
  await api.db.db.execute(
    sql`UPDATE outbox_jobs SET status='PROCESSED' WHERE kind IN ('BOOKING_EVENT','VISIT_EVENT')`,
  );
  const { visit } = await walk();
  await api.db.db.execute(
    sql`UPDATE outbox_jobs SET scheduled_at=${clock} WHERE aggregate_id=${visit.visitId}`,
  );
  const failing = new Notifications(api.db, config, {
    deliver: async () => {
      throw Error("no secret should be logged");
    },
  });
  assert.equal((await failing.work(1)).failed, 1);
  let job = (await one(
    api.db.db,
    sql`SELECT * FROM outbox_jobs WHERE aggregate_id=${visit.visitId} AND kind='VISIT_EVENT'`,
  ))!;
  assert.equal(job.status, "FAILED");
  assert.equal(job.attempts, 1);
  assert.equal(job.last_error_code, "DELIVERY_FAILED");
  assert.equal((await failing.work(1)).claimed, 0);
  const recipients = (await one(
    api.db.db,
    sql`SELECT count(*)::int AS n FROM notifications WHERE subject_id=${visit.visitId}`,
  ))!.n;
  await success(manager, "POST", `admin/notification-jobs/${job.id}/retry`, {
    expectedVersion: job.version,
    reason: "Thử lại sau sự cố",
  });
  assert.equal((await api.notifications.work(1)).processed, 1);
  assert.equal(
    (await one(
      api.db.db,
      sql`SELECT count(*)::int AS n FROM notifications WHERE subject_id=${visit.visitId}`,
    ))!.n,
    recipients,
  );
  await api.db.db.execute(
    sql`UPDATE outbox_jobs SET status='PROCESSING',attempts=4,lease_token=gen_random_uuid(),lease_until=${new Date(+clock - 1000)} WHERE id=${job.id}`,
  );
  assert.equal((await failing.work(1)).failed, 1);
  job = (await one(
    api.db.db,
    sql`SELECT * FROM outbox_jobs WHERE id=${job.id}`,
  ))!;
  assert.equal(job.attempts, 5);
  assert.equal(
    (
      await manager.call("POST", `admin/notification-jobs/${job.id}/retry`, {
        expectedVersion: job.version,
        reason: "Vượt giới hạn",
      })
    ).status,
    409,
  );
  assert.equal(
    (await success(a, "GET", "admin/service-visits/" + visit.visitId)).stage,
    "RECEIVED",
  );
  assert.equal((await a.call("GET", "admin/notification-jobs")).status, 403);
});

test("P5 shift changes protect active technicians independently of booking slots", async () => {
  const date = day(clock);
  const id = await received(),
    q = await quote(id);
  await item(id, q.lines[0].id);
  await ok(a, id, `admin/service-visits/${id}/work/start`);
  const leave = await manager.call("POST", "admin/staff-shifts", {
    staffId: technician.id,
    kind: "LEAVE",
    startsAt: date + "T10:30:00+07:00",
    endsAt: date + "T11:30:00+07:00",
    note: "Nghỉ giữa ca",
  });
  assert.equal(leave.status, 409);
  assert.equal(leave.body.error.code, "CAPACITY_IMPACT");
});
