import type { Config } from "./config";
import { sql, rows, one, type Conn, type Row } from "./database";
import {
  audit,
  expectVersion,
  page,
  scope,
  fail,
  normalize,
  type Context,
} from "./common";

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
      FROM customers c WHERE c.merged_into_id IS NULL AND c.deleted_at IS NULL AND ${this.customerScope(ctx)} ${q.q ? sql`AND (c.normalized_name LIKE ${"%" + normalize(q.q) + "%"} OR c.phone_normalized LIKE ${"%" + q.q.replace(/[\s().-]/g, "") + "%"})` : sql``}
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
      sql`SELECT v.*,${key} AS cursor_key FROM vehicles v WHERE v.deleted_at IS NULL AND ${this.vehicleScope(ctx)}
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
      sql`SELECT c.* FROM customers c WHERE c.id=${id} AND c.deleted_at IS NULL AND ${this.customerScope(ctx)}`,
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
      mergedIntoId: r.merged_into_id,
      vehicles: vehicles.data,
      related: {
        vehiclesHasMore: vehicles.page.hasMore,
        vehiclesUrl: "/api/v1/admin/vehicles?customerId=" + id,
        bookingsUrl: "/api/v1/admin/bookings?customerId=" + id,
      },
    };
  }
  private async lockedCustomer(c: Conn, ctx: Context, id: string) {
    const r = await one(
      c,
      sql`SELECT c.* FROM customers c WHERE c.id=${id}::uuid AND c.deleted_at IS NULL AND ${this.customerScope(ctx)} FOR UPDATE`,
    );
    if (!r) fail(404, "NOT_FOUND");
    if (r!.merged_into_id) fail(409, "CUSTOMER_MERGED", "Hồ sơ này đã được gộp.");
    return r!;
  }
  async updateCustomer(c: Conn, ctx: Context, id: string, input: Row) {
    const r = await this.lockedCustomer(c, ctx, id);
    expectVersion(r, input.expectedVersion);
    await this.phoneFree(c, input.phone, id);
    await c.execute(
      sql`UPDATE customers SET name=${input.name},normalized_name=${normalize(input.name)},phone_normalized=${input.phone},version=version+1,updated_at=${ctx.now} WHERE id=${id}::uuid`,
    );
    await audit(c, ctx, "CUSTOMER_UPDATED", "customer", id, input.reason);
    return { id, version: r.version + 1 };
  }
  /** A phone identifies one customer; the unique index backs this up under races. */
  private async phoneFree(c: Conn, phone: string, except?: string) {
    const other = await one(
      c,
      sql`SELECT name FROM customers WHERE phone_normalized=${phone} AND merged_into_id IS NULL AND deleted_at IS NULL ${except ? sql`AND id<>${except}::uuid` : sql``}`,
    );
    if (other)
      fail(
        409,
        "PHONE_TAKEN",
        `Số điện thoại này đã thuộc khách hàng ${other.name}.`,
      );
  }
  /** Hides the customer; bookings and tickets keep their snapshots. Open work must finish first. */
  async removeCustomer(c: Conn, ctx: Context, id: string, input: Row) {
    const r = await this.lockedCustomer(c, ctx, id);
    expectVersion(r, input.expectedVersion);
    const open = await one(
      c,
      sql`SELECT (SELECT count(*)::int FROM bookings WHERE customer_id=${id}::uuid AND deleted_at IS NULL AND status IN ('PENDING','CONFIRMED','ARRIVED')) AS bookings,
        (SELECT count(*)::int FROM service_visits WHERE customer_id=${id}::uuid AND deleted_at IS NULL AND stage NOT IN ('HANDED_OVER','ABORTED')) AS visits`,
    );
    if (open!.bookings || open!.visits)
      fail(
        409,
        "CUSTOMER_IN_USE",
        "Khách đang có lịch hẹn hoặc phiếu dịch vụ chưa xong. Hãy hoàn tất hoặc hủy trước khi xóa.",
      );
    await c.execute(
      sql`UPDATE customers SET deleted_at=${ctx.now},deleted_by=${ctx.actor!.userId},version=version+1,updated_at=${ctx.now} WHERE id=${id}::uuid`,
    );
    await audit(c, ctx, "CUSTOMER_DELETED", "customer", id, input.reason);
    return { id, deleted: true, version: r.version + 1 };
  }
  /** Moves bookings, visits, vehicles and imported history to the kept record. */
  async mergeCustomer(c: Conn, ctx: Context, id: string, input: Row) {
    if (id === input.targetId) fail(422, "CUSTOMER_MERGE_SELF");
    // Lock in a fixed order so two opposite merges cannot deadlock.
    const [first, second] = [id, input.targetId].sort();
    const a = await this.lockedCustomer(c, ctx, first),
      b = await this.lockedCustomer(c, ctx, second);
    const source = a.id === id ? a : b,
      target = a.id === id ? b : a;
    expectVersion(source, input.expectedVersion);
    expectVersion(target, input.targetVersion);
    for (const table of [
      sql`bookings`,
      sql`service_visits`,
      sql`legacy_records`,
      sql`legacy_identities`,
    ])
      await c.execute(
        sql`UPDATE ${table} SET customer_id=${target.id} WHERE customer_id=${source.id}`,
      );
    // Vehicles the kept customer already has stay single; the rest move across.
    await c.execute(
      sql`UPDATE customer_vehicle_links l SET valid_to=${ctx.now} WHERE l.customer_id=${source.id} AND l.valid_to IS NULL AND EXISTS(SELECT 1 FROM customer_vehicle_links t WHERE t.customer_id=${target.id} AND t.vehicle_id=l.vehicle_id AND t.relationship=l.relationship AND t.valid_to IS NULL)`,
    );
    await c.execute(
      sql`UPDATE customer_vehicle_links SET customer_id=${target.id} WHERE customer_id=${source.id} AND valid_to IS NULL`,
    );
    await c.execute(
      sql`UPDATE customers SET merged_into_id=${target.id},merged_at=${ctx.now},version=version+1,updated_at=${ctx.now} WHERE id=${source.id}`,
    );
    await c.execute(
      sql`UPDATE customers SET version=version+1,updated_at=${ctx.now} WHERE id=${target.id}`,
    );
    await audit(c, ctx, "CUSTOMER_MERGED", "customer", source.id, input.reason);
    await audit(c, ctx, "CUSTOMER_MERGED", "customer", target.id, input.reason);
    return { id: target.id, mergedId: source.id, version: target.version + 1 };
  }
  async vehicle(c: Conn, ctx: Context, id: string) {
    const r = await one(
      c,
      sql`SELECT v.* FROM vehicles v WHERE v.id=${id} AND v.deleted_at IS NULL AND ${this.vehicleScope(ctx)}`,
    );
    if (!r) fail(404, "NOT_FOUND");
    return {
      ...(await this.vehicleView(c, ctx, r)),
      serviceHistoryAvailable: true,
      bookingsUrl: "/api/v1/admin/bookings?vehicleId=" + id,
    };
  }
  /** Hides the vehicle and ends its customer links; bookings and tickets keep their snapshots. */
  async removeVehicle(c: Conn, ctx: Context, id: string, input: Row) {
    const v = await one(
      c,
      sql`SELECT v.* FROM vehicles v WHERE v.id=${id}::uuid AND v.deleted_at IS NULL AND ${this.vehicleScope(ctx)} FOR UPDATE`,
    );
    if (!v) fail(404, "NOT_FOUND");
    expectVersion(v!, input.expectedVersion);
    const open = await one(
      c,
      sql`SELECT EXISTS(SELECT 1 FROM bookings WHERE vehicle_id=${id}::uuid AND deleted_at IS NULL AND status IN ('PENDING','CONFIRMED','ARRIVED'))
        OR EXISTS(SELECT 1 FROM service_visits WHERE vehicle_id=${id}::uuid AND deleted_at IS NULL AND stage NOT IN ('HANDED_OVER','COMPLETED','ABORTED')) AS used`,
    );
    if (open!.used)
      fail(
        409,
        "VEHICLE_IN_USE",
        "Xe đang có lịch hẹn hoặc phiếu dịch vụ chưa xong. Hãy hoàn tất hoặc hủy trước khi xóa.",
      );
    await c.execute(
      sql`UPDATE customer_vehicle_links SET valid_to=${ctx.now} WHERE vehicle_id=${id}::uuid AND valid_to IS NULL AND valid_from<${ctx.now}`,
    );
    await c.execute(
      sql`UPDATE vehicles SET deleted_at=${ctx.now},deleted_by=${ctx.actor!.userId},version=version+1,updated_at=${ctx.now} WHERE id=${id}::uuid`,
    );
    await audit(c, ctx, "VEHICLE_DELETED", "vehicle", id, input.reason);
    return { id, deleted: true, version: v!.version + 1 };
  }
  async contact(c: Conn, ctx: Context, input: Row, publicInput = false) {
    if (input.id) {
      if (publicInput) fail(400, "VALIDATION_FAILED");
      const r = await one(
        c,
        sql`SELECT c.* FROM customers c WHERE c.id=${input.id} AND c.merged_into_id IS NULL AND c.deleted_at IS NULL AND ${this.customerScope(ctx)}`,
      );
      if (!r) fail(422, "CONTACT_REFERENCE_INVALID");
      return r;
    }
    return (await one(
      c,
      // Same phone = same customer: reuse the existing record (its name stays; the booking keeps its own snapshot).
      sql`INSERT INTO customers(name,normalized_name,phone_normalized,origin) VALUES(${input.name},${normalize(input.name)},${input.phone},${publicInput ? "PUBLIC" : "STAFF"}) ON CONFLICT(phone_normalized) WHERE merged_into_id IS NULL AND deleted_at IS NULL DO UPDATE SET updated_at=customers.updated_at RETURNING *`,
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
        sql`SELECT v.* FROM vehicles v WHERE v.id=${input.id} AND v.deleted_at IS NULL AND ${this.vehicleScope(ctx)} AND EXISTS(SELECT 1 FROM customer_vehicle_links l WHERE l.customer_id=${customerId} AND l.vehicle_id=v.id AND l.valid_to IS NULL)`,
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
