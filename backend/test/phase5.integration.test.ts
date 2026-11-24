import { useLegacyVisitFixtures } from "./legacy-visit-fixture";
import { before, beforeEach, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { migrate } from "../scripts/migrate";
import { bootstrap } from "../scripts/bootstrap";
import { loadConfig } from "../src/config";
import { createApp } from "../src/app";
import { sql, one, rows } from "../src/database";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";
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
    MEDIA_LOCAL_DIR: join(tmpdir(), "dpauto-media-" + randomUUID()),
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
  async upload(body: Buffer, name: string, alt: string, key?: string) {
    const response = await app.inject({
      method: "POST",
      url:
        "/api/v1/admin/cms/assets?" +
        new URLSearchParams({ name, alt }).toString(),
      remoteAddress: "127.0.0." + ((sequence++ % 200) + 10),
      headers: {
        origin: config.origin,
        cookie: this.cookie,
        "content-type": "application/octet-stream",
        "x-csrf-token": this.csrf,
        "idempotency-key": key || randomUUID(),
      },
      payload: body,
    });
    return {
      status: response.statusCode,
      body: response.body ? JSON.parse(response.body) : {},
    };
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
  // Date.UTC rolls past the month's end, so the suite can grow beyond 18 cases.
  clock = new Date(Date.UTC(2026, 10, ++testDay, 3));
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
let assetSeed = 0;
/** A distinct photo per call, so content-hash de-duplication does not merge test fixtures. */
async function asset() {
  const body = await sharp({
    create: {
      width: 1400,
      height: 900,
      channels: 3,
      background: { r: 180, g: 20, b: (++assetSeed * 7) % 256 },
    },
  })
    .jpeg()
    .toBuffer();
  const r = await manager.upload(body, "garage.jpg", "Đội ngũ tại gara");
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.data;
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
    302,
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
  const live = await new Client().call("GET", "public/cms/assets/" + image.id);
  assert.equal(live.status, 302);
  assert.match(
    String(live.headers.location),
    /^\/api\/v1\/public\/media\/media\/[a-f0-9]{64}\/w1400\.webp$/,
  );
  const feed = (await pub()).items.find((d: any) => d.key === "home.hero");
  assert.equal(feed.payload.image.id, image.id);
  assert.deepEqual(
    feed.payload.image.webp.map((v: any) => v.width),
    [320, 640, 960, 1280, 1400],
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
  // An image another document also uses must survive the withdraw.
  const shared = await asset();
  await success(manager, "POST", "admin/cms/documents", {
    kind: "PAGE",
    key: "home.process",
    payload: { ...baseContent(), imageId: shared.id },
  });
  const third = await success(manager, "PATCH", "admin/cms/documents/" + doc.id, {
    expectedVersion: second.version,
    payload: { ...payload, imageId: shared.id },
  });
  await success(manager, "POST", `admin/cms/documents/${doc.id}/withdraw`, {
    expectedVersion: third.version,
    reason: "Gỡ nội dung",
  });
  // Withdrawing deletes the item's own images from storage for good.
  assert.equal(
    (await manager.call("GET", "admin/cms/assets/" + image.id)).status,
    404,
  );
  assert.equal(
    (await manager.call("GET", "admin/cms/assets/" + shared.id)).status,
    302,
  );
  const gone = (await pub()).items.find((d: any) => d.key === "home.hero");
  assert.equal(gone.withdrawn, true);
  assert.equal(gone.payload, null);
  assert.equal(
    (await new Client().call("GET", "public/cms/assets/" + image.id)).status,
    404,
  );
  // No version history: publishing removed the older revisions, withdrawing kept only the latest.
  assert.equal(
    (
      await api.db.db.execute(
        sql`SELECT id FROM cms_revisions WHERE document_id=${doc.id}`,
      )
    ).rows.length,
    1,
  );
  const invalid = await manager.upload(
    Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
    "bad.svg",
    "bad",
  );
  assert.equal(invalid.status, 422);
  const json = await manager.call("POST", "admin/cms/assets", {
    name: "bad.jpg",
    alt: "bad",
  });
  assert.equal(json.status, 415);
});

test("P5 media library de-duplicates, guards deletion and serves stored variants", async () => {
  const body = await sharp({
    create: {
      width: 800,
      height: 600,
      channels: 3,
      background: { r: 9, g: 8, b: 7 },
    },
  })
    .png()
    .toBuffer();
  const first = await manager.upload(body, "xe.png", "Xe trong xưởng");
  assert.equal(first.status, 201, JSON.stringify(first.body));
  const id = first.body.data.id;
  const again = await manager.upload(body, "xe-2.png", "Bản trùng");
  assert.equal(again.body.data.id, id);
  assert.equal(again.body.data.duplicate, true);
  assert.equal((await a.upload(body, "x.png", "x")).status, 403);
  const [found] = await success(
    manager,
    "GET",
    "admin/cms/assets?search=" + encodeURIComponent("trong xưởng"),
  );
  assert.equal(found.id, id);
  assert.deepEqual(
    [found.width, found.height, found.mime],
    [800, 600, "image/png"],
  );
  assert.deepEqual(
    found.avif.map((v: any) => v.width),
    [320, 640, 800],
  );
  const file = await app.inject({
    method: "GET",
    url: found.webp.at(-1).url,
  });
  assert.equal(file.statusCode, 200);
  assert.equal(file.headers["content-type"], "image/webp");
  assert.match(String(file.headers["cache-control"]), /immutable/);
  assert.equal(
    (
      await app.inject({
        method: "GET",
        url: "/api/v1/public/media/../../.env",
      })
    ).statusCode,
    404,
  );
  const moved = await success(manager, "PATCH", "admin/cms/assets/" + id, {
    alt: "Xe sau khi chăm sóc",
    focalX: 0.2,
    focalY: 0.7,
  });
  assert.equal(moved.id, id);
  const [edited] = await success(manager, "GET", "admin/cms/assets?search=sau");
  assert.deepEqual(edited.focal, { x: 0.2, y: 0.7 });
  assert.match(edited.og, /og-20-70\.jpg$/);
  assert.equal(
    (await manager.call("PATCH", "admin/cms/assets/" + id, { focalX: 0.5 }))
      .status,
    400,
  );
  const doc = await success(manager, "POST", "admin/cms/documents", {
    kind: "PAGE",
    key: "about",
    payload: { ...baseContent(), imageId: id },
  });
  const usage = await success(manager, "GET", `admin/cms/assets/${id}/usage`);
  assert.deepEqual(
    usage.map((u: any) => [u.id, u.live]),
    [[doc.id, false]],
  );
  // Deleting works even while content still uses the image.
  await success(manager, "DELETE", "admin/cms/assets/" + id, {});
  // Deleting is permanent: gone from library and trash, files removed from storage.
  assert.equal(
    (await success(manager, "GET", "admin/cms/assets?search=sau")).length,
    0,
  );
  assert.equal(
    (await success(manager, "GET", "admin/cms/assets?trash=true&search=sau"))
      .length,
    0,
  );
  assert.equal(
    (await app.inject({ method: "GET", url: found.webp.at(-1).url }))
      .statusCode,
    404,
  );
  const reuse = await manager.call("PATCH", "admin/cms/documents/" + doc.id, {
    expectedVersion: doc.version,
    payload: { ...baseContent(), imageId: id },
  });
  assert.equal(reuse.status, 422);
  const restore = await manager.call(
    "POST",
    `admin/cms/assets/${id}/restore`,
    {},
  );
  assert.equal(restore.status, 409);
  assert.equal(restore.body.error.code, "CMS_ASSET_PURGED");
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
  // Detail comes from the event behind the notice; the phone never leaks.
  assert.ok(notice.eventType);
  assert.ok(notice.subject.code);
  assert.ok(!JSON.stringify(notice).includes("0900"));
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

test("P5 CMS content kinds validate payloads, track nested images, revert, preview and report activity", async () => {
  const image = await asset();
  const pub = () => success(new Client(), "GET", "public/content");
  const settings = {
    name: "DPAuto - Trạm dịch vụ Toàn Trung",
    phone: "0772 584 279",
    email: "lienhe@example.test",
    address: "Địa chỉ thử nghiệm",
    hours: [{ label: "Thứ 2 - Chủ nhật", value: "08:00 - 18:00" }],
    logo: {
      src: "/api/v1/public/cms/assets/" + image.id,
      alt: "Logo",
      assetId: image.id,
    },
  };
  const site = await success(manager, "POST", "admin/cms/documents", {
    kind: "SETTINGS",
    key: "site",
    payload: settings,
  });
  assert.equal(
    (
      await manager.call("POST", "admin/cms/documents", {
        kind: "SETTINGS",
        key: "site",
        payload: settings,
      })
    ).status,
    409,
  );
  for (const bad of [
    { kind: "SETTINGS", key: "other", payload: settings },
    {
      kind: "SERVICE",
      key: "Bad Slug",
      payload: { title: "x", description: "" },
    },
  ])
    assert.equal(
      (await manager.call("POST", "admin/cms/documents", bad)).status,
      422,
    );
  const invalid = [
    { ...settings, socials: { facebook: "javascript:alert(1)" } },
    { ...settings, unknown: true },
  ];
  for (const payload of invalid)
    assert.equal(
      (
        await manager.call("PATCH", "admin/cms/documents/" + site.id, {
          expectedVersion: site.version,
          payload,
        })
      ).status,
      400,
    );
  const service = await success(manager, "POST", "admin/cms/documents", {
    kind: "SERVICE",
    key: "phu-ceramic",
    payload: {
      title: "Phủ ceramic",
      description: "Bảo vệ sơn",
      body: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Giới thiệu" }],
          },
        ],
      },
    },
  });
  const script = await manager.call(
    "PATCH",
    "admin/cms/documents/" + service.id,
    {
      expectedVersion: service.version,
      payload: {
        title: "Phủ ceramic",
        description: "",
        body: { type: "doc", content: [{ type: "script", text: "x" }] },
      },
    },
  );
  assert.equal(script.status, 400);
  assert.equal(
    (await new Client().call("GET", "public/cms/assets/" + image.id)).status,
    404,
  );
  const live = await success(
    manager,
    "POST",
    `admin/cms/documents/${site.id}/publish`,
    { expectedVersion: site.version, revisionId: site.revisionId },
  );
  assert.equal(
    (await new Client().call("GET", "public/cms/assets/" + image.id)).status,
    302,
  );
  let feed = await pub();
  assert.equal(
    feed.items.find((d: any) => d.kind === "SETTINGS").payload.name,
    settings.name,
  );
  assert.equal(feed.assets[image.id].id, image.id);
  assert.equal(
    feed.items.some((d: any) => d.kind === "SERVICE"),
    false,
  );
  const usage = await success(
    manager,
    "GET",
    `admin/cms/assets/${image.id}/usage`,
  );
  assert.deepEqual(
    usage.map((u: any) => u.live),
    [true],
  );
  const { token } = await success(manager, "POST", "admin/cms/preview", {});
  const preview = await success(
    new Client(),
    "GET",
    "public/cms/preview?token=" + encodeURIComponent(token),
  );
  assert.equal(preview.preview, true);
  assert.equal(
    preview.items.find((d: any) => d.kind === "SERVICE").payload.title,
    "Phủ ceramic",
  );
  assert.equal(
    (await new Client().call("GET", "public/cms/preview?token=x.y")).status,
    403,
  );
  const overview = await success(manager, "GET", "admin/cms/overview");
  assert.equal(overview.kinds.SETTINGS.live, 1);
  assert.equal(overview.kinds.SERVICE.drafts, 1);
  assert.ok(overview.drafts.some((d: any) => d.id === service.id));
  assert.ok(overview.recent.some((a: any) => a.action === "CMS_PUBLISHED"));
  const activity = await success(manager, "GET", "admin/cms/activity?limit=5");
  assert.equal(activity[0].actor, "Store Manager");
  const list = await success(
    manager,
    "GET",
    "admin/cms/documents?kind=SERVICE&search=ceramic",
  );
  assert.deepEqual(
    list.map((d: any) => [d.key, d.hasDraft]),
    [["phu-ceramic", true]],
  );
  await success(manager, "POST", `admin/cms/documents/${site.id}/revert`, {
    expectedVersion: live.version,
  });
  feed = await pub();
  assert.equal(
    feed.items.some((d: any) => d.kind === "SETTINGS"),
    false,
  );
  // Reverting deletes the override, so the same key can be saved again from the defaults.
  assert.equal(
    (
      await api.db.db.execute(
        sql`SELECT id FROM cms_documents WHERE id=${site.id}`,
      )
    ).rows.length,
    0,
  );
  const later = new Date(+clock + 86400000).toISOString();
  const news = await success(manager, "POST", "admin/cms/documents", {
    kind: "NEWS",
    key: "bai-hen-gio",
    payload: {
      title: "Bài hẹn giờ",
      description: "",
      date: day(clock),
      image: {
        src: "/api/v1/public/cms/assets/" + image.id,
        alt: "Ảnh",
        assetId: image.id,
      },
      publishAt: later,
    },
  });
  await success(manager, "POST", `admin/cms/documents/${news.id}/publish`, {
    expectedVersion: news.version,
    revisionId: news.revisionId,
  });
  assert.equal(
    (await pub()).items.some((d: any) => d.key === "bai-hen-gio"),
    false,
  );
  assert.equal(
    (await success(manager, "GET", "admin/cms/overview")).scheduled[0].key,
    "bai-hen-gio",
  );
});

test("P5 manager edits and merges duplicate customers without touching immutable history", async () => {
  const date = day(new Date(+clock + 86400000)),
    first = await createBooking(date, "09:00"),
    second = await createBooking(date, "10:00");
  const detail = async (id: string) =>
    success(manager, "GET", "admin/bookings/" + id);
  const keep = await success(
      manager,
      "GET",
      "admin/customers/" + (await detail(first.bookingId)).customerId,
    ),
    drop = await success(
      manager,
      "GET",
      "admin/customers/" + (await detail(second.bookingId)).customerId,
    );
  assert.notEqual(keep.id, drop.id);
  const denied = await a.call("PATCH", "admin/customers/" + keep.id, {
    expectedVersion: keep.version,
    name: "Không được sửa",
    phone: "0911111111",
    reason: "Cố vấn thử sửa",
  });
  assert.equal(denied.status, 403);
  const edited = await success(manager, "PATCH", "admin/customers/" + keep.id, {
    expectedVersion: keep.version,
    name: "Nguyễn Văn Gộp",
    phone: "0911 111 111",
    reason: "Khách báo sai tên",
  });
  const stale = await manager.call("PATCH", "admin/customers/" + keep.id, {
    expectedVersion: keep.version,
    name: "Bản cũ",
    phone: "0911111111",
    reason: "Phiên bản cũ",
  });
  assert.equal(stale.status, 409);
  const self = await manager.call("POST", `admin/customers/${keep.id}/merge`, {
    expectedVersion: edited.version,
    targetId: keep.id,
    targetVersion: edited.version,
    reason: "Gộp chính nó",
  });
  assert.equal(self.status, 422);
  await success(manager, "POST", `admin/customers/${drop.id}/merge`, {
    expectedVersion: drop.version,
    targetId: keep.id,
    targetVersion: edited.version,
    reason: "Trùng hồ sơ",
  });
  assert.equal((await detail(second.bookingId)).customerId, keep.id);
  const after = await success(manager, "GET", "admin/customers/" + keep.id);
  assert.equal(after.name, "Nguyễn Văn Gộp");
  assert.equal(after.phone, "+84911111111");
  const list = await success(manager, "GET", "admin/customers?q=" + encodeURIComponent("Gộp"));
  assert.ok(list.some((x: any) => x.id === keep.id));
  const listed = await manager.call("GET", "admin/customers?limit=100");
  assert.ok(!listed.body.data.some((x: any) => x.id === drop.id));
  const again = await manager.call("POST", `admin/customers/${drop.id}/merge`, {
    expectedVersion: drop.version + 1,
    targetId: keep.id,
    targetVersion: after.version,
    reason: "Gộp lần hai",
  });
  // The merged record no longer owns bookings, so it drops out of the actor scope.
  assert.equal(again.status, 404);
});

test("P5 CMS slugs are plain ASCII and new items cannot claim a built-in key", async () => {
  const create = (key: string, builtIn?: boolean) =>
    manager.call("POST", "admin/cms/documents", {
      kind: "SERVICE",
      key,
      ...(builtIn === undefined ? {} : { builtIn }),
      payload: { title: "Dịch vụ thử", description: "" },
    });
  for (const bad of ["dan-phim-(ppf)", "dán-phim", "dan--phim", "-dan", "dan-"])
    assert.equal((await create(bad)).status, 422, bad);
  assert.equal((await create("ceramic-coating")).status, 409);
  assert.equal((await create("dich-vu-khong-co-san", true)).status, 422);
  assert.equal((await create("ceramic-coating", true)).status, 201);
  assert.equal((await create("ceramic-coating", true)).status, 409);
  assert.equal((await create("dan-phim-moi")).status, 201);
});

test("P5 deleting a list item removes it from the admin and frees its slug", async () => {
  const create = (key: string, builtIn?: boolean) =>
    success(manager, "POST", "admin/cms/documents", {
      kind: "SERVICE",
      key,
      ...(builtIn ? { builtIn } : {}),
      payload: { title: "Dịch vụ xóa", description: "" },
    });
  const list = (key: string) =>
    success(manager, "GET", `admin/cms/documents?kind=SERVICE&key=${key}`);
  const doc = await create("dich-vu-se-xoa");
  await success(manager, "POST", `admin/cms/documents/${doc.id}/withdraw`, {
    expectedVersion: doc.version,
  });
  assert.equal((await manager.call("GET", "admin/cms/documents/" + doc.id)).status, 404);
  assert.equal((await list("dich-vu-se-xoa")).length, 0);
  // The slug is free again.
  const again = await create("dich-vu-se-xoa");
  assert.equal((await list("dich-vu-se-xoa"))[0].id, again.id);
  // A deleted built-in keeps its key (flagged deleted) so the website default stays hidden.
  const builtIn = await create("window-tint", true);
  await success(manager, "POST", `admin/cms/documents/${builtIn.id}/withdraw`, {
    expectedVersion: builtIn.version,
  });
  const [gone] = await list("window-tint");
  assert.equal(gone.deleted, true);
  const feed = await success(new Client(), "GET", "public/content");
  assert.equal(
    feed.items.find((d: any) => d.kind === "SERVICE" && d.key === "window-tint").withdrawn,
    true,
  );
  // Saving the deleted built-in again from the admin brings it back under the same record.
  const back = await create("window-tint", true);
  assert.equal(back.id, builtIn.id);
  const [revived] = await list("window-tint");
  assert.equal(revived.deleted, false);
  await success(manager, "POST", `admin/cms/documents/${back.id}/publish`, {
    expectedVersion: back.version,
    revisionId: back.revisionId,
  });
  const live = (await success(new Client(), "GET", "public/content")).items.find(
    (d: any) => d.kind === "SERVICE" && d.key === "window-tint",
  );
  assert.equal(live.withdrawn, false);
  assert.equal(live.payload.title, "Dịch vụ xóa");
  // A built-in that is not deleted still cannot be created twice.
  assert.equal(
    (await manager.call("POST", "admin/cms/documents", {
      kind: "SERVICE",
      key: "window-tint",
      builtIn: true,
      payload: { title: "x", description: "" },
    })).status,
    409,
  );
});

test("P5 accessory detail blocks are validated and stored", async () => {
  const payload = {
    name: "Camera thử",
    images: [],
    highlights: [{ text: "Hàng chính hãng" }],
    specs: [
      { label: "Độ phân giải", value: "4K", key: true, icon: "camera" },
      { label: "Cảm biến", value: "Sony" },
    ],
    inBox: [{ title: "Giá đỡ", image: null }],
    faq: [{ question: "Bảo hành bao lâu?", answer: "12 tháng" }],
  };
  const doc = await success(manager, "POST", "admin/cms/documents", {
    kind: "ACCESSORY",
    key: "camera-thu-chi-tiet",
    payload,
  });
  const saved = await success(manager, "GET", "admin/cms/documents/" + doc.id);
  assert.deepEqual(saved.revisions[0].payload.specs, payload.specs);
  const bad = await manager.call("POST", "admin/cms/documents", {
    kind: "ACCESSORY",
    key: "camera-thu-sai",
    payload: { ...payload, specs: [{ label: "x", value: "y", extra: 1 }] },
  });
  assert.ok([400, 422].includes(bad.status), String(bad.status));
  const badIcon = await manager.call("POST", "admin/cms/documents", {
    kind: "ACCESSORY",
    key: "camera-thu-icon-sai",
    payload: { ...payload, specs: [{ label: "x", value: "y", icon: "rocket" }] },
  });
  assert.ok([400, 422].includes(badIcon.status), String(badIcon.status));
});

test("P5 accessory catalog stores brands with logos and categories", async () => {
  const logo = await asset();
  const payload = {
    brands: [
      { id: "icar", name: "ICAR", logo: { src: "/api/v1/public/cms/assets/" + logo.id, alt: "ICAR", assetId: logo.id } },
      { id: "moi1", name: "Hãng mới", logo: null },
    ],
    categories: [{ id: "camera-hanh-trinh", name: "Camera hành trình" }],
  };
  const doc = await success(manager, "POST", "admin/cms/documents", {
    kind: "CATALOG",
    key: "accessories",
    builtIn: true,
    payload,
  });
  await success(manager, "POST", `admin/cms/documents/${doc.id}/publish`, {
    expectedVersion: doc.version,
    revisionId: doc.revisionId,
  });
  const feed = await success(new Client(), "GET", "public/content");
  const live = feed.items.find((d: any) => d.kind === "CATALOG");
  assert.equal(live.payload.brands[0].logo.assetId, logo.id);
  assert.ok(feed.assets[logo.id], "logo is served with the feed");
  assert.equal(live.payload.categories[0].name, "Camera hành trình");
  for (const bad of [
    { kind: "CATALOG", key: "khac", payload },
    {
      kind: "CATALOG",
      key: "accessories",
      payload: { ...payload, categories: [payload.categories[0], payload.categories[0]] },
    },
  ]) {
    const r = await manager.call("POST", "admin/cms/documents", bad);
    assert.ok([400, 409, 422].includes(r.status), String(r.status));
  }
});

test("P5 service URL slugs must be unique across services", async () => {
  const create = (key: string, slug: string) =>
    manager.call("POST", "admin/cms/documents", {
      kind: "SERVICE",
      key,
      payload: { title: "Dịch vụ " + key, description: "", slug },
    });
  assert.equal((await create("dich-vu-mot", "duong-dan-chung")).status, 201);
  assert.equal((await create("dich-vu-hai", "duong-dan-chung")).status, 409);
  // Another service's key (old URL) is taken too, including built-in ones.
  assert.equal((await create("dich-vu-ba", "dich-vu-mot")).status, 409);
  assert.equal((await create("dich-vu-bon", "window-tint")).status, 409);
  const bad = await create("dich-vu-nam", "Có Dấu");
  assert.ok([400, 422].includes(bad.status), String(bad.status));
});

test("P5 saving content that points at a missing image names that image", async () => {
  const r = await manager.call("POST", "admin/cms/documents", {
    kind: "SERVICE",
    key: "dich-vu-anh-mat",
    payload: {
      title: "Dịch vụ thử",
      description: "",
      image: {
        src: "/api/v1/public/cms/assets/00000000-0000-4000-8000-000000000000",
        alt: "Ảnh đã xóa",
        assetId: "00000000-0000-4000-8000-000000000000",
      },
    },
  });
  assert.equal(r.status, 422, JSON.stringify(r.body));
  assert.equal(r.body.error.code, "CMS_ASSET_INVALID");
  assert.match(r.body.error.message, /Ảnh đã xóa/);
  // A bare legacy imageId has no name of its own; the message still says which one.
  const legacy = await manager.call("POST", "admin/cms/documents", {
    kind: "SERVICE",
    key: "dich-vu-anh-cu-mat",
    payload: { title: "Dịch vụ thử", description: "", imageId: "00000000-0000-4000-8000-000000000001" },
  });
  assert.equal(legacy.status, 422, JSON.stringify(legacy.body));
  assert.match(legacy.body.error.message, /ảnh cũ \(mã 00000000\)/);
});

test("P5 videos upload as-is, list separately and can be used in a service gallery", async () => {
  // Minimal MP4 header: an ISO-BMFF `ftyp` box with an mp4 brand, then filler.
  const mp4 = Buffer.concat([
    Buffer.from([0, 0, 0, 24]),
    Buffer.from("ftypisom", "latin1"),
    Buffer.from([0, 0, 2, 0]),
    Buffer.from("isomiso2", "latin1"),
    Buffer.alloc(4096, assetSeed++),
  ]);
  const up = await manager.upload(mp4, "xuong.mp4", "Video xưởng");
  assert.equal(up.status, 201, JSON.stringify(up.body));
  const id = up.body.data.id;
  const detail = await success(manager, "GET", `admin/cms/assets?type=video`);
  const video = detail.find((a: any) => a.id === id);
  assert.ok(video, "video listed under type=video");
  assert.equal(video.kind, "video");
  assert.equal(video.mime, "video/mp4");
  assert.match(video.src, /video\.mp4$/);
  const images = await success(manager, "GET", `admin/cms/assets?type=image`);
  assert.ok(!images.some((a: any) => a.id === id), "videos stay out of the image picker");
  // QuickTime is refused: it does not play in most browsers.
  const mov = Buffer.from(mp4);
  mov.write("qt  ", 8, "latin1");
  assert.equal((await manager.upload(mov, "xuong.mov", "Video mov")).status, 422);
  // A service may carry up to two videos.
  const v = { src: video.src, alt: "Video xưởng", assetId: id };
  const doc = await success(manager, "POST", "admin/cms/documents", {
    kind: "SERVICE",
    key: "dich-vu-co-video",
    payload: { title: "Dịch vụ có video", description: "", videos: [v] },
  });
  await success(manager, "POST", `admin/cms/documents/${doc.id}/publish`, {
    expectedVersion: doc.version,
    revisionId: doc.revisionId,
  });
  const feed = await success(new Client(), "GET", "public/content");
  assert.equal(feed.assets[id].kind, "video");
  const tooMany = await manager.call("POST", "admin/cms/documents", {
    kind: "SERVICE",
    key: "dich-vu-ba-video",
    payload: { title: "Ba video", description: "", videos: [v, v, v] },
  });
  assert.ok([400, 422].includes(tooMany.status), String(tooMany.status));
});

test("P5 the booking vehicle list is a CATALOG document with its own shape", async () => {
  const doc = await success(manager, "POST", "admin/cms/documents", {
    kind: "CATALOG",
    key: "vehicles",
    payload: { brands: [{ name: "Toyota", models: ["Vios", "Camry"] }] },
  });
  assert.ok(doc.id);
  // Accessory-catalog fields are not accepted here, and unknown catalog keys are refused.
  const wrong = await manager.call("POST", "admin/cms/documents", {
    kind: "CATALOG",
    key: "vehicles-2",
    payload: { brands: [] },
  });
  assert.equal(wrong.status, 422);
  const bad = await manager.call("PATCH", `admin/cms/documents/${doc.id}`, {
    expectedVersion: doc.version,
    payload: { brands: [{ id: "toyota", name: "Toyota" }] },
  });
  assert.ok([400, 422].includes(bad.status), String(bad.status));
});

test("P5 publishing a website service makes it the bookable operations service", async () => {
  const doc = await success(manager, "POST", "admin/cms/documents", {
    kind: "SERVICE",
    key: "dan-ppf-dong-bo",
    payload: { title: "Dán PPF", description: "", durationMinutes: 75 },
  });
  await success(manager, "POST", `admin/cms/documents/${doc.id}/publish`, {
    expectedVersion: doc.version,
    revisionId: doc.revisionId,
  });
  const listed = (await success(new Client(), "GET", "public/services")).services;
  const svc = listed.find((s: any) => s.marketingSlug === "dan-ppf-dong-bo");
  assert.ok(svc, "synced into the booking catalogue");
  assert.equal(svc.name, "Dán PPF");
  assert.equal(svc.estimatedDurationMinutes, 75);
  // Removing it from the website takes it out of booking too.
  await success(manager, "POST", `admin/cms/documents/${doc.id}/withdraw`, {
    expectedVersion: doc.version + 1,
  });
  const after = (await success(new Client(), "GET", "public/services")).services;
  assert.ok(!after.some((s: any) => s.marketingSlug === "dan-ppf-dong-bo"));
});
