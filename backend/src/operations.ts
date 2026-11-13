import { randomUUID } from "node:crypto";
import type { Config } from "./config";
import { sql, rows, one, type Conn, type Row } from "./database";
import {
  audit,
  day,
  expectVersion,
  fail,
  iso,
  manager,
  midnight,
  page,
  permission,
  range,
  scope,
  type Context,
} from "./common";
import type { Capacity } from "./capacity/capacity";
import type { Finance } from "./finance";
import { csv, shiftHours } from "./operations-utils";

export async function checkStaffShift(c: Conn, ctx: Context, staffId: string) {
  const start = midnight(day(ctx.now)),
    end = new Date(+start + 86400000);
  const shifts = await rows(
    c,
    sql`SELECT * FROM staff_shifts WHERE station_id=${ctx.station.id} AND staff_id=${staffId} AND canceled_at IS NULL AND starts_at<${end} AND ends_at>${start}`,
  );
  if (
    shifts.some(
      (s) =>
        s.kind === "LEAVE" && +s.starts_at <= +ctx.now && +s.ends_at > +ctx.now,
    ) ||
    (shifts.some((s) => s.kind === "WORK") &&
      !shifts.some(
        (s) =>
          s.kind === "WORK" &&
          +s.starts_at <= +ctx.now &&
          +s.ends_at > +ctx.now,
      ))
  )
    fail(
      409,
      "TECHNICIAN_OFF_SHIFT",
      "Kỹ thuật viên đang ngoài ca hoặc có lịch nghỉ.",
    );
}

