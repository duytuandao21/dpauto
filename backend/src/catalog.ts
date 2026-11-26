import { randomUUID } from "node:crypto";
import type { Config } from "./config";
import { sql, rows, one, json, type Conn, type Row } from "./database";
import {
  fail,
  expectVersion,
  audit,
  page,
  normalize,
  type Context,
} from "./common";
const defaultQualityChecks: Record<string, string[]> = {
  MAINTENANCE: ["Kiểm tra các hạng mục bảo dưỡng và an toàn vận hành"],
  DETAILING: ["Kiểm tra bề mặt và chất lượng hoàn thiện"],
  ACCESSORIES: ["Kiểm tra lắp đặt và vận hành phụ kiện"],
};

export class Catalog {
  constructor(readonly config: Config) {}
  async list(c: Conn, ctx: Context, q: Row) {
    const condition = sql`(${q.active ?? null}::boolean IS NULL OR s.active=${q.active ?? null}) AND (${q.bookable ?? null}::boolean IS NULL OR s.bookable=${q.bookable ?? null})
      ${q.categoryCode ? sql`AND cat.code=${q.categoryCode}` : sql``} ${q.q ? sql`AND lower(s.name) LIKE ${"%" + q.q.toLowerCase() + "%"}` : sql``}`;
    const key = q.sort === "name:asc" ? sql`s.name` : sql`s.sort_order`;
    const data = await page(
      c,
      this.config,
      ctx,
      sql`SELECT s.*,cat.code AS category_code,cat.name AS category_name,${key} AS cursor_key FROM services s JOIN service_categories cat ON cat.id=s.category_id WHERE ${condition}`,
      q,
      q.sort,
    );
    const options = await rows(
      c,
      sql`SELECT code,name FROM service_categories WHERE active ORDER BY sort_order`,
    );
    return {
      data: data.items.map((s) => serviceView(s, ctx.station.catalog_version)),
      page: data.page,
      extra: {
        categoryOptions: options,
        catalogVersion: ctx.station.catalog_version,
        policyVersion: ctx.station.configuration_version,
        privacyNoticeVersion: ctx.station.privacy_notice_version,
      },
    };
  }
  async write(c: Conn, ctx: Context, input: Row, id?: string) {
    const old = id
      ? await one(
          c,
          sql`SELECT s.*,cat.code AS category_code FROM services s JOIN service_categories cat ON cat.id=s.category_id WHERE s.id=${id}`,
        )
      : undefined;
    if (id && (!old || old.deleted_at)) fail(404, "NOT_FOUND");
    if (old) expectVersion(old, input.expectedVersion);
    const merged = {
      code: old?.code,
      name: old?.name,
      categoryCode: old?.category_code,
      active: old?.active,
      bookable: old?.bookable,
      sortOrder: old?.sort_order,
      description: old?.description,
      marketingSlug: old?.marketing_slug,
      estimatedDurationMinutes: old?.estimated_duration_minutes,
      qualityChecks:
        old?.quality_checks || defaultQualityChecks[input.categoryCode] || [],
      technicianRequired: old?.technician_required || false,
      ...input,
    };
    if (merged.bookable && !merged.active) fail(422, "SERVICE_INACTIVE");
    const category = await one(
      c,
      sql`SELECT id FROM service_categories WHERE code=${merged.categoryCode} AND active`,
    );
    if (!category) fail(422, "VALIDATION_FAILED");
    const planRevision = old
      ? old.plan_revision +
        (input.estimatedDurationMinutes !== undefined &&
        input.estimatedDurationMinutes !== old.estimated_duration_minutes
          ? 1
          : 0)
      : 1;
    const serviceId = id || randomUUID();
    if (old)
      await c.execute(
        sql`UPDATE services SET name=${merged.name},category_id=${category.id},active=${merged.active},bookable=${merged.bookable},sort_order=${merged.sortOrder},description=${merged.description ?? null},marketing_slug=${merged.marketingSlug ?? null},estimated_duration_minutes=${merged.estimatedDurationMinutes},plan_revision=${planRevision},version=version+1,updated_at=${ctx.now} WHERE id=${serviceId}`,
      );
    else
      await c.execute(
        sql`INSERT INTO services(id,code,name,category_id,active,bookable,sort_order,description,marketing_slug,estimated_duration_minutes) VALUES(${serviceId},${merged.code},${merged.name},${category.id},${merged.active},${merged.bookable},${merged.sortOrder},${merged.description ?? null},${merged.marketingSlug ?? null},${merged.estimatedDurationMinutes})`,
      );
    await c.execute(
      sql`UPDATE services SET quality_checks=${json(merged.qualityChecks)},technician_required=${merged.technicianRequired} WHERE id=${serviceId}`,
    );
    await c.execute(
      sql`UPDATE stations SET catalog_version=catalog_version+1 WHERE id=${ctx.station.id}`,
    );
    await audit(
      c,
      ctx,
      old ? "SERVICE_UPDATED" : "SERVICE_CREATED",
      "service",
      serviceId,
      input.reason,
    );
    return {
      id: serviceId,
      version: old ? old.version + 1 : 1,
      catalogVersion: ctx.station.catalog_version + 1,
      eventId: randomUUID(),
    };
  }
  /** Hides the service; bookings and tickets that used it keep showing its name. */
  async remove(c: Conn, ctx: Context, id: string, input: Row) {
    const old = await one(
      c,
      sql`SELECT * FROM services WHERE id=${id}::uuid AND deleted_at IS NULL FOR UPDATE`,
    );
    if (!old) fail(404, "NOT_FOUND");
    expectVersion(old!, input.expectedVersion);
    const inUse = await one(
      c,
      sql`SELECT EXISTS(SELECT 1 FROM booking_services bs JOIN bookings b ON b.id=bs.booking_id WHERE bs.service_id=${id}::uuid AND b.deleted_at IS NULL AND b.status IN ('PENDING','CONFIRMED'))
        OR EXISTS(SELECT 1 FROM visit_services vs JOIN service_visits v ON v.id=vs.visit_id WHERE vs.service_id=${id}::uuid AND v.deleted_at IS NULL AND v.stage NOT IN ('HANDED_OVER','COMPLETED','ABORTED')) AS used`,
    );
    if (inUse!.used)
      fail(
        409,
        "SERVICE_IN_USE",
        "Dịch vụ đang có trong lịch hẹn hoặc phiếu chưa xong. Hãy xử lý xong trước khi xóa.",
      );
    await c.execute(
      sql`UPDATE services SET active=false,bookable=false,deleted_at=${ctx.now},deleted_by=${ctx.actor!.userId},version=version+1,updated_at=${ctx.now} WHERE id=${id}::uuid`,
    );
    await c.execute(
      sql`UPDATE stations SET catalog_version=catalog_version+1 WHERE id=${ctx.station.id}`,
    );
    await audit(c, ctx, "SERVICE_DELETED", "service", id, input.reason);
    return { id, deleted: true, version: old!.version + 1 };
  }
}
export function serviceView(s: Row, catalogVersion: number) {
  return {
    id: s.id,
    code: s.code,
    name: s.name,
    description: s.description,
    category: { code: s.category_code, name: s.category_name },
    active: s.active,
    bookable: s.bookable,
    sortOrder: s.sort_order,
    marketingSlug: s.marketing_slug,
    requirements: [],
    estimatedDurationMinutes: s.estimated_duration_minutes,
    qualityChecks: s.quality_checks,
    technicianRequired: s.technician_required,
    deletedAt: s.deleted_at ?? null,
    version: s.version,
    catalogVersion,
  };
}
