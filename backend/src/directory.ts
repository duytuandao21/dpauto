import type { Config } from "./config";
import { sql, rows, one, type Conn, type Row } from "./database";
import { page, scope, fail, normalize, type Context } from "./common";

export class Directory {
  constructor(readonly config: Config) {}
  // Deleted intake records retain customer/vehicle lookup access for their advisor.
  customerScope(ctx: Context) {
    return sql`(EXISTS(SELECT 1 FROM bookings b WHERE b.customer_id=c.id AND ${scope(ctx)}) OR EXISTS(SELECT 1 FROM service_visits sv WHERE sv.customer_id=c.id AND ${scope(ctx, "sv", true)}) ${ctx.actor?.role === "MANAGER" ? sql`OR EXISTS(SELECT 1 FROM cash_entries e WHERE e.customer_id=c.id AND e.station_id=${ctx.station.id}) OR EXISTS(SELECT 1 FROM legacy_identities i WHERE i.customer_id=c.id AND i.entity_type='CUSTOMER' AND i.station_id=${ctx.station.id})` : sql``})`;
  }
  vehicleScope(ctx: Context) {
    return sql`(EXISTS(SELECT 1 FROM bookings b WHERE b.vehicle_id=v.id AND ${scope(ctx)}) OR EXISTS(SELECT 1 FROM service_visits sv WHERE sv.vehicle_id=v.id AND ${scope(ctx, "sv", true)}) ${ctx.actor?.role==='MANAGER'?sql`OR EXISTS(SELECT 1 FROM legacy_identities i WHERE i.vehicle_id=v.id AND i.entity_type='VEHICLE' AND i.station_id=${ctx.station.id})`:sql``})`;
  }
  relatedVehicles(ctx: Context) {
    return sql`SELECT b.vehicle_id FROM bookings b WHERE b.customer_id=c.id AND b.vehicle_id IS NOT NULL AND ${scope(ctx)} UNION SELECT sv.vehicle_id FROM service_visits sv WHERE sv.customer_id=c.id AND ${scope(ctx, "sv", true)} ${ctx.actor?.role==='MANAGER'?sql`UNION SELECT l.vehicle_id FROM customer_vehicle_links l WHERE l.customer_id=c.id AND l.source='MIGRATION'`:sql``}`;
  }
  async customers(c: Conn, ctx: Context, q: Row) {
    const key =
      q.sort === "createdAt:desc" ? sql`c.created_at` : sql`c.normalized_name`;
    const base = sql`SELECT c.*,${key} AS cursor_key,
      (SELECT count(*)::int FROM (${this.relatedVehicles(ctx)}) AS related_vehicles) AS vehicle_count,
      (SELECT count(*)::int FROM bookings b WHERE b.customer_id=c.id AND ${scope(ctx)}) AS booking_count
      FROM customers c WHERE ${this.customerScope(ctx)} ${q.q ? sql`AND (c.normalized_name LIKE ${"%" + normalize(q.q) + "%"} OR c.phone_normalized LIKE ${"%" + q.q.replace(/[\s().-]/g, "") + "%"})` : sql``}
      ${q.multipleVehicles ? sql`AND (SELECT count(*) FROM (${this.relatedVehicles(ctx)}) AS related_vehicles)>1` : sql``}`;
    const result = await page(
      c,
      this.config,
      ctx,
      base,
      q,
      q.sort,
      q.sort.endsWith("desc"),
    );
    return {
      data: result.items.map((x) => ({
        id: x.id,
        name: x.name,
        phone: x.phone_normalized,
        vehicleCount: x.vehicle_count,
        bookingCount: x.booking_count,
        version: x.version,
      })),
      page: result.page,
    };
  }
  async vehicles(c: Conn, ctx: Context, q: Row) {
    const key =
      q.sort === "createdAt:desc"
        ? sql`v.created_at`
        : sql`COALESCE(v.plate_normalized,'~~~~')`;
    const result = await page(
      c,
      this.config,
      ctx,
      sql`SELECT v.*,${key} AS cursor_key FROM vehicles v WHERE ${this.vehicleScope(ctx)}
      ${q.customerId ? sql`AND (EXISTS(SELECT 1 FROM bookings b WHERE b.vehicle_id=v.id AND b.customer_id=${q.customerId} AND ${scope(ctx)}) OR EXISTS(SELECT 1 FROM service_visits sv WHERE sv.vehicle_id=v.id AND sv.customer_id=${q.customerId} AND ${scope(ctx, "sv", true)}) ${ctx.actor?.role==='MANAGER'?sql`OR EXISTS(SELECT 1 FROM customer_vehicle_links l WHERE l.vehicle_id=v.id AND l.customer_id=${q.customerId} AND l.source='MIGRATION')`:sql``})` : sql``}
      ${q.q ? sql`AND (v.plate_normalized ILIKE ${"%" + q.q + "%"} OR v.normalized_model LIKE ${"%" + normalize(q.q) + "%"})` : sql``}`,
      q,
      q.sort,
      q.sort.endsWith("desc"),
    );
    const data = [];
    for (const v of result.items) data.push(await this.vehicleView(c, ctx, v));
    return { data, page: result.page };
  }
  async vehicleView(c: Conn, ctx: Context, v: Row) {
    const contacts = await rows(
      c,
      sql`SELECT DISTINCT c.id,c.name FROM bookings b JOIN customers c ON c.id=b.customer_id WHERE b.vehicle_id=${v.id} AND ${scope(ctx)} UNION SELECT c.id,c.name FROM service_visits sv JOIN customers c ON c.id=sv.customer_id WHERE sv.vehicle_id=${v.id} AND ${scope(ctx, "sv", true)} ${ctx.actor?.role==='MANAGER'?sql`UNION SELECT c.id,c.name FROM customer_vehicle_links l JOIN customers c ON c.id=l.customer_id WHERE l.vehicle_id=${v.id} AND l.source='MIGRATION' AND ${this.customerScope(ctx)}`:sql``}`,
    );
    return {
      id: v.id,
      model: v.model,
      plate: v.plate_normalized,
      year: v.model_year,
      version: v.version,
      customerContacts: contacts.map((c) => ({
        customerId: c.id,
        name: c.name,
      })),
    };
  }
  async customer(c: Conn, ctx: Context, id: string, limit: number) {
    const r = await one(
      c,
      sql`SELECT c.* FROM customers c WHERE c.id=${id} AND ${this.customerScope(ctx)}`,
    );
    if (!r) fail(404, "NOT_FOUND");
    const vehicles = await this.vehicles(c, ctx, {
      customerId: id,
      limit,
      cursor: undefined,
      sort: "createdAt:desc",
    });
    return {
      id: r.id,
      name: r.name,
      phone: r.phone_normalized,
      version: r.version,
      vehicles: vehicles.data,
      related: {
        vehiclesHasMore: vehicles.page.hasMore,
        vehiclesUrl: "/api/v1/admin/vehicles?customerId=" + id,
        bookingsUrl: "/api/v1/admin/bookings?customerId=" + id,
      },
    };
  }
  async vehicle(c: Conn, ctx: Context, id: string) {
    const r = await one(
      c,
      sql`SELECT v.* FROM vehicles v WHERE v.id=${id} AND ${this.vehicleScope(ctx)}`,
    );
    if (!r) fail(404, "NOT_FOUND");
    return {
      ...(await this.vehicleView(c, ctx, r)),
      serviceHistoryAvailable: true,
      bookingsUrl: "/api/v1/admin/bookings?vehicleId=" + id,
    };
  }
  async contact(c: Conn, ctx: Context, input: Row, publicInput = false) {
    if (input.id) {
      if (publicInput) fail(400, "VALIDATION_FAILED");
      const r = await one(
        c,
        sql`SELECT c.* FROM customers c WHERE c.id=${input.id} AND ${this.customerScope(ctx)}`,
      );
      if (!r) fail(422, "CONTACT_REFERENCE_INVALID");
      return r;
    }
    return (await one(
      c,
      sql`INSERT INTO customers(name,normalized_name,phone_normalized,origin) VALUES(${input.name},${normalize(input.name)},${input.phone},${publicInput ? "PUBLIC" : "STAFF"}) RETURNING *`,
    ))!;
  }
  async bookingVehicle(
    c: Conn,
    ctx: Context,
    input: Row | null | undefined,
    customerId: string,
    publicInput = false,
  ) {
    if (!input) return null;
    if (input.id) {
      if (publicInput) fail(400, "VALIDATION_FAILED");
      const r = await one(
        c,
        sql`SELECT v.* FROM vehicles v WHERE v.id=${input.id} AND ${this.vehicleScope(ctx)} AND EXISTS(SELECT 1 FROM customer_vehicle_links l WHERE l.customer_id=${customerId} AND l.vehicle_id=v.id AND l.valid_to IS NULL)`,
      );
      if (!r) fail(422, "CONTACT_REFERENCE_INVALID");
      return r;
    }
    const r = await one(
      c,
      sql`INSERT INTO vehicles(model,normalized_model,plate_normalized,model_year,origin) VALUES(${input.model || null},${input.model ? normalize(input.model) : null},${input.plate?.toUpperCase() || null},${input.year || null},${publicInput ? "PUBLIC" : "STAFF"}) RETURNING *`,
    );
    await c.execute(
      sql`INSERT INTO customer_vehicle_links(customer_id,vehicle_id,source) VALUES(${customerId},${r!.id},${publicInput ? "PUBLIC_BOOKING" : "STAFF_BOOKING"})`,
    );
    return r!;
  }
}
