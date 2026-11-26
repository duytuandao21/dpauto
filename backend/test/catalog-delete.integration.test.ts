import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { migrate } from "../scripts/migrate";
import { bootstrap } from "../scripts/bootstrap";
import { loadConfig } from "../src/config";
import { createApp } from "../src/app";
import { sql, one } from "../src/database";

// Soft delete of catalog records: hidden from management, blocked while still in use.
const url = process.env.DP_TEST_DATABASE_URL;
if (!url || !url.includes("dpauto_test@127.0.0.1:"))
  throw Error("Run through test-phase1.ts; never target a business database.");
const clock = new Date("2026-11-12T03:00:00Z");
const config = {
  ...loadConfig({
    DATABASE_URL: url,
    APP_ORIGIN: "http://localhost:4001",
    API_SECRET: "catalog-delete-isolated-secret-".repeat(3),
    NODE_ENV: "test",
  }),
  now: () => new Date(clock),
};
let app: Awaited<ReturnType<typeof createApp>>["app"],
  api: Awaited<ReturnType<typeof createApp>>["api"];
let sequence = 10;
const password = "Temporary password 123!";
let cookie = "",
  csrf = "";
async function call(method: string, path: string, payload?: unknown) {
  const r = await app.inject({
    method: method as any,
    url: "/api/v1/" + path,
    remoteAddress: "127.0.0." + ((sequence++ % 200) + 10),
    headers: {
      origin: config.origin,
      ...(cookie ? { cookie } : {}),
      ...(method !== "GET"
        ? {
            "content-type": "application/json",
            "x-csrf-token": csrf,
            "idempotency-key": randomUUID(),
          }
        : {}),
    },
    ...(payload !== undefined ? { payload: JSON.stringify(payload) } : {}),
  });
  const set = r.headers["set-cookie"];
  if (set) cookie = String(Array.isArray(set) ? set[0] : set).split(";")[0];
  const body = r.body ? JSON.parse(r.body) : {};
  if (body.data?.csrfToken) csrf = body.data.csrfToken;
  return { status: r.statusCode, body };
}
const ok = (r: { status: number; body: any }, status = 200) => {
  assert.equal(r.status, status, JSON.stringify(r.body));
  return r.body.data;
};
const remove = (path: string, expectedVersion: number) =>
  call("DELETE", path, { expectedVersion });
async function stationVersions() {
  const row = (await one(
    api.db.db,
    sql`SELECT catalog_version,configuration_version FROM stations WHERE code=${config.stationCode}`,
  ))!;
  return {
    catalogVersion: row.catalog_version,
    policyVersion: row.configuration_version,
  };
}
async function createService(code: string) {
  return ok(
    await call("POST", "admin/services", {
      code,
      name: code,
      categoryCode: "DETAILING",
      active: true,
      bookable: true,
      sortOrder: 0,
      estimatedDurationMinutes: 60,
    }),
    201,
  );
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
  await api.db.db.execute(
    sql`INSERT INTO user_permission_grants(user_id,permission_code)
      SELECT u.id,p FROM users u, unnest(ARRAY['inventory.manage','inventory.cost.read']) p WHERE u.email_normalized='manager@example.test'`,
  );
  await call("GET", "admin/auth/csrf");
  ok(
    await call("POST", "admin/auth/login", {
      email: "manager@example.test",
      password,
    }),
  );
  ok(
    await call("POST", "admin/auth/change-password", {
      currentPassword: password,
      newPassword: "Changed password 456!",
    }),
  );
  const hours = Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    opensAt: "08:00",
    closesAt: "18:00",
  }));
  const policy = {
    reason: "Thiết lập nhận lịch",
    slotMinutes: 30,
    maxBookingsPerSlot: 5,
    hours,
  };
  ok(
    await call("PUT", "admin/capacity/policy", {
      ...policy,
      expectedVersion: 1,
      bookingEnabled: false,
    }),
  );
  await createService("WASH");
  ok(
    await call("PUT", "admin/capacity/policy", {
      ...policy,
      expectedVersion: (await stationVersions()).policyVersion,
      bookingEnabled: true,
    }),
  );
});
after(async () => {
  await app.close();
});