export class Operations {
  constructor(
    readonly config: Config,
    readonly capacity: Capacity,
    readonly finance: Finance,
  ) {}
  async summary(c: Conn, ctx: Context, q: Row) {
    const r = range(q.from, q.to);
    const visits = await one(
      c,
      sql`SELECT count(*)::int AS received,count(*) FILTER(WHERE v.stage='HANDED_OVER')::int AS delivered,count(*) FILTER(WHERE v.stage NOT IN ('HANDED_OVER','ABORTED'))::int AS open FROM service_visits v WHERE ${scope(ctx, "v")} AND v.received_at>=${r.from} AND v.received_at<${r.to}`,
    );
    const bookings = await one(
      c,
      sql`SELECT count(*) FILTER(WHERE b.status IN ('ARRIVED','COMPLETED','NO_SHOW'))::int AS resolved,count(*) FILTER(WHERE b.status='NO_SHOW')::int AS missed FROM bookings b WHERE ${scope(ctx)} AND b.scheduled_start_at>=${r.from} AND b.scheduled_start_at<${r.to}`,
    );
    const handovers = await one(
      c,
      sql`SELECT count(*)::int AS count,avg(EXTRACT(EPOCH FROM(v.handed_over_at-v.received_at))/60)::float8 AS minutes FROM service_visits v WHERE ${scope(ctx, "v")} AND v.handed_over_at>=${r.from} AND v.handed_over_at<${r.to}`,
    );
    const stages = await rows(
      c,
      sql`SELECT v.stage,count(*)::int AS count FROM service_visits v WHERE ${scope(ctx, "v")} AND v.stage NOT IN ('HANDED_OVER','ABORTED') GROUP BY v.stage ORDER BY v.stage`,
    );
    const technicians =
      ctx.actor!.role === "MANAGER"
        ? await rows(
            c,
            sql`SELECT s.id,s.name,count(DISTINCT i.id)::int AS completed FROM work_items i JOIN work_orders w ON w.id=i.work_order_id JOIN service_visits v ON v.id=w.visit_id JOIN work_item_assignments a ON a.work_item_id=i.id AND a.ended_at IS NULL JOIN staff_profiles s ON s.id=a.technician_id WHERE v.station_id=${ctx.station.id} AND i.status='DONE' AND i.finished_at>=${r.from} AND i.finished_at<${r.to} GROUP BY s.id,s.name ORDER BY completed DESC,s.id`,
          )
        : [];
    return {
      from: q.from,
      to: q.to,
      asOf: iso(ctx.now),
      timezone: "Asia/Ho_Chi_Minh",
      scope: ctx.actor!.role === "MANAGER" ? "STATION" : "OWN",
      received: visits!.received,
      openFromCohort: visits!.open,
      handedOverFromCohort: visits!.delivered,
      completionRate: {
        numerator: visits!.delivered,
        denominator: visits!.received,
      },
      noShowRate: {
        numerator: bookings!.missed,
        denominator: bookings!.resolved,
      },
      handovers: handovers!.count,
      averageTurnaroundMinutes: handovers!.minutes,
      stages,
      technicians,
      ...(ctx.actor!.permissions.includes("finance.read")
        ? { finance: await this.finance.report(c, ctx, q) }
        : {}),
    };
  }
  async alerts(c: Conn, ctx: Context, q: Row) {
    const base = sql`
      SELECT md5('unassigned'||b.id::text)::uuid AS id,b.id AS subject_id,'booking' AS subject_type,b.scheduled_start_at AS cursor_key,'Chưa phân công cố vấn' AS title,b.code,'WARNING' AS severity FROM bookings b WHERE ${scope(ctx)} AND b.assigned_advisor_id IS NULL AND b.status IN ('PENDING','CONFIRMED')
      UNION ALL SELECT md5('late'||b.id::text)::uuid,b.id,'booking',b.scheduled_start_at,'Lịch đã qua giờ hẹn',b.code,'WARNING' FROM bookings b WHERE ${scope(ctx)} AND b.status='CONFIRMED' AND b.scheduled_start_at<${ctx.now}
      UNION ALL SELECT md5('quote'||q.id::text)::uuid,v.id,'visit',q.submitted_at,'Báo giá đang chờ phản hồi',v.code,'INFO' FROM quote_revisions q JOIN service_visits v ON v.id=q.visit_id WHERE ${scope(ctx, "v")} AND q.status='SUBMITTED'
      UNION ALL SELECT md5('overdue'||w.id::text)::uuid,v.id,'visit',w.due_at,'Thi công quá hạn',v.code,'DANGER' FROM work_orders w JOIN service_visits v ON v.id=w.visit_id WHERE ${scope(ctx, "v")} AND w.status IN ('IN_PROGRESS','PAUSED') AND w.due_at<${ctx.now}
      UNION ALL SELECT md5('ready'||v.id::text)::uuid,v.id,'visit',v.ready_at,'Xe sẵn sàng chờ bàn giao',v.code,'INFO' FROM service_visits v WHERE ${scope(ctx, "v")} AND v.stage='READY'
      UNION ALL SELECT md5('stock'||v.id::text)::uuid,v.id,'visit',v.updated_at,'Vật tư chưa đủ để thi công',v.code,'WARNING' FROM service_visits v WHERE ${scope(ctx, "v")} AND v.stage NOT IN ('HANDED_OVER','ABORTED') AND EXISTS(SELECT 1 FROM stock_requests r WHERE r.visit_id=v.id AND r.quantity>r.reserved+COALESCE((SELECT sum(l.quantity) FROM stock_document_lines l JOIN stock_documents d ON d.id=l.document_id WHERE l.request_id=r.id AND d.status='POSTED' AND d.kind='ISSUE'),0)-COALESCE((SELECT sum(x.quantity) FROM stock_document_lines x JOIN stock_documents d ON d.id=x.document_id JOIN stock_document_lines l ON l.id=x.original_line_id WHERE l.request_id=r.id AND d.status='POSTED' AND d.kind='RETURN'),0))
    `;
    const p = await page(
      c,
      this.config,
      ctx,
      base,
      q,
      "operations-alerts",
      true,
    );
    return {
      data: p.items.map((i) => ({
        id: i.id,
        title: i.title,
        code: i.code,
        severity: i.severity,
        at: iso(i.cursor_key),
        subjectId: i.subject_id,
        subjectType: i.subject_type,
      })),
      page: p.page,
    };
  }
  async shifts(c: Conn, ctx: Context, q: Row) {
    const r = range(q.from, q.to, 31);
    const p = await page(
      c,
      this.config,
      ctx,
      sql`SELECT h.*,s.name,h.starts_at AS cursor_key FROM staff_shifts h JOIN staff_profiles s ON s.id=h.staff_id WHERE h.station_id=${ctx.station.id} AND h.canceled_at IS NULL AND h.starts_at<${r.to} AND h.ends_at>${r.from} ${ctx.actor!.role !== "MANAGER" ? sql`AND h.staff_id=${ctx.actor!.staffId}` : sql``} ${q.staffId ? sql`AND h.staff_id=${q.staffId}` : sql``}`,
      q,
      "staff-shifts",
    );
    return {
      data: p.items.map((h) => ({
        id: h.id,
        staffId: h.staff_id,
        name: h.name,
        kind: h.kind,
        startsAt: iso(h.starts_at),
        endsAt: iso(h.ends_at),
        note: h.note,
        version: h.version,
      })),
      page: p.page,
    };
  }
  async shift(c: Conn, ctx: Context, input: Row, id?: string) {
    manager(ctx);
    permission(ctx, "staff.manage");
    let h: Row;
    if (id) {
      h = (await one(
        c,
        sql`SELECT * FROM staff_shifts WHERE id=${id} AND station_id=${ctx.station.id} AND canceled_at IS NULL FOR UPDATE`,
      ))!;
      if (!h) fail(404, "NOT_FOUND");
      expectVersion(h, input.expectedVersion);
      if (+h.ends_at <= +ctx.now) fail(409, "SHIFT_ALREADY_ENDED");
      await c.execute(
        sql`UPDATE staff_shifts SET canceled_at=${ctx.now},version=version+1 WHERE id=${id}`,
      );
    } else {
      const a = new Date(input.startsAt),
        b = new Date(input.endsAt);
      if (+a >= +b || day(a) !== day(new Date(+b - 1)) || +a < +ctx.now)
        fail(
          422,
          "SHIFT_INTERVAL_INVALID",
          "Ca phải nằm trong một ngày, bắt đầu từ thời điểm hiện tại và kết thúc sau giờ bắt đầu.",
        );
      if (
        !(await one(
          c,
          sql`SELECT id FROM staff_profiles WHERE id=${input.staffId} AND station_id=${ctx.station.id} AND active`,
        ))
      )
        fail(422, "STAFF_UNAVAILABLE");
      if (
        await one(
          c,
          sql`SELECT id FROM staff_shifts WHERE staff_id=${input.staffId} AND kind=${input.kind} AND canceled_at IS NULL AND starts_at<${b} AND ends_at>${a}`,
        )
      )
        fail(409, "SHIFT_OVERLAP");
      h = (await one(
        c,
        sql`INSERT INTO staff_shifts(station_id,staff_id,kind,starts_at,ends_at,note,created_by) VALUES(${ctx.station.id},${input.staffId},${input.kind},${a},${b},${input.note},${ctx.actor!.userId}) RETURNING *`,
      ))!;
    }
    const dayStart = midnight(day(h.starts_at)),
      dayEnd = new Date(+dayStart + 86400000);
    const work = await rows(
      c,
      sql`SELECT DISTINCT w.id,w.due_at FROM work_item_assignments a JOIN work_items i ON i.id=a.work_item_id JOIN work_orders w ON w.id=i.work_order_id JOIN service_visits v ON v.id=w.visit_id WHERE a.technician_id=${h.staff_id} AND a.ended_at IS NULL AND i.status IN ('PENDING','IN_PROGRESS') AND w.status='IN_PROGRESS' AND v.station_id=${ctx.station.id}`,
    );
    const shifts = await rows(
      c,
      sql`SELECT * FROM staff_shifts WHERE staff_id=${h.staff_id} AND canceled_at IS NULL AND starts_at<${dayEnd} AND ends_at>${dayStart}`,
    );
    for (const w of work) {
      const start = Math.max(+ctx.now, +dayStart),
        end = Math.min(
          Math.max(+new Date(w.due_at), +ctx.now + 60000),
          +dayEnd,
        );
      if (
        start < end &&
        !shiftHours(
          [{ start, end }],
          shifts.map((s) => ({
            kind: s.kind,
            start: +s.starts_at,
            end: +s.ends_at,
          })),
        ).some((x) => x.start <= start && x.end >= end)
      )
        fail(409, "CAPACITY_IMPACT");
    }
    await c.execute(
      sql`UPDATE stations SET configuration_version=configuration_version+1 WHERE id=${ctx.station.id}`,
    );
    await audit(
      c,
      ctx,
      id ? "SHIFT_CANCELED" : "SHIFT_CREATED",
      "shift",
      h.id,
      input.reason || input.note,
    );
    return {
      id: h.id,
      version: h.version + (id ? 1 : 0),
      eventId: randomUUID(),
    };
  }
  async export(c: Conn, ctx: Context, q: Row) {
    manager(ctx);
    permission(ctx, "reports.export");
    const r = range(q.from, q.to);
    let records: Row[], header: string[];
    if (q.type === "CASH") {
      permission(ctx, "finance.read");
      records = await rows(
        c,
        sql`SELECT id::text,kind,occurred_at,amount::text,currency FROM cash_entries WHERE station_id=${ctx.station.id} AND occurred_at>=${r.from} AND occurred_at<${r.to} ORDER BY occurred_at,id LIMIT 5001`,
      );
      header = ["Mã phiếu", "Loại", "Thời điểm", "Số tiền", "Tiền tệ"];
    } else {
      records = await rows(
        c,
        sql`SELECT v.code,v.stage,v.received_at,v.handed_over_at,s.name AS advisor FROM service_visits v JOIN staff_profiles s ON s.id=v.assigned_advisor_id WHERE ${scope(ctx, "v")} AND v.received_at>=${r.from} AND v.received_at<${r.to} ORDER BY v.received_at,v.id LIMIT 5001`,
      );
      header = ["Mã phiếu", "Trạng thái", "Tiếp nhận", "Bàn giao", "Cố vấn"];
    }
    if (records.length > 5000)
      fail(422, "EXPORT_TOO_LARGE", "Vui lòng chọn khoảng thời gian ngắn hơn.");
    await audit(
      c,
      ctx,
      "REPORT_EXPORTED",
      "station",
      ctx.station.id,
      `${q.type} ${q.from}..${q.to}; ${records.length} rows`,
    );
    return {
      filename: `dpauto-${q.type.toLowerCase()}-${q.from}-${q.to}.csv`,
      csv: csv([
        header,
        ...records.map((row) =>
          Object.values(row).map((v) => (v instanceof Date ? iso(v) : v)),
        ),
      ]),
      count: records.length,
    };
  }
}
