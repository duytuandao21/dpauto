import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { migrate } from "../scripts/migrate";
import { bootstrap } from "../scripts/bootstrap";
import { loadConfig } from "../src/config";
import { createApp } from "../src/app";
import { sql, one, rows } from "../src/database";
import { quoteMoney } from "../src/quote-money";
import { quotePreview } from "../../src/lib/advisor/quote-preview";

test("Reception accepts absent ODO, plate and follow-up reasons while retaining vehicle verification and access checks", async () => {
  const intake = {
    request: "Kiểm tra xe thực tế",
    odometer: null,
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
  const v = await walk({ vehicle: { model: "Xe chưa đăng ký biển" }, intake });
  const d = await detail(v.visitId);
  assert.equal(d.intake.odometer, null);
  assert.equal(d.intake.odometerMissingReason, null);
  assert.equal(d.intake.plateMissingReason, null);
  assert.equal(d.vehicle.plate, null);
  assert.equal(
    (await b.call("GET", `admin/service-visits/${v.visitId}`)).status,
    404,
  );
  await assert.rejects(walk({ vehicleVerified: false }));
  await assert.rejects(walk({ intake: { ...intake, odometer: -1 } }));
  await assert.rejects(
    walk({
      followUpOfVisitId: v.visitId,
      customer: { id: d.customerId },
      vehicle: { id: d.vehicleId },
    }),
  );
  good(
    await act(
      v.visitId,
      `admin/service-visits/${v.visitId}/abort`,
      { evidenceNote: "Dừng kiểm tra để tiếp nhận lại", vehicleMoved: true },
      "POST",
      manager,
    ),
  );
  const next = await walk({
    followUpOfVisitId: v.visitId,
    customer: { id: d.customerId },
    vehicle: { id: d.vehicleId },
    intake,
  });
  assert.equal((await detail(next.visitId)).followUpOfVisitId, v.visitId);
  assert.equal((await detail(next.visitId)).followUpReason, null);
});

test("Quote service quantities save and close with decimals while invalid quantities preserve the draft", async () => {
  const v = await walk(), id = v.visitId, q = await quote(id);
  const draft = {
    ...q.draft,
    lines: ["2", "1.5"].map((quantity) => ({ ...q.draft.lines[0], quantity })),
  };
  good(await act(id, `admin/quote-revisions/${q.id}`, draft, "PATCH"));
  const saved = (await workflow(id)).quotes[0];
  assert.deepEqual(saved.lines.map((line: any) => line.quantity), ["2.000", "1.500"]);
  const totals = quoteMoney(draft.lines, draft.discountPercent);
  assert.equal(saved.total, totals.total);
  assert.deepEqual(saved.lines.map((line: any) => line.total), totals.lines.map((line) => line.total));
  const version = (await detail(id)).version;
  for (const quantity of ["0", "-1", "1.0001"]) {
    assert.equal((await act(id, `admin/quote-revisions/${q.id}`, {
      ...draft,
      lines: [{ ...draft.lines[0], quantity }],
    }, "PATCH")).status, 400);
    assert.equal((await detail(id)).version, version);
  }
  const invalidService = await act(id, `admin/quote-revisions/${q.id}`, {
    ...draft,
    lines: [{ ...draft.lines[0], serviceId: randomUUID() }],
  }, "PATCH");
  assert.equal(invalidService.body.error.code, "SERVICE_INACTIVE");
  assert.equal((await detail(id)).version, version);
  assert.deepEqual((await workflow(id)).quotes[0].lines, saved.lines);
  await close(id, { ...q, draft });
  const w = await workflow(id);
  assert.equal(w.obligation.total, totals.total);
  assert.deepEqual(w.approvedLines.map((line: any) => line.quantity), ["2.000", "1.500"]);
  const printed = good(await a.call("GET", `admin/quote-revisions/${q.id}/print`));
  assert.deepEqual(printed.revision.lines.map((line: any) => line.quantity), ["2.000", "1.500"]);
});

test("Unified quote preserves line descriptions and approved scope while adding and closing extras", async () => {
  const v = await walk(),
    id = v.visitId,
    q = await quote(id);
  const description = "Kiểm tra động cơ và hệ thống phanh theo yêu cầu khách";
  const draft = {
    ...q.draft,
    lines: q.draft.lines.map((line) => ({ ...line, description })),
  };
  const before = (await detail(id)).version;
  assert.equal(
    (
      await act(
        id,
        `admin/quote-revisions/${q.id}`,
        {
          ...draft,
          lines: [{ ...draft.lines[0], description: "x".repeat(501) }],
        },
        "PATCH",
      )
    ).status,
    400,
  );
  assert.equal((await detail(id)).version, before);
  await close(id, { ...q, draft });
  const initial = (await workflow(id)).quotes[0];
  assert.equal(initial.lines[0].description, description);
  const extra = await quote(id);
  const extraDraft = {
    ...extra.draft,
    lines: [
      {
        kind: "PART",
        name: "Lọc điều hòa",
        description: "Thay thêm sau khi khách đồng ý",
        code: "LOC-DH",
        unit: "Cái",
        quantity: "2",
        unitPrice: "50000",
        discountPercent: "0",
        vatPercent: "10",
      },
    ],
  };
  good(await act(id, `admin/quote-revisions/${extra.id}`, extraDraft, "PATCH"));
  let w = await workflow(id);
  assert.equal(w.obligation.total, "99000");
  assert.equal(w.approvedLines.length, 1);
  assert.deepEqual(w.quotes[0].lines, initial.lines);
  await close(id, { ...extra, draft: extraDraft });
  w = await workflow(id);
  assert.equal(w.obligation.total, "198000");
  assert.equal(w.approvedLines.length, 2);
  assert.deepEqual(w.quotes[0].lines, initial.lines);
  assert.equal(
    good(await a.call("GET", `admin/quote-revisions/${q.id}/print`)).revision
      .lines[0].description,
    description,
  );
  assert.equal(
    good(await a.call("GET", `admin/quote-revisions/${extra.id}/print`))
      .revision.lines[0].description,
    extraDraft.lines[0].description,
  );
  assert.equal(
    (await act(id, `admin/quote-revisions/${q.id}`, draft, "PATCH")).status,
    409,
  );
  assert.equal(
    (await b.call("GET", `admin/service-visits/${id}/workflow`)).status,
    404,
  );
  const rejected = await quote(id);
  good(await act(id, `admin/quote-revisions/${rejected.id}`, draft, "PATCH"));
  good(await act(id, `admin/quote-revisions/${rejected.id}/submit`));
  good(
    await act(id, `admin/quote-revisions/${rejected.id}/decision`, {
      decision: "REJECTED",
      evidence,
    }),
  );
  const continued = await quote(id);
  const copied = (await workflow(id)).quotes.find(
    (revision: any) => revision.id === continued.id,
  );
  assert.equal(copied.lines[0].description, description);
  assert.equal((await workflow(id)).obligation.total, "198000");
});

test("V2 manager without financial adjustment grant cannot reduce approved scope or money", async () => {
  const email = "limited-money@v2.test",
    client = new Client();
  good(
    await manager.call("POST", "admin/staff", {
      name: "Quản lý không có quyền tiền",
      phone: "0901234567",
      email,
      jobRole: "MANAGER",
      active: true,
      account: {
        email,
        temporaryPassword: password,
        role: "MANAGER",
        permissions: [],
      },
    }),
  );
  await client.login(email);
  good(
    await client.call("POST", "admin/auth/change-password", {
      currentPassword: password,
      newPassword,
    }),
  );
  const v = await walk(),
    id = v.visitId,
    q = await quote(id);
  q.draft.lines.push({ ...q.draft.lines[0], name: "Hạng mục thứ hai" });
  await close(id, q);
  const before = await workflow(id),
    line = before.approvedLines[0].id;
  const denied = await act(
    id,
    `admin/quote-revisions/${q.id}/void`,
    { lineIds: [line], unperformedConfirmed: true },
    "POST",
    client,
  );
  assert.equal(denied.status, 403);
  assert.equal(denied.body.error.code, "FORBIDDEN");
  const after = await workflow(id);
  assert.equal(after.version, before.version);
  assert.equal(after.obligation.total, before.obligation.total);
  assert.equal(after.financialCredits.length, 0);
  assert.equal(after.approvedLines.length, 2);
});

test("V2 partial cancellation keeps performed scope, credits exact money once and blocks stale stock issue", async () => {
  const v = await walk(),
    id = v.visitId,
    q = await quote(id, "100000");
  (q.draft.lines as any[]).push({
    kind: "PART",
    name: "Phụ tùng khách đổi ý",
    code: "V2_CANCEL",
    unit: "Cái",
    quantity: "1",
    unitPrice: "50000",
    discountPercent: "0",
    vatPercent: "10",
  });
  await close(id, q);
  good(await act(id, `admin/service-visits/${id}/work/start`));
  const w = await workflow(id),
    lines = w.quotes[0].lines,
    item = good(
      await act(id, `admin/service-visits/${id}/work-items`, {
        label: "Dịch vụ đã bắt đầu",
        quoteLineId: lines[0].id,
        technicianIds: [],
        dueAt: "2026-11-16T18:00:00+07:00",
      }),
    );
  good(
    await act(id, `admin/work-items/${item.workItemId}/progress`, {
      status: "IN_PROGRESS",
    }),
  );
  const warehouse = good(
      await manager.call("POST", "admin/stock/warehouses", {
        code: "CANCEL_KHO",
        name: "Kho kiểm thử hủy",
      }),
    ),
    part = good(
      await manager.call("POST", "admin/stock/parts", {
        code: "CANCEL_PART",
        name: "Phụ tùng",
        unit: "Cái",
      }),
    );
  const sr = good(
    await act(
      id,
      `admin/service-visits/${id}/stock-requests`,
      { quoteLineId: lines[1].id, partId: part.id, warehouseId: warehouse.id },
      "POST",
      manager,
    ),
  );
  const doc = good(
    await manager.call("POST", "admin/stock/documents", {
      commandId: randomUUID(),
      warehouseId: warehouse.id,
      kind: "ISSUE",
      reason: "Chuẩn bị xuất kho",
      lines: [{ partId: part.id, quantity: "1", requestId: sr.requestId }],
    }),
  );
  assert.equal(
    (
      await act(id, `admin/quote-revisions/${q.id}/void`, {
        lineIds: [lines[1].id],
        unperformedConfirmed: true,
      })
    ).status,
    403,
  );
  const key = randomUUID(),
    body = {
      expectedVersion: (await detail(id)).version,
      reason: "Khách đổi ý, phụ tùng chưa xuất và chưa lắp",
      lineIds: [lines[1].id],
      unperformedConfirmed: true,
    };
  good(
    await manager.call("POST", `admin/quote-revisions/${q.id}/void`, body, key),
  );
  good(
    await manager.call("POST", `admin/quote-revisions/${q.id}/void`, body, key),
  );
  const current = await workflow(id);
  assert.equal(current.stage, "IN_PROGRESS");
  assert.equal(current.obligation.total, "99000");
  assert.equal(current.financialCredits.length, 1);
  assert.equal(current.financialCredits[0].amount, "49500");
  assert.equal(current.quotes[0].status, "APPROVED");
  assert.equal(current.quotes[0].total, "148500");
  assert.deepEqual(current.quotes[0].voidedLineIds, [lines[1].id]);
  assert.equal(current.approvedLines.length, 1);
  assert.equal(current.stock.lines.length, 0);
  const stale = await manager.call(
    "POST",
    `admin/stock/documents/${doc.id}/post`,
    { expectedVersion: doc.version, reason: "Thử xuất chứng từ cũ" },
  );
  assert.equal(stale.body.error.code, "QUOTE_LINE_NOT_AUTHORIZED");
  assert.equal(
    (
      await act(
        id,
        `admin/quote-revisions/${q.id}/void`,
        { lineIds: [lines[0].id], unperformedConfirmed: true },
        "POST",
        manager,
      )
    ).body.error.code,
    "QUOTE_ALREADY_PERFORMED",
  );
});

test("V2 manager may void unperformed approval only with explicit confirmation; performed work remains protected", async () => {
  const v = await walk(),
    id = v.visitId,
    q = await quote(id, "0");
  await close(id, q);
  assert.equal(
    (await act(id, `admin/quote-revisions/${q.id}/void`, {}, "POST", manager))
      .body.error.code,
    "UNPERFORMED_CONFIRMATION_REQUIRED",
  );
  good(
    await act(
      id,
      `admin/quote-revisions/${q.id}/void`,
      { unperformedConfirmed: true },
      "POST",
      manager,
    ),
  );
  assert.equal((await detail(id)).stage, "QUOTING");
  const next = await quote(id, "0");
  await close(id, next);
  good(await act(id, `admin/service-visits/${id}/work/start`));
  const extra = await quote(id, "0");
  await close(id, extra);
  const w = await workflow(id),
    line = w.quotes.find((r: any) => r.id === extra.id).lines[0];
  const item = good(
    await act(id, `admin/service-visits/${id}/work-items`, {
      label: "Thực hiện hạng mục phát sinh",
      quoteLineId: line.id,
      technicianIds: [],
      dueAt: "2026-11-16T18:00:00+07:00",
    }),
  );
  good(
    await act(id, `admin/work-items/${item.workItemId}/progress`, {
      status: "IN_PROGRESS",
    }),
  );
  assert.equal(
    (
      await act(
        id,
        `admin/quote-revisions/${extra.id}/void`,
        { unperformedConfirmed: true },
        "POST",
        manager,
      )
    ).body.error.code,
    "QUOTE_ALREADY_PERFORMED",
  );
});

test("V2 final schema supplies group checks, draft print is read-only and browser money preview matches backend", async () => {
  const created = good(
    await manager.call("POST", "admin/services", {
      code: "V2_DEFAULT",
      name: "Bảo dưỡng có kiểm tra",
      categoryCode: "MAINTENANCE",
      active: true,
      bookable: true,
      sortOrder: 0,
      estimatedDurationMinutes: 60,
    }),
  );
  const found = good(
    await manager.call("GET", "admin/services?limit=100"),
  ).find((s: any) => s.id === created.id);
  assert.deepEqual(found.qualityChecks, [
    "Kiểm tra các hạng mục bảo dưỡng và an toàn vận hành",
  ]);
  const v = await walk(),
    q = await quote(v.visitId);
  const before = (await detail(v.visitId)).version;
  const preview = good(
    await a.call("GET", `admin/quote-revisions/${q.id}/print`),
  );
  assert.equal(preview.revision.status, "DRAFT");
  assert.equal(preview.snapshot.visitCode, v.code);
  assert.equal((await detail(v.visitId)).version, before);
  const lines = [
    {
      quantity: "1",
      unitPrice: "999999999999999",
      discountPercent: "12.5",
      vatPercent: "8",
    },
    {
      quantity: "0.125",
      unitPrice: "999",
      discountPercent: "12.5",
      vatPercent: "8",
    },
  ];
  const expected = quoteMoney(lines, "10"),
    actual = quotePreview(lines, "10");
  assert.equal(actual?.total, expected.total);
  assert.equal(actual?.discountTotal, expected.discountTotal);
  assert.equal(actual?.taxTotal, expected.taxTotal);
  const required = await one(
    api.db.db,
    sql`SELECT is_nullable FROM information_schema.columns WHERE table_name='visit_handovers' AND column_name='acceptance_id'`,
  );
  assert.equal(required!.is_nullable, "NO");
});
const url = process.env.DP_TEST_DATABASE_URL;
if (!url?.includes("dpauto_test@127.0.0.1:"))
  throw Error("Use the isolated PostgreSQL runner.");
const config = {
  ...loadConfig({
    DATABASE_URL: url,
    APP_ORIGIN: "http://localhost:4001",
    API_SECRET: "workflow-v2-isolated-secret-".repeat(3),
    NODE_ENV: "test",
  }),
  now: () => new Date("2026-11-16T03:00:00Z"),
};
let app: Awaited<ReturnType<typeof createApp>>["app"],
  api: Awaited<ReturnType<typeof createApp>>["api"],
  advisor: any,
  service: string,
  serial = 0;
const password = "Workflow password 123!",
  newPassword = "Workflow changed 123!";
class Client {
  cookie = "";
  csrf = "";
  async call(method: string, path: string, payload?: any, key = randomUUID()) {
    const r = await app.inject({
      method: method as any,
      url: "/api/v1/" + path,
      remoteAddress: `127.0.0.${(++serial % 200) + 10}`,
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
      ...(payload ? { payload: JSON.stringify(payload) } : {}),
    });
    const cookie = r.headers["set-cookie"];
    if (cookie)
      this.cookie = String(Array.isArray(cookie) ? cookie[0] : cookie).split(
        ";",
      )[0];
    const body = r.body ? JSON.parse(r.body) : {};
    if (body.data?.csrfToken) this.csrf = body.data.csrfToken;
    return { status: r.statusCode, body };
  }
  async login(email: string, pw = password) {
    await this.call("GET", "admin/auth/csrf");
    const r = await this.call("POST", "admin/auth/login", {
      email,
      password: pw,
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
  }
}
const manager = new Client(),
  a = new Client(),
  b = new Client();
const good = (r: any) => {
  assert.ok([200, 201].includes(r.status), JSON.stringify(r));
  return r.body.data;
};
const evidence = {
  customerName: "Khách hàng",
  channel: "PHONE",
  note: "Khách xác nhận đúng các hạng mục đã chọn",
};
before(async () => {
  await migrate(url!);
  ({ app, api } = await createApp(config));
  await bootstrap(api.db, config, {
    name: "Manager",
    email: "manager@v2.test",
    password,
    phone: "0901234567",
    stationName: "Test",
    address: "Test",
    directionsUrl: "https://maps.app.goo.gl/test",
  });
  await manager.login("manager@v2.test");
  good(
    await manager.call("POST", "admin/auth/change-password", {
      currentPassword: password,
      newPassword,
    }),
  );
  const me = good(await manager.call("GET", "admin/staff?limit=100")).find(
    (s: any) => s.account?.email === "manager@v2.test",
  );
  good(
    await manager.call("PATCH", `admin/staff/${me.id}`, {
      expectedVersion: me.version,
      reason: "Cấp quyền thu tiền cho quản lý kiểm thử",
      account: {
        permissions: [
          "roles.manage",
          "staff.manage",
          "finance.read",
          "payments.collect",
          "inventory.manage",
          "inventory.adjust",
          "inventory.cost.read",
          "payments.refund",
        ],
      },
    }),
  );
  await manager.login("manager@v2.test", newPassword);
  const station = (await one(api.db.db, sql`SELECT * FROM stations`))!;
  good(
    await manager.call("PUT", "admin/capacity/policy", {
      expectedVersion: station.configuration_version,
      reason: "Thiết lập lịch",
      bookingEnabled: true,
      slotMinutes: 30,
      maxBookingsPerSlot: 5,
      hours: Array.from({ length: 7 }, (_, weekday) => ({
        weekday,
        opensAt: "08:00",
        closesAt: "18:00",
      })),
    }),
  );
  service = good(
    await manager.call("POST", "admin/services", {
      code: "V2_SERVICE",
      name: "Dịch vụ kiểm tra",
      categoryCode: "OTHER",
      active: true,
      bookable: true,
      sortOrder: 0,
      estimatedDurationMinutes: 60,
      qualityChecks: ["Kiểm tra an toàn và vận hành"],
      technicianRequired: false,
    }),
  ).id;
  for (const [client, email] of [
    [a, "a@v2.test"],
    [b, "b@v2.test"],
  ] as const) {
    const staff = good(
      await manager.call("POST", "admin/staff", {
        name: email,
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
      }),
    );
    if (client === a) advisor = staff;
    await client.login(email);
    good(
      await client.call("POST", "admin/auth/change-password", {
        currentPassword: password,
        newPassword,
      }),
    );
  }
});
after(async () => {
  await app?.close();
});
async function versions() {
  const s = (await one(api.db.db, sql`SELECT * FROM stations`))!;
  return {
    catalogVersion: s.catalog_version,
    policyVersion: s.configuration_version,
  };
}
async function walk(extra: any = {}) {
  const n = ++serial;
  return good(
    await a.call("POST", "admin/service-visits", {
      customer: {
        name: "Khách V2",
        phone: "0911" + String(n).padStart(6, "0"),
      },
      vehicle: {
        model: "Toyota Vios",
        plate: "51A" + String(n).padStart(5, "0"),
      },
      vehicleVerified: true,
      serviceIds: [service],
      ...(await versions()),
      notice: {
        privacyNoticeVersion: "BOOKING_V1",
        privacyNoticeAcknowledged: true,
      },
      intake: {
        request: "Kiểm tra xe",
        odometer: 1000,
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
      },
      ...extra,
    }),
  );
}
async function detail(id: string) {
  return good(await a.call("GET", `admin/service-visits/${id}`));
}
async function workflow(id: string) {
  return good(await a.call("GET", `admin/service-visits/${id}/workflow`));
}
async function act(
  id: string,
  path: string,
  body: any = {},
  method = "POST",
  client = a,
) {
  return client.call(method, path, {
    expectedVersion: (await detail(id)).version,
    reason: "Thao tác có căn cứ",
    ...body,
  });
}
async function quote(id: string, price = "100000", extra: any = {}) {
  const w = await workflow(id),
    r = good(
      await act(id, `admin/service-visits/${id}/quotes`, {
        baseRevisionId: w.quotes.at(-1)?.id,
        ...extra,
      }),
    );
  const draft = {
    calculationPolicy: "VND_LINE_HALF_UP_V1",
    discountPercent: "10",
    note: "Yêu cầu khách",
    lines: [
      {
        kind: "SERVICE",
        serviceId: service,
        name: "Dịch vụ kiểm tra",
        code: "V2_SERVICE",
        unit: "Lần",
        quantity: "1",
        unitPrice: price,
        discountPercent: "0",
        vatPercent: "10",
      },
    ],
  };
  return { id: r.revisionId, draft };
}
async function close(id: string, q: any) {
  return good(
    await act(id, `admin/quote-revisions/${q.id}/close`, {
      ...q.draft,
      evidence,
    }),
  );
}
async function finish(id: string) {
  const w = await workflow(id);
  return act(id, `admin/service-visits/${id}/work/finish`, {
    quality: {
      inspectorId: advisor.id,
      result: "PASSED",
      note: "Đã hoàn tất và kiểm tra xe",
      completionConfirmed: true,
      checks: [],
      qualityChecks: w.requiredChecks.map((x: any) => ({
        key: x.key,
        passed: true,
        note: "",
      })),
    },
  });
}

test("Service visit deletion preserves drafts and history, hides child resources and allows vehicle reception again", async () => {
  const id = (await walk()).visitId,
    q = await quote(id);
  good(await act(id, `admin/quote-revisions/${q.id}`, q.draft, "PATCH"));
  const before = await detail(id),
    revision = (await workflow(id)).quotes[0],
    events = await rows(
      api.db.db,
      sql`SELECT * FROM visit_events WHERE visit_id=${id} ORDER BY id`,
    ),
    media = (await one(
      api.db.db,
      sql`INSERT INTO visit_media(visit_id,uploaded_by,uploaded_at,name,content_type,content,sha256) SELECT id,received_by,received_at,'delete-test.jpg','image/jpeg',decode('ffd8ffd9','hex'),'delete-test' FROM service_visits WHERE id=${id} RETURNING id`,
    ))!;
  assert.equal(before.canDelete, true);
  assert.equal(before.deleteBlockedReason, null);
  const key = randomUUID(),
    body = { expectedVersion: before.version },
    removed = good(
      await a.call("DELETE", `admin/service-visits/${id}`, body, key),
    ),
    replay = await a.call("DELETE", `admin/service-visits/${id}`, body, key);
  assert.equal(removed.visitId, id);
  assert.equal(removed.stage, before.stage);
  assert.equal(removed.version, before.version + 1);
  assert.deepEqual(good(replay), removed);
  assert.equal(replay.body.meta.replayed, true);
  assert.equal(
    (await a.call("DELETE", `admin/service-visits/${id}`, body)).status,
    404,
  );
  const stored = (await one(
    api.db.db,
    sql`SELECT * FROM service_visits WHERE id=${id}`,
  ))!;
  assert.ok(stored.deleted_at);
  assert.equal(stored.deleted_by, stored.received_by);
  assert.equal(stored.stage, before.stage);
  assert.equal(stored.version, before.version + 1);
  const retainedEvents = await rows(
    api.db.db,
    sql`SELECT * FROM visit_events WHERE visit_id=${id} ORDER BY id`,
  );
  assert.equal(retainedEvents.length, events.length + 1);
  for (const event of events)
    assert.deepEqual(
      retainedEvents.find((e) => e.id === event.id),
      event,
    );
  const storedQuote = (await one(
    api.db.db,
    sql`SELECT status,total FROM quote_revisions WHERE id=${q.id}`,
  ))!;
  assert.equal(storedQuote.status, "DRAFT");
  assert.equal(storedQuote.total, revision.total);
  assert.equal(
    (
      await rows(
        api.db.db,
        sql`SELECT * FROM quote_lines WHERE revision_id=${q.id}`,
      )
    ).length,
    revision.lines.length,
  );
  assert.equal(
    (await one(
      api.db.db,
      sql`SELECT count(*)::int AS n FROM capacity_reservations WHERE visit_id=${id} AND status='ACTIVE'`,
    ))!.n,
    0,
  );
  assert.equal(
    (await one(
      api.db.db,
      sql`SELECT count(*)::int AS n FROM visit_media WHERE id=${media.id}`,
    ))!.n,
    1,
  );
  for (const client of [a, manager]) {
    for (const path of [
      `admin/service-visits/${id}`,
      `admin/service-visits/${id}/workflow`,
      `admin/service-visits/${id}/events`,
      `admin/quote-revisions/${q.id}/print`,
      `admin/visit-media/${media.id}`,
    ])
      assert.equal((await client.call("GET", path)).status, 404, path);
    assert.equal(
      good(await client.call("GET", `admin/service-visits?q=${before.code}`))
        .length,
      0,
    );
    assert.equal(
      good(await client.call("GET", `admin/quotes?q=${before.code}`)).length,
      0,
    );
    assert.equal(
      (
        await client.call("POST", `admin/service-visits/${id}/inspection`, {
          expectedVersion: removed.version,
          reason: "Must remain hidden",
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await client.call("PATCH", `admin/quote-revisions/${q.id}`, {
          ...q.draft,
          reason: "Must remain hidden",
          expectedVersion: removed.version,
        })
      ).status,
      404,
    );
  }
  assert.ok(
    !good(await a.call("GET", "admin/my-visit-history?limit=100")).some(
      (entry: any) => entry.visitId === id,
    ),
  );
  for (const path of [
    `admin/customers/${before.customerId}`,
    `admin/vehicles/${before.vehicleId}`,
  ]) {
    assert.equal((await a.call("GET", path)).status, 200);
    assert.equal((await b.call("GET", path)).status, 404);
  }
  const next = await walk({
    customer: { id: before.customerId },
    vehicle: { id: before.vehicleId },
  });
  assert.notEqual(next.visitId, id);
  assert.equal((await detail(next.visitId)).vehicleId, before.vehicleId);
});

test("Service visit deletion enforces ownership, permission, version and one concurrent deletion", async () => {
  const id = (await walk()).visitId,
    before = await detail(id),
    path = `admin/service-visits/${id}`,
    body = { expectedVersion: before.version };
  const noPermission = new Client();
  good(
    await manager.call("POST", "admin/staff", {
      name: "CMS deletion test",
      phone: "0901234567",
      email: "cms-delete@v2.test",
      jobRole: "MANAGER",
      active: true,
      account: {
        email: "cms-delete@v2.test",
        temporaryPassword: password,
        role: "CMS_ADMIN",
        permissions: [],
      },
    }),
  );
  await noPermission.login("cms-delete@v2.test");
  good(
    await noPermission.call("POST", "admin/auth/change-password", {
      currentPassword: password,
      newPassword,
    }),
  );
  assert.equal((await noPermission.call("DELETE", path, body)).status, 403);
  assert.equal((await b.call("DELETE", path, body)).status, 404);
  assert.equal(
    (await a.call("DELETE", `admin/service-visits/${randomUUID()}`, body))
      .status,
    404,
  );
  const stale = await a.call("DELETE", path, {
    expectedVersion: before.version + 1,
  });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.error.code, "VERSION_CONFLICT");
  for (const payload of [
    {},
    { expectedVersion: "1" },
    { ...body, canDelete: true },
    { ...body, deleted_at: "2026-11-16T03:00:00Z" },
  ]) {
    assert.equal((await a.call("DELETE", path, payload)).status, 400);
  }
  assert.equal((await detail(id)).version, before.version);
  const results = await Promise.all([
    a.call("DELETE", path, body),
    a.call("DELETE", path, body),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 404]);
  assert.equal(
    (await one(
      api.db.db,
      sql`SELECT version FROM service_visits WHERE id=${id}`,
    ))!.version,
    before.version + 1,
  );
});

test("Service visit deletion accepts every V1 and V2 stage and preserves paused work history", async () => {
  const cases = [
    ...["RECEIVED", "INSPECTED", "IN_PROGRESS", "QUALITY_CHECK", "READY", "HANDED_OVER", "ABORTED"].map(stage => ({ version: 1, stage, paused: false })),
    ...["QUOTING", "WAITING_FOR_WORK", "IN_PROGRESS", "HANDOVER", "COMPLETED", "ABORTED"].map(stage => ({ version: 2, stage, paused: false })),
    { version: 2, stage: "IN_PROGRESS", paused: true },
  ];
  for (const state of cases) {
    const id = (await walk()).visitId;
    // Seed stages directly to isolate archival invariants from transition validation.
    await api.db.db.execute(sql`UPDATE service_visits SET workflow_version=${state.version},stage=${state.stage},is_paused=${state.paused},pause_reason=${state.paused ? "Waiting for customer" : null},paused_at=${state.paused ? config.now() : null} WHERE id=${id}`);
    const order = (await one(api.db.db, sql`INSERT INTO work_orders(visit_id,status) VALUES(${id},${state.stage === "COMPLETED" || state.stage === "HANDED_OVER" || state.stage === "HANDOVER" ? "FINISHED" : state.paused ? "PAUSED" : "IN_PROGRESS"}) RETURNING *`))!;
    const item = (await one(api.db.db, sql`INSERT INTO work_items(work_order_id,label,due_at) VALUES(${order.id},'Retained task',${config.now()}) RETURNING *`))!;
    const log = (await one(api.db.db, sql`INSERT INTO work_logs(work_order_id,actor_user_id,occurred_at,type,note) SELECT ${order.id},received_by,received_at,'NOTE','Retained history' FROM service_visits WHERE id=${id} RETURNING *`))!;
    const before = (await one(api.db.db, sql`SELECT stage,is_paused,pause_reason,paused_at,ready_at,handed_over_at,aborted_at FROM service_visits WHERE id=${id}`))!;
    const visible = await detail(id);
    assert.equal(visible.canDelete, true, `${state.version}/${state.stage}/${state.paused}`);
    const removed = good(await a.call("DELETE", `admin/service-visits/${id}`, { expectedVersion: visible.version }));
    assert.equal(removed.stage, state.stage);
    assert.deepEqual(await one(api.db.db, sql`SELECT stage,is_paused,pause_reason,paused_at,ready_at,handed_over_at,aborted_at FROM service_visits WHERE id=${id}`), before);
    assert.equal((await one(api.db.db, sql`SELECT status FROM work_orders WHERE id=${order.id}`))!.status, order.status === "FINISHED" ? "FINISHED" : "ABORTED");
    assert.deepEqual(await one(api.db.db, sql`SELECT * FROM work_items WHERE id=${item.id}`), item);
    assert.deepEqual(await one(api.db.db, sql`SELECT * FROM work_logs WHERE id=${log.id}`), log);
    assert.equal((await a.call("GET", `admin/service-visits/${id}`)).status, 404);
  }
  const id = (await walk()).visitId, q = await quote(id);
  good(await act(id, `admin/quote-revisions/${q.id}`, q.draft, "PATCH"));
  good(await act(id, `admin/quote-revisions/${q.id}/submit`));
  const submitted = (await one(api.db.db, sql`SELECT * FROM quote_revisions WHERE id=${q.id}`))!;
  good(await a.call("DELETE", `admin/service-visits/${id}`, { expectedVersion: (await detail(id)).version }));
  assert.deepEqual(await one(api.db.db, sql`SELECT * FROM quote_revisions WHERE id=${q.id}`), submitted);
});

test("Service visit deletion retains completed money and follow-up while allowing authorized credit and refund", async () => {
  const id = (await walk()).visitId;
  await close(id, await quote(id));
  good(await act(id, `admin/service-visits/${id}/work/start`));
  good(await finish(id));
  good(await act(id, `admin/service-visits/${id}/handover`, {
    recipientName: "Customer", evidenceNote: "Vehicle delivered and paid", vehicleMoved: true,
    paymentBasis: "SETTLED", paymentReceived: true,
  }));
  const before = await detail(id), balance = (await workflow(id)).settlement;
  const follow = await walk({ customer: { id: before.customerId }, vehicle: { id: before.vehicleId }, followUpOfVisitId: id });
  const payment = (await one(api.db.db, sql`SELECT * FROM cash_entries WHERE visit_id=${id}`))!;
  const allocation = (await one(api.db.db, sql`SELECT * FROM cash_allocations WHERE visit_id=${id}`))!;
  const handover = await one(api.db.db, sql`SELECT * FROM visit_handovers WHERE visit_id=${id}`);
  const quotes = await rows(api.db.db, sql`SELECT * FROM quote_revisions WHERE visit_id=${id} ORDER BY id`);
  const removed = good(await a.call("DELETE", `admin/service-visits/${id}`, { expectedVersion: before.version }));
  assert.equal(removed.stage, "COMPLETED");
  assert.equal((await detail(follow.visitId)).followUpOfVisitId, id);
  assert.deepEqual(await one(api.db.db, sql`SELECT * FROM cash_entries WHERE id=${payment.id}`), payment);
  assert.deepEqual(await one(api.db.db, sql`SELECT * FROM cash_allocations WHERE id=${allocation.id}`), allocation);
  assert.deepEqual(await one(api.db.db, sql`SELECT * FROM visit_handovers WHERE visit_id=${id}`), handover);
  assert.deepEqual(await rows(api.db.db, sql`SELECT * FROM quote_revisions WHERE visit_id=${id} ORDER BY id`), quotes);
  const account = good(await manager.call("GET", `admin/finance/accounts?visitId=${id}`))[0];
  assert.ok(account.deletedAt);
  assert.equal(account.balance.total, balance.total);
  assert.equal(account.balance.netReceived, balance.netReceived);
  assert.equal((await a.call("GET", `admin/finance/accounts?visitId=${id}`)).status, 403);
  const refundPath = `admin/finance/payments/${payment.id}/refund`;
  const refund = { commandId: randomUUID(), kind: "REFUND", amount: "10000", expectedRefundable: "99000", allocationId: allocation.id, method: "CASH", reference: "ARCHIVE-REFUND", reason: "Refund approved correction" };
  const blocked = await manager.call("POST", refundPath, refund);
  assert.equal(blocked.body.error.code, "REFUND_REOPENS_SETTLED_VISIT");
  const creditPath = `admin/service-visits/${id}/credits`;
  const credit = { commandId: randomUUID(), expectedVersion: account.version, amount: "10000", evidence: "Approved price correction", reason: "Correct archived invoice" };
  assert.equal((await a.call("POST", creditPath, credit)).status, 403);
  const creditKey = randomUUID(), credited = good(await manager.call("POST", creditPath, credit, creditKey));
  assert.deepEqual(good(await manager.call("POST", creditPath, credit, creditKey)), credited);
  assert.equal((await a.call("POST", refundPath, refund)).status, 403);
  const refundKey = randomUUID(), refunded = good(await manager.call("POST", refundPath, refund, refundKey));
  assert.deepEqual(good(await manager.call("POST", refundPath, refund, refundKey)), refunded);
  const adjusted = good(await manager.call("GET", `admin/finance/accounts?visitId=${id}`))[0];
  assert.equal(adjusted.balance.total, "89000");
  assert.equal(adjusted.balance.netReceived, "89000");
  assert.equal(adjusted.balance.outstanding, "0");
  assert.equal((await a.call("GET", `admin/service-visits/${id}`)).status, 404);
});

test("Service visit deletion preserves unpaid obligations and permits manager allocation and collection", async () => {
  const id = (await walk()).visitId;
  await close(id, await quote(id));
  good(await act(id, `admin/service-visits/${id}/work/start`));
  good(await finish(id));
  const before = await detail(id);
  const deposit = good(await manager.call("POST", "admin/finance/payments", {
    commandId: randomUUID(), expectedVersion: 1, kind: "DEPOSIT", customerId: before.customerId,
    amount: "30000", method: "CASH", reference: "ARCHIVE-DEPOSIT", payerName: "Customer", reason: "Customer advance",
  }));
  const removed = good(await a.call("DELETE", `admin/service-visits/${id}`, { expectedVersion: before.version }));
  const account = good(await manager.call("GET", `admin/finance/accounts?visitId=${id}&outstandingOnly=true`))[0];
  assert.equal(account.balance.outstanding, "99000");
  assert.equal(account.stage, "HANDOVER");
  const allocationPath = `admin/finance/payments/${deposit.id}/allocate`;
  const allocation = { commandId: randomUUID(), expectedVersion: removed.version, visitId: id, amount: "30000", expectedAvailable: "30000", reason: "Allocate retained deposit" };
  assert.equal((await a.call("POST", allocationPath, allocation)).status, 403);
  const allocationKey = randomUUID(), allocated = good(await manager.call("POST", allocationPath, allocation, allocationKey));
  assert.deepEqual(good(await manager.call("POST", allocationPath, allocation, allocationKey)), allocated);
  const payment = { commandId: randomUUID(), expectedVersion: allocated.version, kind: "COLLECT", visitId: id, amount: "69000", method: "CASH", reference: "ARCHIVE-COLLECT", payerName: "Customer", reason: "Settle retained obligation" };
  assert.equal((await a.call("POST", "admin/finance/payments", payment)).status, 403);
  const paymentKey = randomUUID(), paid = good(await manager.call("POST", "admin/finance/payments", payment, paymentKey));
  assert.deepEqual(good(await manager.call("POST", "admin/finance/payments", payment, paymentKey)), paid);
  const settled = good(await manager.call("GET", `admin/finance/accounts?visitId=${id}`))[0];
  assert.equal(settled.balance.netReceived, "99000");
  assert.equal(settled.balance.outstanding, "0");
  assert.equal((await one(api.db.db, sql`SELECT count(*)::int AS n FROM cash_entries WHERE visit_id=${id}`))!.n, 1);
});

test("Service visit deletion releases stock reservations, retains issues and allows returns without reopening", async () => {
  const id = (await walk()).visitId, q = await quote(id, "0");
  (q.draft.lines as any[]).push({ kind: "PART", name: "Archived part", code: "DELETE_PART", unit: "piece", quantity: "2", unitPrice: "0", discountPercent: "0", vatPercent: "0" });
  await close(id, q);
  good(await act(id, `admin/service-visits/${id}/work/start`));
  const warehouse = good(await manager.call("POST", "admin/stock/warehouses", { code: "DELETE_KHO", name: "Archive warehouse" }));
  const part = good(await manager.call("POST", "admin/stock/parts", { code: "DELETE_PART", name: "Archived part", unit: "piece" }));
  async function draft(kind: string, lines: any[]) {
    return good(await manager.call("POST", "admin/stock/documents", { commandId: randomUUID(), warehouseId: warehouse.id, kind, reason: "Archive stock check", lines }));
  }
  async function post(doc: any) {
    return manager.call("POST", `admin/stock/documents/${doc.id}/post`, { expectedVersion: doc.version, reason: "Post stock ledger" });
  }
  good(await post(await draft("RECEIPT", [{ partId: part.id, quantity: "2", unitCost: "50000" }])));
  const line = (await workflow(id)).stock.lines[0];
  const request = good(await act(id, `admin/service-visits/${id}/stock-requests`, { quoteLineId: line.quoteLineId, partId: part.id, warehouseId: warehouse.id }, "POST", manager));
  const storedRequest = (await one(api.db.db, sql`SELECT version FROM stock_requests WHERE id=${request.requestId}`))!;
  good(await manager.call("POST", `admin/stock/requests/${request.requestId}/reservation`, { expectedVersion: storedRequest.version, quantity: "2", action: "RESERVE", reason: "Reserve approved parts" }));
  const issue = await draft("ISSUE", [{ partId: part.id, quantity: "1", requestId: request.requestId }]);
  good(await post(issue));
  const issueLine = (await one(api.db.db, sql`SELECT * FROM stock_document_lines WHERE document_id=${issue.id}`))!;
  const ledger = await rows(api.db.db, sql`SELECT * FROM stock_ledger WHERE warehouse_id=${warehouse.id} ORDER BY id`);
  assert.equal((await one(api.db.db, sql`SELECT reserved FROM stock_requests WHERE id=${request.requestId}`))!.reserved, "1.000");
  // Legacy READY would normally reopen on RETURN; archiving must suppress that transition.
  await api.db.db.execute(sql`UPDATE service_visits SET workflow_version=1,stage='READY' WHERE id=${id}`);
  await api.db.db.execute(sql`UPDATE work_orders SET status='FINISHED',finished_at=${config.now()} WHERE visit_id=${id}`);
  good(await a.call("DELETE", `admin/service-visits/${id}`, { expectedVersion: (await detail(id)).version }));
  assert.equal((await one(api.db.db, sql`SELECT reserved FROM stock_requests WHERE id=${request.requestId}`))!.reserved, "0.000");
  const stock = (await one(api.db.db, sql`SELECT on_hand,reserved FROM stock_balances WHERE warehouse_id=${warehouse.id} AND part_id=${part.id}`))!;
  assert.equal(stock.reserved, "0.000");
  assert.equal(stock.on_hand, "1.000");
  assert.deepEqual(await rows(api.db.db, sql`SELECT * FROM stock_ledger WHERE warehouse_id=${warehouse.id} ORDER BY id`), ledger);
  assert.deepEqual(await one(api.db.db, sql`SELECT * FROM stock_document_lines WHERE id=${issueLine.id}`), issueLine);
  const nextIssue = await draft("ISSUE", [{ partId: part.id, quantity: "1", requestId: request.requestId }]);
  assert.equal((await post(nextIssue)).status, 404);
  const returned = await draft("RETURN", [{ partId: part.id, quantity: "1", originalLineId: issueLine.id, returnCondition: "RESTOCK" }]);
  good(await post(returned));
  const archived = (await one(api.db.db, sql`SELECT stage,deleted_at FROM service_visits WHERE id=${id}`))!;
  assert.ok(archived.deleted_at);
  assert.equal(archived.stage, "READY");
  assert.equal((await one(api.db.db, sql`SELECT status FROM work_orders WHERE visit_id=${id}`))!.status, "FINISHED");
  assert.equal((await one(api.db.db, sql`SELECT on_hand FROM stock_balances WHERE warehouse_id=${warehouse.id} AND part_id=${part.id}`))!.on_hand, "2.000");
  assert.equal((await a.call("GET", `admin/service-visits/${id}`)).status, 404);
});

test("Service visit deletion cancels its arrived booking and preserves the historical link", async () => {
  const n = ++serial,
    booking = good(
      await a.call("POST", "public/bookings", {
        customer: {
          name: "Deletion booking customer",
          phone: "0923" + String(n).padStart(6, "0"),
        },
        serviceIds: [service],
        requestedDate: "2026-11-17",
        requestedPeriod: "MORNING",
        catalogVersion: (await versions()).catalogVersion,
        notice: {
          privacyNoticeVersion: "BOOKING_V1",
          privacyNoticeAcknowledged: true,
        },
      }),
    ),
    booked = good(await a.call("GET", `admin/bookings/${booking.bookingId}`)),
    confirmed = good(
      await a.call("POST", `admin/bookings/${booking.bookingId}/confirm`, {
        expectedVersion: booked.version,
        confirmedStartAt: "2026-11-17T09:00:00+07:00",
        customerAgreed: true,
        reason: "Customer confirmed",
      }),
    ),
    received = good(
      await a.call("POST", `admin/bookings/${booking.bookingId}/receive`, {
        expectedVersion: confirmed.version,
        vehicle: {
          model: "Honda City",
          plate: "51D" + String(++serial).padStart(5, "0"),
        },
        vehicleVerified: true,
        policyVersion: (await versions()).policyVersion,
        intake: {
          request: "Inspection",
          odometer: 1000,
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
        },
      }),
    ),
    id = received.visitId;
  assert.equal(
    good(await a.call("GET", `admin/bookings/${booking.bookingId}`)).status,
    "ARRIVED",
  );
  const removed = good(
    await a.call("DELETE", `admin/service-visits/${id}`, {
      expectedVersion: (await detail(id)).version,
    }),
  );
  assert.equal(removed.bookingId, booking.bookingId);
  const currentBooking = good(
    await a.call("GET", `admin/bookings/${booking.bookingId}`),
  );
  assert.equal(currentBooking.status, "CANCELLED");
  assert.equal(currentBooking.serviceVisitId, null);
  assert.equal(
    (await one(
      api.db.db,
      sql`SELECT booking_id FROM service_visits WHERE id=${id}`,
    ))!.booking_id,
    booking.bookingId,
  );
  assert.equal(
    (await one(
      api.db.db,
      sql`SELECT count(*)::int AS n FROM booking_events WHERE booking_id=${booking.bookingId} AND type='BOOKING_VISIT_DELETED'`,
    ))!.n,
    1,
  );
  assert.equal(
    (await one(
      api.db.db,
      sql`SELECT count(*)::int AS n FROM capacity_reservations WHERE (visit_id=${id} OR booking_id=${booking.bookingId}) AND status='ACTIVE'`,
    ))!.n,
    0,
  );
  assert.ok(
    !good(
      await a.call("GET", "admin/bookings?status=PENDING,ARRIVED&limit=100"),
    ).some((entry: any) => entry.id === booking.bookingId),
  );
});

test("V2 quote close is atomic, immutable, partial scope is priced once and concurrent decisions conflict", async () => {
  const v = await walk();
  assert.equal(v.stage, "QUOTING");
  assert.equal(
    (await act(v.visitId, `admin/service-visits/${v.visitId}/work/start`))
      .status,
    409,
  );
  const q = await quote(v.visitId);
  q.draft.lines.push({
    ...q.draft.lines[0],
    name: "Không đồng ý",
    unitPrice: "200000",
  });
  good(await act(v.visitId, `admin/quote-revisions/${q.id}`, q.draft, "PATCH"));
  good(await act(v.visitId, `admin/quote-revisions/${q.id}/submit`));
  let w = await workflow(v.visitId);
  const lines = w.quotes[0].lines,
    version = w.version,
    key = randomUUID();
  const body = {
    expectedVersion: version,
    reason: "Khách duyệt một phần",
    decision: "APPROVED",
    approvedLineIds: [lines[0].id],
    evidence,
  };
  good(
    await a.call("POST", `admin/quote-revisions/${q.id}/decision`, body, key),
  );
  good(
    await a.call("POST", `admin/quote-revisions/${q.id}/decision`, body, key),
  );
  assert.equal(
    (await a.call("POST", `admin/quote-revisions/${q.id}/decision`, body))
      .status,
    409,
  );
  w = await workflow(v.visitId);
  assert.equal(w.stage, "WAITING_FOR_WORK");
  assert.equal(w.obligation.total, "99000");
  assert.equal(w.approvedLines.length, 1);
  assert.equal(
    (await act(v.visitId, `admin/quote-revisions/${q.id}`, q.draft, "PATCH"))
      .status,
    409,
  );
  assert.equal(
    (await b.call("GET", `admin/service-visits/${v.visitId}/workflow`)).status,
    404,
  );
  assert.equal(
    (
      await act(v.visitId, `admin/service-visits/${v.visitId}/work-items`, {
        label: "Không duyệt",
        quoteLineId: lines[1].id,
        technicianIds: [],
        dueAt: "2026-11-16T18:00:00+07:00",
      })
    ).status,
    422,
  );
  const printed = good(
    await a.call("GET", `admin/quote-revisions/${q.id}/print`),
  );
  assert.equal(printed.revision.decision.approvedLineIds.length, 1);
  const v2 = await walk(),
    q2 = await quote(v2.visitId, "0");
  await close(v2.visitId, q2);
  assert.equal((await workflow(v2.visitId)).stage, "WAITING_FOR_WORK");
});

test("V2 extras allow independent work, reject and void retain history, no pending money is counted", async () => {
  const v = await walk(),
    id = v.visitId;
  await close(id, await quote(id, "0"));
  good(await act(id, `admin/service-visits/${id}/work/start`));
  const extra = await quote(id, "100000");
  good(
    await act(id, `admin/quote-revisions/${extra.id}`, extra.draft, "PATCH"),
  );
  good(await act(id, `admin/quote-revisions/${extra.id}/submit`));
  let w = await workflow(id);
  assert.equal(w.stage, "IN_PROGRESS");
  assert.equal(w.obligation.total, "0");
  good(
    await act(id, `admin/service-visits/${id}/work/pause`, {
      reason: "Chờ khách",
    }),
  );
  assert.equal((await finish(id)).status, 409);
  good(await act(id, `admin/service-visits/${id}/work/resume`));
  assert.equal((await finish(id)).status, 409);
  good(
    await act(id, `admin/quote-revisions/${extra.id}/decision`, {
      decision: "REJECTED",
      evidence,
    }),
  );
  const next = await quote(id, "100000");
  await close(id, next);
  w = await workflow(id);
  assert.equal(w.stage, "IN_PROGRESS");
  assert.equal(w.isPaused, false);
  assert.equal(w.obligation.total, "99000");
  const other = await quote(id, "50000");
  await close(id, other);
  w = await workflow(id);
  assert.equal(w.obligation.total, "148500");
  assert.equal(
    (await act(id, `admin/quote-revisions/${other.id}/void`)).status,
    403,
  );
  good(
    await act(
      id,
      `admin/quote-revisions/${other.id}/void`,
      {},
      "POST",
      manager,
    ),
  );
  assert.equal((await workflow(id)).obligation.total, "99000");
  const draft = await quote(id);
  good(await act(id, `admin/quote-revisions/${draft.id}/void`));
  assert.equal((await workflow(id)).stage, "IN_PROGRESS");
});

test("V2 finish embeds quality, blocks unpaid handover, completes once and creates follow-up without reopening", async () => {
  const v = await walk(),
    id = v.visitId;
  await close(id, await quote(id));
  good(await act(id, `admin/service-visits/${id}/work/start`));
  assert.equal(
    (await act(id, `admin/service-visits/${id}/work/finish`)).status,
    409,
  );
  const w = await workflow(id);
  good(
    await act(id, `admin/service-visits/${id}/acceptances`, {
      inspectorId: advisor.id,
      result: "NEEDS_WORK",
      note: "Cần kiểm tra lại",
      completionConfirmed: false,
      checks: [],
      qualityChecks: w.requiredChecks.map((x: any) => ({
        key: x.key,
        passed: false,
        note: "Cần sửa",
      })),
    }),
  );
  assert.equal((await detail(id)).stage, "IN_PROGRESS");
  good(await finish(id));
  assert.equal((await detail(id)).stage, "HANDOVER");
  const handover = {
    recipientName: "Khách V2",
    evidenceNote: "Đã giao xe và chìa khóa",
    vehicleMoved: true,
    paymentBasis: "SETTLED",
  };
  assert.equal(
    (await act(id, `admin/service-visits/${id}/handover`, handover)).status,
    409,
  );
  good(
    await manager.call("POST", "admin/finance/payments", {
      commandId: randomUUID(),
      expectedVersion: (await detail(id)).version,
      kind: "COLLECT",
      visitId: id,
      amount: "99000",
      method: "CASH",
      reference: "V2-THU",
      payerName: "Khách V2",
      reason: "Thu đủ tiền",
    }),
  );
  good(await act(id, `admin/service-visits/${id}/handover`, handover));
  assert.equal((await detail(id)).stage, "COMPLETED");
  assert.equal(
    (await act(id, `admin/service-visits/${id}/work/start`)).status,
    409,
  );
  const old = await detail(id);
  const follow = await walk({
    customer: { id: old.customerId },
    vehicle: { id: old.vehicleId },
    followUpOfVisitId: id,
    followUpReason: "Khách quay lại kiểm tra",
  });
  assert.equal(follow.stage, "QUOTING");
  assert.equal((await detail(id)).stage, "COMPLETED");
});

test("V2 completion collects only the outstanding balance atomically and never duplicates receipts", async () => {
  const actor = (await one(api.db.db, sql`SELECT user_id FROM staff_profiles WHERE id=${advisor.id}`))!.user_id;
  for (const prepaid of ["0", "30000", "99000", "FREE"]) {
    const id = (await walk()).visitId;
    await close(id, await quote(id, prepaid === "FREE" ? "0" : "100000"));
    good(await act(id, `admin/service-visits/${id}/work/start`));
    good(await finish(id));
    const total = prepaid === "FREE" ? "0" : "99000";
    const payment = {
      commandId: randomUUID(),
      expectedVersion: (await detail(id)).version,
      kind: "COLLECT",
      visitId: id,
      amount: prepaid,
      method: "CASH",
      reference: "V2-PREPAID",
      payerName: "Khách V2",
      reason: "Thu trước khi bàn giao",
    };
    if (prepaid === "0") {
      assert.equal((await a.call("POST", "admin/finance/payments", {
        ...payment,
        amount: total,
      })).status, 403);
    } else if (prepaid !== "FREE") {
      good(await manager.call("POST", "admin/finance/payments", payment));
    }
    const before = await workflow(id);
    const due = before.settlement.outstanding;
    const path = `admin/service-visits/${id}/handover`;
    const body = {
      expectedVersion: before.version,
      reason: "Xác nhận hoàn thành và đã thu đủ",
      recipientName: "Khách V2",
      evidenceNote: "Đã giao xe và thu đủ chi phí",
      vehicleMoved: true,
      paymentBasis: total === "0" ? "NO_CHARGE" : "SETTLED",
      paymentReceived: true,
    };
    const keys = [randomUUID(), randomUUID()];
    const results = prepaid === "0"
      ? await Promise.all(keys.map((key) => a.call("POST", path, body, key)))
      : [await a.call("POST", path, body, keys[0])];
    if (prepaid === "0") {
      assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    }
    const winner = results.findIndex((r) => r.status === 200);
    const receipt = good(results[winner]);
    assert.deepEqual(good(await a.call("POST", path, body, keys[winner])), receipt);
    assert.equal((await a.call("POST", path, body)).status, 409);
    const after = await workflow(id);
    assert.equal(after.stage, "COMPLETED");
    assert.equal((await a.call("POST", path, { ...body, expectedVersion: after.version })).status, 409);
    assert.equal(after.version, before.version + (due === "0" ? 1 : 2));
    assert.equal(after.settlement.netReceived, total);
    assert.equal(after.settlement.outstanding, "0");
    assert.equal(after.settlement.paymentStatus, "SETTLED");
    const entries = await rows(api.db.db, sql`SELECT * FROM cash_entries WHERE visit_id=${id} ORDER BY amount`);
    const collected = entries.filter((entry) => entry.method === "OTHER");
    assert.equal(collected.length, due === "0" ? 0 : 1);
    if (collected.length) {
      assert.equal(collected[0].kind, "COLLECT");
      assert.equal(collected[0].amount, due);
      assert.equal(collected[0].recorded_by, actor);
      assert.equal(collected[0].payer_name, "Khách V2");
      assert.ok(collected[0].reference.includes((await detail(id)).code));
    }
    const allocations = await rows(api.db.db, sql`SELECT * FROM cash_allocations WHERE visit_id=${id}`);
    assert.equal(allocations.length, entries.length);
    for (const entry of entries) {
      assert.equal(allocations.find((allocation) => allocation.payment_id === entry.id)?.amount, entry.amount);
    }
    const handovers = await rows(api.db.db, sql`SELECT * FROM visit_handovers WHERE visit_id=${id}`);
    assert.equal(handovers.length, 1);
    assert.equal(handovers[0].approved_obligation, total);
    assert.equal(handovers[0].net_received, total);
    const events = await rows(api.db.db, sql`SELECT type FROM visit_events WHERE visit_id=${id} AND type IN ('CASH_COLLECT','VISIT_COMPLETED')`);
    assert.equal(events.filter((event) => event.type === "CASH_COLLECT").length, entries.length);
    assert.equal(events.filter((event) => event.type === "VISIT_COMPLETED").length, 1);
  }
});

test("V2 completion preserves payment opt-in, access and business gates and rolls back failed handover", async () => {
  const id = (await walk()).visitId;
  await close(id, await quote(id));
  good(await act(id, `admin/service-visits/${id}/work/start`));
  good(await finish(id));
  const path = `admin/service-visits/${id}/handover`;
  const body = {
    expectedVersion: (await detail(id)).version,
    reason: "Xác nhận hoàn thành phiếu",
    recipientName: "Khách V2",
    evidenceNote: "Đã giao xe và thu đủ chi phí",
    vehicleMoved: true,
    paymentBasis: "SETTLED",
  };
  async function snapshot(visitId: string) {
    const visit = await detail(visitId);
    return {
      version: visit.version,
      stage: visit.stage,
      counts: await one(api.db.db, sql`SELECT
        (SELECT count(*)::int FROM cash_entries WHERE visit_id=${visitId}) AS payments,
        (SELECT count(*)::int FROM cash_allocations WHERE visit_id=${visitId}) AS allocations,
        (SELECT count(*)::int FROM visit_handovers WHERE visit_id=${visitId}) AS handovers,
        (SELECT count(*)::int FROM visit_events WHERE visit_id=${visitId}) AS events`),
    };
  }
  const before = await snapshot(id);
  for (const optIn of [{}, { paymentReceived: false }]) {
    const denied = await a.call("POST", path, { ...body, ...optIn });
    assert.equal(denied.status, 409);
    assert.equal(denied.body.error.code, "PAYMENT_REQUIRED");
  }
  assert.equal((await b.call("POST", path, { ...body, paymentReceived: true })).status, 404);
  const stale = await a.call("POST", path, { ...body, paymentReceived: true, expectedVersion: body.expectedVersion - 1 });
  assert.equal(stale.body.error.code, "VERSION_CONFLICT");
  const invalidBasis = await a.call("POST", path, { ...body, paymentReceived: true, paymentBasis: "NO_CHARGE" });
  assert.equal(invalidBasis.body.error.code, "PAYMENT_BASIS_INVALID");
  assert.equal((await a.call("POST", path, { ...body, paymentReceived: "true" })).status, 400);
  assert.equal((await a.call("POST", path, { ...body, paymentReceived: true, amount: "1" })).status, 400);
  assert.deepEqual(await snapshot(id), before);
  const release = api.inventory.releaseVisit;
  let collectedBeforeFailure = false;
  const key = randomUUID();
  api.inventory.releaseVisit = async (c, _ctx, visitId) => {
    const entry = await one(c, sql`SELECT amount FROM cash_entries WHERE visit_id=${visitId}`);
    collectedBeforeFailure = entry?.amount === "99000";
    throw new Error("Forced handover failure after collection");
  };
  try {
    assert.equal((await a.call("POST", path, { ...body, paymentReceived: true }, key)).status, 500);
  } finally {
    api.inventory.releaseVisit = release;
  }
  assert.equal(collectedBeforeFailure, true);
  assert.deepEqual(await snapshot(id), before);
  good(await a.call("POST", path, { ...body, paymentReceived: true }, key));
  assert.equal((await workflow(id)).settlement.outstanding, "0");

  const stockId = (await walk()).visitId;
  const q = await quote(stockId);
  (q.draft.lines as any[]).push({
    kind: "PART", name: "Lọc chưa xuất kho", code: "V2_UNSETTLED", unit: "Cái",
    quantity: "1", unitPrice: "0", discountPercent: "0", vatPercent: "0",
  });
  await close(stockId, q);
  good(await act(stockId, `admin/service-visits/${stockId}/work/start`));
  good(await finish(stockId));
  const stockBefore = await snapshot(stockId);
  const blocked = await act(stockId, `admin/service-visits/${stockId}/handover`, {
    ...body, expectedVersion: stockBefore.version, paymentReceived: true,
  });
  assert.equal(blocked.body.error.code, "STOCK_SETTLEMENT_REQUIRED");
  assert.deepEqual(await snapshot(stockId), stockBefore);
});

test("V2 public booking receive and completion update one linked visit; concurrent start is serialized", async () => {
  const n = ++serial;
  const booking = good(
    await a.call("POST", "public/bookings", {
      customer: {
        name: "Khách đặt lịch",
        phone: "0922" + String(n).padStart(6, "0"),
      },
      serviceIds: [service],
      requestedDate: "2026-11-17",
      requestedPeriod: "MORNING",
      catalogVersion: (await versions()).catalogVersion,
      notice: {
        privacyNoticeVersion: "BOOKING_V1",
        privacyNoticeAcknowledged: true,
      },
    }),
  );
  const booked = good(
    await a.call("GET", `admin/bookings/${booking.bookingId}`),
  );
  const confirmed = good(
    await a.call("POST", `admin/bookings/${booking.bookingId}/confirm`, {
      expectedVersion: booked.version,
      confirmedStartAt: "2026-11-17T09:00:00+07:00",
      customerAgreed: true,
      reason: "Đã thống nhất với khách",
    }),
  );
  const n2 = ++serial,
    receive = {
      expectedVersion: confirmed.version,
      vehicle: {
        model: "Honda City",
        plate: "51B" + String(n2).padStart(5, "0"),
      },
      vehicleVerified: true,
      policyVersion: (await versions()).policyVersion,
      intake: {
        request: "Kiểm tra xe",
        odometer: 3000,
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
      },
    };
  const key = randomUUID(),
    v = good(
      await a.call(
        "POST",
        `admin/bookings/${booking.bookingId}/receive`,
        receive,
        key,
      ),
    );
  assert.equal(
    good(
      await a.call(
        "POST",
        `admin/bookings/${booking.bookingId}/receive`,
        receive,
        key,
      ),
    ).visitId,
    v.visitId,
  );
  assert.equal(
    (await one(
      api.db.db,
      sql`SELECT count(*)::int AS n FROM service_visits WHERE booking_id=${booking.bookingId}`,
    ))!.n,
    1,
  );
  assert.equal(
    good(await a.call("GET", `admin/bookings/${booking.bookingId}`)).status,
    "ARRIVED",
  );
  await close(v.visitId, await quote(v.visitId, "0"));
  const version = (await detail(v.visitId)).version;
  const results = await Promise.all(
    [1, 2].map(() =>
      a.call("POST", `admin/service-visits/${v.visitId}/work/start`, {
        expectedVersion: version,
        reason: "Bắt đầu thực tế",
      }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  good(await finish(v.visitId));
  good(
    await act(v.visitId, `admin/service-visits/${v.visitId}/handover`, {
      recipientName: "Khách đặt lịch",
      evidenceNote: "Đã giao xe",
      vehicleMoved: true,
      paymentBasis: "NO_CHARGE",
    }),
  );
  assert.equal(
    good(await a.call("GET", `admin/bookings/${booking.bookingId}`)).status,
    "COMPLETED",
  );
  const filtered = good(
    await manager.call("GET", "admin/service-visits?ticketStage=COMPLETED"),
  );
  assert.ok(filtered.some((x: any) => x.id === v.visitId));
});

test("V2 stock blocks completion until parts are posted; aborted paused visit stays closed", async () => {
  const v = await walk(),
    id = v.visitId,
    q = await quote(id, "0");
  (q.draft.lines as any[]).push({
    kind: "PART",
    name: "Lọc dầu",
    code: "LOC_V2",
    unit: "Cái",
    quantity: "1",
    unitPrice: "0",
    discountPercent: "0",
    vatPercent: "0",
  });
  await close(id, q);
  good(await act(id, `admin/service-visits/${id}/work/start`));
  good(await finish(id));
  const handover = {
    recipientName: "Khách",
    evidenceNote: "Đã giao xe",
    vehicleMoved: true,
    paymentBasis: "NO_CHARGE",
  };
  const blocked = await act(
    id,
    `admin/service-visits/${id}/handover`,
    handover,
  );
  assert.equal(blocked.body.error.code, "STOCK_SETTLEMENT_REQUIRED");
  const warehouse = good(
    await manager.call("POST", "admin/stock/warehouses", {
      code: "V2_KHO",
      name: "Kho V2",
    }),
  );
  const part = good(
    await manager.call("POST", "admin/stock/parts", {
      code: "V2_LOC",
      name: "Lọc dầu",
      unit: "Cái",
    }),
  );
  async function post(kind: string, lines: any[]) {
    const d = good(
      await manager.call("POST", "admin/stock/documents", {
        commandId: randomUUID(),
        warehouseId: warehouse.id,
        kind,
        reason: "Xuất nhập có căn cứ",
        lines,
      }),
    );
    good(
      await manager.call("POST", `admin/stock/documents/${d.id}/post`, {
        expectedVersion: d.version,
        reason: "Ghi sổ kho",
      }),
    );
  }
  await post("RECEIPT", [
    { partId: part.id, quantity: "1", unitCost: "50000" },
  ]);
  const line = (await workflow(id)).stock.lines[0];
  const req = good(
    await act(
      id,
      `admin/service-visits/${id}/stock-requests`,
      {
        quoteLineId: line.quoteLineId,
        partId: part.id,
        warehouseId: warehouse.id,
      },
      "POST",
      manager,
    ),
  );
  await post("ISSUE", [
    { partId: part.id, quantity: "1", requestId: req.requestId },
  ]);
  good(await act(id, `admin/service-visits/${id}/handover`, handover));
  const stopped = await walk();
  await close(stopped.visitId, await quote(stopped.visitId, "0"));
  good(
    await act(
      stopped.visitId,
      `admin/service-visits/${stopped.visitId}/work/start`,
    ),
  );
  good(
    await act(
      stopped.visitId,
      `admin/service-visits/${stopped.visitId}/work/pause`,
      { reason: "Khách không tiếp tục" },
    ),
  );
  assert.equal(
    (
      await act(
        stopped.visitId,
        `admin/service-visits/${stopped.visitId}/abort`,
        { evidenceNote: "Đã đối soát và giao xe", vehicleMoved: true },
      )
    ).status,
    403,
  );
  good(
    await act(
      stopped.visitId,
      `admin/service-visits/${stopped.visitId}/abort`,
      { evidenceNote: "Đã đối soát và giao xe", vehicleMoved: true },
      "POST",
      manager,
    ),
  );
  assert.equal((await workflow(stopped.visitId)).isPaused, false);
});

test("V2 service policy is snapshotted; rejected and incomplete quality never allow handover; legacy retains inspection", async () => {
  const s = good(
    await manager.call("POST", "admin/services", {
      code: "V2_TECH",
      name: "Kiểm tra phanh",
      categoryCode: "MAINTENANCE",
      active: true,
      bookable: true,
      sortOrder: 0,
      estimatedDurationMinutes: 60,
      qualityChecks: ["Thử phanh an toàn"],
      technicianRequired: true,
    }),
  );
  const v = await walk({ serviceIds: [s.id] }),
    id = v.visitId,
    q = await quote(id, "0");
  q.draft.lines[0].serviceId = s.id;
  await close(id, q);
  assert.equal(
    (await act(id, `admin/service-visits/${id}/work/start`)).body.error.code,
    "TECHNICIAN_REQUIRED",
  );
  const w = await workflow(id);
  assert.match(w.requiredChecks[0].label, /Thử phanh/);
  good(
    await manager.call("PATCH", `admin/services/${s.id}`, {
      expectedVersion: s.version,
      reason: "Cập nhật quy trình về sau",
      qualityChecks: [],
      technicianRequired: false,
    }),
  );
  assert.equal((await workflow(id)).requiredChecks.length, 1);
  const legacy = await walk();
  await api.db.db.execute(
    sql`UPDATE service_visits SET workflow_version=1,stage='RECEIVED' WHERE id=${legacy.visitId}`,
  );
  assert.equal((await detail(legacy.visitId)).stage, "RECEIVED");
  assert.equal(
    (
      await act(
        legacy.visitId,
        `admin/service-visits/${legacy.visitId}/work/start`,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await act(
        legacy.visitId,
        `admin/service-visits/${legacy.visitId}/inspection`,
      )
    ).body.error.code,
    "INSPECTION_EMPTY",
  );
  const rejected = await walk(),
    qr = await quote(rejected.visitId);
  good(
    await act(
      rejected.visitId,
      `admin/quote-revisions/${qr.id}`,
      qr.draft,
      "PATCH",
    ),
  );
  good(await act(rejected.visitId, `admin/quote-revisions/${qr.id}/submit`));
  good(
    await act(rejected.visitId, `admin/quote-revisions/${qr.id}/decision`, {
      decision: "REJECTED",
      evidence,
    }),
  );
  assert.equal((await detail(rejected.visitId)).stage, "QUOTING");
  assert.equal((await workflow(rejected.visitId)).obligation.assessed, false);
});