test("services, vehicles: blocked while an open booking uses them, hidden after delete", async () => {
  const used = await createService("USED");
  const booking = ok(
    await call("POST", "admin/bookings", {
      customer: { name: "Khách kiểm thử", phone: "0900000001" },
      vehicle: { model: "Toyota Vios", plate: "51A-12345" },
      serviceIds: [used.id],
      requestedStartAt: "2026-11-20T09:00:00+07:00",
      ...(await stationVersions()),
      notice: {
        privacyNoticeVersion: "BOOKING_V1",
        privacyNoticeAcknowledged: true,
      },
      source: "PHONE",
    }),
    201,
  );
  const blocked = await remove(`admin/services/${used.id}`, used.version);
  assert.equal(blocked.status, 409);
  assert.equal(blocked.body.error.code, "SERVICE_IN_USE");
  const detail = ok(await call("GET", `admin/bookings/${booking.bookingId}`));
  const vehicleId = detail.vehicle.id;
  const vehicle = ok(await call("GET", `admin/vehicles/${vehicleId}`));
  const vehicleBlocked = await remove(
    `admin/vehicles/${vehicleId}`,
    vehicle.version,
  );
  assert.equal(vehicleBlocked.body.error.code, "VEHICLE_IN_USE");
  ok(
    await call("POST", `admin/bookings/${booking.bookingId}/cancel`, {
      expectedVersion: detail.version,
      reason: "Khách hủy",
    }),
  );
  ok(await remove(`admin/vehicles/${vehicleId}`, vehicle.version));
  assert.equal((await call("GET", `admin/vehicles/${vehicleId}`)).status, 404);

  const spare = await createService("SPARE");
  ok(await remove(`admin/services/${spare.id}`, spare.version));
  const listed = ok(await call("GET", "admin/services?limit=100")).find(
    (s: any) => s.id === spare.id,
  );
  assert.ok(listed.deletedAt, "deleted service stays resolvable by id");
  assert.equal(listed.active, false);
  assert.equal(listed.bookable, false);
  const again = await call("PATCH", `admin/services/${spare.id}`, {
    expectedVersion: listed.version,
    reason: "Mở lại",
    active: true,
  });
  assert.equal(again.status, 404, "deleted services cannot be edited back");
});

test("staff: cannot delete self; deleting disables the record", async () => {
  const me = ok(await call("GET", "admin/auth/me"));
  const self = await remove(`admin/staff/${me.staff.id}`, 1);
  assert.equal(self.body.error.code, "CANNOT_DELETE_SELF");
  const tech = ok(
    await call("POST", "admin/staff", {
      name: "KTV tạm",
      phone: "0901234568",
      email: "tech@example.test",
      jobRole: "TECHNICIAN",
      active: true,
    }),
    201,
  );
  ok(await remove(`admin/staff/${tech.id}`, tech.version));
  const row = ok(await call("GET", "admin/staff?limit=100")).find(
    (s: any) => s.id === tech.id,
  );
  assert.ok(row.deletedAt);
  assert.equal(row.active, false);
});

test("partners and sales are hidden together", async () => {
  const partner = ok(
    await call("POST", "admin/partners", {
      name: "Đối tác tạm",
      phone: "0901234569",
    }),
    201,
  );
  const sale = ok(
    await call("POST", `admin/partners/${partner.id}/sales`, { name: "Sale A" }),
    201,
  );
  const sale2 = ok(
    await call("POST", `admin/partners/${partner.id}/sales`, { name: "Sale B" }),
    201,
  );
  ok(await remove(`admin/partner-sales/${sale2.id}`, sale2.version));
  ok(await remove(`admin/partners/${partner.id}`, partner.version));
  const p = ok(await call("GET", "admin/partners")).find(
    (x: any) => x.id === partner.id,
  );
  assert.ok(p.deletedAt);
  assert.ok(p.sales.every((s: any) => s.deletedAt && !s.active));
  assert.ok(p.sales.some((s: any) => s.id === sale.id));
});

test("parts: a draft that uses the part blocks delete until the draft is deleted", async () => {
  const warehouse = ok(
    await call("POST", "admin/stock/warehouses", { code: "KHO1", name: "Kho" }),
    201,
  );
  const part = ok(
    await call("POST", "admin/stock/parts", {
      code: "LOC_GIO",
      name: "Lọc gió",
      unit: "Cái",
    }),
    201,
  );
  const draft = ok(
    await call("POST", "admin/stock/documents", {
      commandId: randomUUID(),
      warehouseId: warehouse.id,
      kind: "RECEIPT",
      reason: "Nhập thử",
      lines: [{ partId: part.id, quantity: "1", unitCost: "1000" }],
    }),
    201,
  );
  const blocked = await remove(`admin/stock/parts/${part.id}`, part.version);
  assert.equal(blocked.body.error.code, "STOCK_DRAFTS_REMAIN");
  ok(await remove(`admin/stock/documents/${draft.id}`, draft.version));
  const docs = ok(await call("GET", "admin/stock/documents"));
  assert.ok(!docs.some((d: any) => d.id === draft.id));
  ok(await remove(`admin/stock/parts/${part.id}`, part.version));
  ok(await remove(`admin/stock/warehouses/${warehouse.id}`, warehouse.version));
  const parts = ok(await call("GET", "admin/stock/parts"));
  assert.ok(parts.find((p: any) => p.id === part.id).deletedAt);
});
