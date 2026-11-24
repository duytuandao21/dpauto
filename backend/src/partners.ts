import { sql, rows, one, type Conn, type Row } from "./database";
import { audit, expectVersion, fail, type Context } from "./common";

const view = (p: Row, sales: Row[]) => ({
  id: p.id,
  name: p.name,
  phone: p.phone_normalized,
  active: p.active,
  version: p.version,
  sales: sales
    .filter((s) => s.partner_id === p.id)
    .map((s) => ({
      id: s.id,
      name: s.name,
      phone: s.phone_normalized,
      active: s.active,
      version: s.version,
    })),
});

/**
 * The sale who brought a partner car, checked for this station. A partner ticket's customer is the
 * partner itself (one profile per phone), so the partner must have a phone before it can be used.
 */
export async function partnerSale(c: Conn, ctx: Context, saleId: string) {
  const s = await one(
    c,
    sql`SELECT s.id,s.name,s.active,p.id AS partner_id,p.name AS partner_name,p.phone_normalized AS partner_phone,p.active AS partner_active
      FROM partner_sales s JOIN partners p ON p.id=s.partner_id WHERE s.id=${saleId}::uuid AND p.station_id=${ctx.station.id}`,
  );
  if (!s || !s.active || !s.partner_active)
    fail(422, "PARTNER_SALE_INVALID", "Sale đối tác không còn hoạt động.");
  if (!s!.partner_phone)
    fail(
      422,
      "PARTNER_PHONE_REQUIRED",
      "Đối tác chưa có số điện thoại. Điều hành cần cập nhật ở trang Đối tác.",
    );
  return {
    customer: { name: s!.partner_name, phone: s!.partner_phone },
    snapshot: {
      partnerId: s!.partner_id,
      partnerName: s!.partner_name,
      saleId: s!.id,
      saleName: s!.name,
    },
  };
}

export class Partners {
  async list(c: Conn, ctx: Context) {
    const partners = await rows(
      c,
      sql`SELECT * FROM partners WHERE station_id=${ctx.station.id} ORDER BY created_at,id`,
    );
    const sales = await rows(
      c,
      sql`SELECT s.* FROM partner_sales s JOIN partners p ON p.id=s.partner_id WHERE p.station_id=${ctx.station.id} ORDER BY s.active DESC,s.name,s.id`,
    );
    return partners.map((p) => view(p, sales));
  }
  private async locked(c: Conn, ctx: Context, id: string) {
    const p = await one(
      c,
      sql`SELECT * FROM partners WHERE id=${id}::uuid AND station_id=${ctx.station.id} FOR UPDATE`,
    );
    if (!p) fail(404, "NOT_FOUND");
    return p!;
  }
  async create(c: Conn, ctx: Context, input: Row) {
    const p = (await one(
      c,
      sql`INSERT INTO partners(station_id,name,phone_normalized) VALUES(${ctx.station.id},${input.name},${input.phone || null}) RETURNING id`,
    ))!;
    await audit(c, ctx, "PARTNER_CREATED", "partner", p.id);
    return { id: p.id, version: 1 };
  }
  async update(c: Conn, ctx: Context, id: string, input: Row) {
    const p = await this.locked(c, ctx, id);
    expectVersion(p, input.expectedVersion);
    await c.execute(
      sql`UPDATE partners SET name=${input.name},phone_normalized=${input.phone || null},active=${input.active},version=version+1,updated_at=${ctx.now} WHERE id=${id}::uuid`,
    );
    await audit(c, ctx, "PARTNER_UPDATED", "partner", id);
    return { id, version: p.version + 1 };
  }
  async createSale(c: Conn, ctx: Context, partnerId: string, input: Row) {
    await this.locked(c, ctx, partnerId);
    const s = (await one(
      c,
      sql`INSERT INTO partner_sales(partner_id,name,phone_normalized) VALUES(${partnerId}::uuid,${input.name},${input.phone || null}) RETURNING id`,
    ))!;
    await audit(c, ctx, "PARTNER_SALE_CREATED", "partner_sale", s.id);
    return { id: s.id, version: 1 };
  }
  /** Sales are never deleted: old tickets point at them; inactive ones just leave the picker. */
  async updateSale(c: Conn, ctx: Context, id: string, input: Row) {
    const s = await one(
      c,
      sql`SELECT s.* FROM partner_sales s JOIN partners p ON p.id=s.partner_id WHERE s.id=${id}::uuid AND p.station_id=${ctx.station.id} FOR UPDATE OF s`,
    );
    if (!s) fail(404, "NOT_FOUND");
    expectVersion(s!, input.expectedVersion);
    await c.execute(
      sql`UPDATE partner_sales SET name=${input.name},phone_normalized=${input.phone || null},active=${input.active},version=version+1,updated_at=${ctx.now} WHERE id=${id}::uuid`,
    );
    await audit(c, ctx, "PARTNER_SALE_UPDATED", "partner_sale", id);
    return { id, version: s!.version + 1 };
  }
}
