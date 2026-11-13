import type { Config } from "./config";
import { checkStaffShift } from "./operations";
import { sql, one, rows, json, ids, type Conn, type Row } from "./database";
import {
  fail,
  manager,
  scope,
  scopedVisit,
  expectVersion,
  iso,
  event,
  page,
  type Context,
} from "./common";
import { Visits } from "./visits";
import { Capacity } from "./capacity/capacity";
import { day, midnight } from "./common";
import type { ServicePlan } from "./capacity/capacity";
import { quoteMoney, calculationPolicy } from "./quote-money";
import type { Finance } from "./finance";
import type { Inventory } from "./inventory";

export class Workflow {
  constructor(
    readonly config: Config,
    readonly visits: Visits,
    readonly capacity: Capacity,
    readonly finance: Finance,
    readonly inventory: Inventory,
  ) {}
  async visit(c: Conn, ctx: Context, id: string, version?: number) {
    const v = await scopedVisit(c, ctx, id, version !== undefined);
    if (version !== undefined) {
      expectVersion(v, version);
      if (["HANDED_OVER", "ABORTED"].includes(v.stage))
        fail(409, "VISIT_CLOSED", "Phiếu đã đóng, không thể chỉnh sửa.");
    }
    return v;
  }
  async order(c: Conn, id: string, create = false) {
    if (create)
      await c.execute(
        sql`INSERT INTO work_orders(visit_id) VALUES(${id}) ON CONFLICT(visit_id) DO NOTHING`,
      );
    return one(c, sql`SELECT * FROM work_orders WHERE visit_id=${id}`);
  }
  async record(
    c: Conn,
    ctx: Context,
    v: Row,
    type: string,
    reason: string,
    data: Row = {},
  ) {
    await this.visits.bump(c, ctx, v);
    const references = Object.fromEntries(
      Object.entries(data).filter(([key]) =>
        [
          "revisionId",
          "exemptionId",
          "workItemId",
          "workLogId",
          "acceptanceId",
          "handoverId",
        ].includes(key),
      ),
    );
    return {
      ...this.visits.receipt(
        v,
        await this.visits.log(c, ctx, v.id, type, reason, data),
      ),
      ...references,
    };
  }
  async evidence(c: Conn, ctx: Context, v: Row, e: Row) {
    if (
      e.mediaId &&
      !(await one(
        c,
        sql`SELECT id FROM visit_media WHERE id=${e.mediaId} AND visit_id=${v.id} AND deleted_at IS NULL`,
      ))
    )
      fail(422, "EVIDENCE_INVALID");
    return {
      customerName: e.customerName,
      channel: e.channel,
      note: e.note,
      mediaId: e.mediaId || null,
    };
  }
  async revision(c: Conn, ctx: Context, id: string, version?: number) {
    const r = await one(
      c,
      sql`SELECT r.* FROM quote_revisions r JOIN service_visits v ON v.id=r.visit_id WHERE r.id=${id} AND ${scope(ctx, "v")}`,
    );
    if (!r) fail(404, "NOT_FOUND");
    return {
      revision: r,
      visit: await this.visit(c, ctx, r.visit_id, version),
    };
  }
  async lines(c: Conn, id: string) {
    const lines = await rows(
      c,
      sql`SELECT * FROM quote_lines WHERE revision_id=${id} ORDER BY sequence_no`,
    );
    return lines.map((l) => ({
      id: l.id,
      kind: l.kind,
      serviceId: l.service_id,
      name: l.name,
      code: l.code,
      unit: l.unit,
      quantity: l.quantity,
      unitPrice: l.unit_price,
      discountPercent: l.discount_percent,
      vatPercent: l.vat_percent,
      subtotal: l.subtotal,
      discountTotal: l.discount_total,
      taxTotal: l.tax_total,
      total: l.total,
    }));
  }
  async revisionView(c: Conn, r: Row) {
    const decision = await one(
      c,
      sql`SELECT * FROM quote_decisions WHERE revision_id=${r.id}`,
    );
    return {
      id: r.id,
      revisionNo: r.revision_no,
      kind: r.kind,
      baseRevisionId: r.base_revision_id,
      status: r.status,
      currency: r.currency,
      calculationPolicy: r.calculation_policy,
      discountPercent: r.discount_percent,
      note: r.note,
      subtotal: r.subtotal,
      discountTotal: r.discount_total,
      taxTotal: r.tax_total,
      total: r.total,
      createdAt: iso(r.created_at),
      submittedAt: r.submitted_at ? iso(r.submitted_at) : null,
      lines: await this.lines(c, r.id),
      decision: decision
        ? {
            decision: decision.decision,
            customerName: decision.customer_name,
            channel: decision.channel,
            evidenceNote: decision.evidence_note,
            recordedAt: iso(decision.recorded_at),
            mediaId: decision.media_id,
          }
        : null,
    };
  }
  async obligation(c: Conn, id: string) {
    return this.finance.obligation(c, id);
  }
  async read(c: Conn, ctx: Context, id: string) {
    const v = await this.visit(c, ctx, id),
      order = await this.order(c, id),
      revisions = await rows(
        c,
        sql`SELECT * FROM quote_revisions WHERE visit_id=${id} ORDER BY revision_no`,
      );
    const items = order
      ? await rows(
          c,
          sql`SELECT * FROM work_items WHERE work_order_id=${order.id} ORDER BY due_at,id`,
        )
      : [];
    const assignments = order
      ? await rows(
          c,
          sql`SELECT a.work_item_id,s.id,s.name FROM work_item_assignments a JOIN staff_profiles s ON s.id=a.technician_id JOIN work_items i ON i.id=a.work_item_id WHERE i.work_order_id=${order.id} AND a.ended_at IS NULL ORDER BY s.name`,
        )
      : [];
    const acceptances = await rows(
      c,
      sql`SELECT a.*,s.name AS inspector_name FROM acceptances a JOIN staff_profiles s ON s.id=a.inspector_id WHERE a.visit_id=${id} ORDER BY a.checked_at DESC,a.id DESC`,
    );
    const inspections = [];
    for (const a of acceptances)
      inspections.push({
        id: a.id,
        result: a.result,
        scopeVersion: a.scope_version,
        checkedAt: iso(a.checked_at),
        inspector: { id: a.inspector_id, name: a.inspector_name },
        note: a.note,
        checks: await rows(
          c,
          sql`SELECT work_item_id AS "workItemId",label_snapshot AS label,passed,note FROM acceptance_checks WHERE acceptance_id=${a.id}`,
        ),
      });
    const holds = await rows(
      c,
      sql`SELECT o.*,u.name FROM resource_occupancies o JOIN resource_units u ON u.id=o.resource_id WHERE o.visit_id=${id} ORDER BY o.started_at,o.id`,
    );
    const handover = await one(
      c,
      sql`SELECT * FROM visit_handovers WHERE visit_id=${id}`,
    );
    const open = !["HANDED_OVER", "ABORTED"].includes(v.stage);
    const settlement = await this.finance.balance(c, id);
    return {
      visitId: id,
      version: v.version,
      stage: v.stage,
      calculationPolicy,
      quotes: await Promise.all(revisions.map((r) => this.revisionView(c, r))),
      obligation: { assessed: settlement.assessed, total: settlement.total },
      paymentStatus: settlement.paymentStatus,
      settlement,
      stock: await this.inventory.fulfilled(c, ctx, id),
      financialCredits: (
        await rows(
          c,
          sql`SELECT id,amount,reason,evidence,occurred_at FROM obligation_credits WHERE visit_id=${id} ORDER BY occurred_at,id`,
        )
      ).map((x) => ({
        id: x.id,
        amount: x.amount,
        reason: x.reason,
        evidence: x.evidence,
        occurredAt: iso(x.occurred_at),
      })),
      exemptions: (
        await rows(
          c,
          sql`SELECT * FROM work_exemptions WHERE visit_id=${id} ORDER BY approved_at,id`,
        )
      ).map((e) => ({
        id: e.id,
        mode: e.mode,
        scope: e.scope,
        reason: e.reason,
        evidence: e.evidence,
        approvedAt: iso(e.approved_at),
      })),
      work: order
        ? {
            id: order.id,
            status: order.status,
            scopeVersion: order.scope_version,
            startedAt: order.started_at ? iso(order.started_at) : null,
            finishedAt: order.finished_at ? iso(order.finished_at) : null,
            dueAt: order.due_at ? iso(order.due_at) : null,
            items: items.map((i) => ({
              id: i.id,
              label: i.label,
              status: i.status,
              quoteLineId: i.quote_line_id,
              exemptionId: i.exemption_id,
              dueAt: iso(i.due_at),
              technicians: assignments
                .filter((a) => a.work_item_id === i.id)
                .map((a) => ({ id: a.id, name: a.name })),
            })),
            logs: (
              await rows(
                c,
                sql`SELECT id,type,note,occurred_at FROM work_logs WHERE work_order_id=${order.id} ORDER BY occurred_at DESC,id DESC LIMIT 100`,
              )
            ).map((l) => ({
              id: l.id,
              type: l.type,
              note: l.note,
              occurredAt: iso(l.occurred_at),
            })),
          }
        : null,
      acceptances: inspections,
      occupancies: holds.map((o) => ({
        id: o.id,
        resourceId: o.resource_id,
        name: o.name,
        startedAt: iso(o.started_at),
        expectedReleaseAt: iso(o.expected_release_at),
        endedAt: o.ended_at ? iso(o.ended_at) : null,
        overdue: !o.ended_at && +o.expected_release_at < +ctx.now,
      })),
      handover: handover
        ? {
            id: handover.id,
            handedOverAt: iso(handover.handed_over_at),
            recipientName: handover.recipient_name,
            paymentBasis: handover.payment_basis,
            approvedObligation: handover.approved_obligation,
            evidenceNote: handover.evidence_note,
          }
        : null,
      allowedActions: open
        ? [
            "quote",
            "work",
            "acceptance",
            ...(ctx.actor!.role === "MANAGER" ? ["exemption", "abort"] : []),
          ]
        : [],
    };
  }
  async listQuotes(c: Conn, ctx: Context, q: Row) {
    const result = await page(
      c,
      this.config,
      ctx,
      sql`SELECT r.*,r.created_at AS cursor_key,v.code AS visit_code,v.contact_snapshot,v.vehicle_snapshot FROM quote_revisions r JOIN service_visits v ON v.id=r.visit_id WHERE ${scope(ctx, "v")} ${q.status ? sql`AND r.status=${q.status}` : sql``} ${q.q ? sql`AND (v.code ILIKE ${"%" + q.q + "%"} OR v.contact_snapshot->>'name' ILIKE ${"%" + q.q + "%"} OR v.vehicle_snapshot->>'plate' ILIKE ${"%" + q.q + "%"})` : sql``}`,
      q,
      "createdAt:desc",
      true,
    );
    return {
      data: result.items.map((r) => ({
        id: r.id,
        visitId: r.visit_id,
        visitCode: r.visit_code,
        revisionNo: r.revision_no,
        kind: r.kind,
        status: r.status,
        total: r.total,
        currency: r.currency,
        customer: r.contact_snapshot,
        vehicle: r.vehicle_snapshot,
        createdAt: iso(r.created_at),
      })),
      page: result.page,
    };
  }
  async createQuote(c: Conn, ctx: Context, id: string, input: Row) {
    const v = await this.visit(c, ctx, id, input.expectedVersion);
    if (
      await one(
        c,
        sql`SELECT id FROM quote_revisions WHERE visit_id=${id} AND status IN ('DRAFT','SUBMITTED')`,
      )
    )
      fail(409, "QUOTE_OPEN_REVISION", "Hãy xử lý bản báo giá đang mở trước.");
    const base = await one(
      c,
      sql`SELECT * FROM quote_revisions WHERE visit_id=${id} ORDER BY revision_no DESC LIMIT 1`,
    );
    if ((input.baseRevisionId || null) !== (base?.id || null))
      fail(409, "QUOTE_REVISION_CONFLICT");
    const approved = await one(
      c,
      sql`SELECT id FROM quote_revisions WHERE visit_id=${id} AND status='APPROVED' LIMIT 1`,
    );
    const r = (await one(
      c,
      sql`INSERT INTO quote_revisions(visit_id,revision_no,kind,base_revision_id,created_by,created_at) VALUES(${id},${(base?.revision_no || 0) + 1},${approved ? "CHANGE_ORDER" : "INITIAL"},${base?.id || null},${ctx.actor!.userId},${ctx.now}) RETURNING *`,
    ))!;
    if (base?.status === "REJECTED") {
      await c.execute(
        sql`INSERT INTO quote_lines(revision_id,sequence_no,kind,service_id,resource_plan,name,code,unit,quantity,unit_price,discount_percent,vat_percent,subtotal,discount_total,tax_total,total) SELECT ${r.id},sequence_no,kind,service_id,resource_plan,name,code,unit,quantity,unit_price,discount_percent,vat_percent,subtotal,discount_total,tax_total,total FROM quote_lines WHERE revision_id=${base.id}`,
      );
      await c.execute(
        sql`UPDATE quote_revisions SET discount_percent=${base.discount_percent},subtotal=${base.subtotal},discount_total=${base.discount_total},tax_total=${base.tax_total},total=${base.total},note=${base.note} WHERE id=${r.id}`,
      );
    }
    return this.record(c, ctx, v, "QUOTE_CREATED", input.reason, {
      revisionId: r.id,
    });
  }
  async saveQuote(c: Conn, ctx: Context, id: string, input: Row) {
    const { revision: r, visit: v } = await this.revision(
      c,
      ctx,
      id,
      input.expectedVersion,
    );
    if (r.status !== "DRAFT")
      fail(
        409,
        "QUOTE_LOCKED",
        "Báo giá đã gửi hoặc đã có quyết định, không thể sửa đè.",
      );
    const plans: (ServicePlan | null)[] = [];
    for (const l of input.lines) {
      if (l.kind === "SERVICE") {
        if (!l.serviceId || !/^1(\.0{1,3})?$/.test(l.quantity))
          fail(
            422,
            "SERVICE_PLAN_REQUIRED",
            "Mỗi dòng dịch vụ cần chọn một gói chuẩn với số lượng 1.",
          );
        plans.push(
          (
            await this.capacity.servicePlans(
              c,
              ctx,
              [l.serviceId],
              ctx.station.catalog_version,
            )
          )[0],
        );
      } else {
        if (l.serviceId) fail(422, "QUOTE_LINE_INVALID");
        plans.push(null);
      }
    }
    const totals = quoteMoney(input.lines, input.discountPercent);
    await c.execute(sql`DELETE FROM quote_lines WHERE revision_id=${id}`);
    for (const [i, l] of input.lines.entries()) {
      const t = totals.lines[i];
      await c.execute(
        sql`INSERT INTO quote_lines(revision_id,sequence_no,kind,service_id,resource_plan,name,code,unit,quantity,unit_price,discount_percent,vat_percent,subtotal,discount_total,tax_total,total) VALUES(${id},${i},${l.kind},${l.serviceId || null},${plans[i] ? json(plans[i]) : sql`NULL`},${l.name},${l.code},${l.unit},${l.quantity},${l.unitPrice},${l.discountPercent},${l.vatPercent},${t.subtotal},${t.discountTotal},${t.taxTotal},${t.total})`,
      );
    }
    await c.execute(
      sql`UPDATE quote_revisions SET discount_percent=${input.discountPercent},subtotal=${totals.subtotal},discount_total=${totals.discountTotal},tax_total=${totals.taxTotal},total=${totals.total},note=${input.note} WHERE id=${id}`,
    );
    return this.record(c, ctx, v, "QUOTE_DRAFT_SAVED", input.reason, {
      revisionId: id,
    });
  }
  async submit(c: Conn, ctx: Context, id: string, input: Row) {
    const { revision: r, visit: v } = await this.revision(
      c,
      ctx,
      id,
      input.expectedVersion,
    );
    if (r.status !== "DRAFT") fail(409, "INVALID_TRANSITION");
    if (
      !(await one(
        c,
        sql`SELECT id FROM quote_lines WHERE revision_id=${id} LIMIT 1`,
      ))
    )
      fail(422, "QUOTE_EMPTY");
    const snapshot = {
      station: {
        name: ctx.station.name,
        phone: ctx.station.phone,
        address: ctx.station.address,
      },
      visitCode: v.code,
      customer: v.contact_snapshot,
      vehicle: v.vehicle_snapshot,
      request: v.request,
    };
    await c.execute(
      sql`UPDATE quote_revisions SET status='SUBMITTED',submitted_at=${ctx.now},print_snapshot=${json(snapshot)} WHERE id=${id}`,
    );
    return this.record(c, ctx, v, "QUOTE_SUBMITTED", input.reason, {
      revisionId: id,
    });
  }
  async decide(c: Conn, ctx: Context, id: string, input: Row) {
    const { revision: r, visit: v } = await this.revision(
      c,
      ctx,
      id,
      input.expectedVersion,
    );
    if (r.status !== "SUBMITTED") fail(409, "QUOTE_REVISION_CONFLICT");
    const e = await this.evidence(c, ctx, v, input.evidence);
    await c.execute(
      sql`INSERT INTO quote_decisions(revision_id,decision,recorded_by,recorded_at,customer_name,channel,evidence_note,media_id) VALUES(${id},${input.decision},${ctx.actor!.userId},${ctx.now},${e.customerName},${e.channel},${e.note},${e.mediaId})`,
    );
    await c.execute(
      sql`UPDATE quote_revisions SET status=${input.decision},decided_at=${ctx.now} WHERE id=${id}`,
    );
    if (input.decision === "APPROVED") {
      await this.finance.obligation(c, v.id);
      await this.invalidate(c, ctx, v);
    }
    return this.record(c, ctx, v, "QUOTE_" + input.decision, input.reason, {
      revisionId: id,
    });
  }
  async invalidate(c: Conn, ctx: Context, v: Row) {
    const order = await this.order(c, v.id, true);
    await c.execute(
      sql`UPDATE work_orders SET scope_version=scope_version+1,status=CASE WHEN status IN ('FINISHED','IN_PROGRESS') THEN 'PAUSED' ELSE status END,finished_at=NULL WHERE id=${order!.id}`,
    );
    if (["QUALITY_CHECK", "READY"].includes(v.stage)) {
      v.stage = "IN_PROGRESS";
      await c.execute(
        sql`UPDATE service_visits SET stage='IN_PROGRESS',ready_at=NULL WHERE id=${v.id}`,
      );
    }
  }
  async exempt(c: Conn, ctx: Context, id: string, input: Row) {
    manager(ctx);
    const v = await this.visit(c, ctx, id, input.expectedVersion);
    if (
      input.mode === "NO_QUOTE_FREE" &&
      (await one(
        c,
        sql`SELECT id FROM quote_revisions WHERE visit_id=${id} AND status<>'REJECTED' LIMIT 1`,
      ))
    )
      fail(
        409,
        "QUOTE_EXISTS",
        "Miễn báo giá chỉ dùng cho phiếu miễn phí chưa có báo giá.",
      );
    const e = await this.evidence(c, ctx, v, input.evidence),
      r = await one(
        c,
        sql`INSERT INTO work_exemptions(visit_id,mode,scope,reason,evidence,approved_by,approved_at) VALUES(${id},${input.mode},${input.scope},${input.reason},${json(e)},${ctx.actor!.userId},${ctx.now}) RETURNING id`,
      );
    return this.record(c, ctx, v, "WORK_EXEMPTION_APPROVED", input.reason, {
      exemptionId: r!.id,
    });
  }
  async technicians(c: Conn, ctx: Context, values: string[]) {
    const people = await rows(
      c,
      sql`SELECT id FROM staff_profiles WHERE id=ANY(${ids(values)}) AND station_id=${ctx.station.id} AND job_role='TECHNICIAN' AND active`,
    );
    if (people.length !== values.length) fail(422, "TECHNICIAN_UNAVAILABLE");
  }
  async authorizeItem(
    c: Conn,
    visitId: string,
    quoteLineId?: string | null,
    exemptionId?: string | null,
  ) {
    if (quoteLineId && exemptionId) fail(422, "WORK_AUTHORIZATION_INVALID");
    if (
      quoteLineId &&
      !(await one(
        c,
        sql`SELECT l.id FROM quote_lines l JOIN quote_revisions r ON r.id=l.revision_id WHERE l.id=${quoteLineId} AND r.visit_id=${visitId} AND r.status='APPROVED' AND l.kind='SERVICE'`,
      ))
    )
      fail(422, "WORK_NOT_AUTHORIZED");
    if (
      exemptionId &&
      !(await one(
        c,
        sql`SELECT id FROM work_exemptions WHERE id=${exemptionId} AND visit_id=${visitId}`,
      ))
    )
      fail(422, "WORK_NOT_AUTHORIZED");
  }
  async assign(
    c: Conn,
    ctx: Context,
    id: string,
    technicians: string[],
    reason: string,
  ) {
    await this.technicians(c, ctx, technicians);
    await c.execute(
      sql`UPDATE work_item_assignments SET ended_at=GREATEST(${ctx.now},assigned_at) WHERE work_item_id=${id} AND ended_at IS NULL`,
    );
    for (const t of technicians)
      await c.execute(
        sql`INSERT INTO work_item_assignments(work_item_id,technician_id,assigned_by,assigned_at,reason) VALUES(${id},${t},${ctx.actor!.userId},${ctx.now},${reason})`,
      );
  }
  async addItem(c: Conn, ctx: Context, id: string, input: Row) {
    const v = await this.visit(c, ctx, id, input.expectedVersion),
      order = (await this.order(c, id, true))!;
    if (+new Date(input.dueAt) <= +ctx.now) fail(422, "DUE_DATE_INVALID");
    if (
      (await one(
        c,
        sql`SELECT count(*)::int AS n FROM work_items WHERE work_order_id=${order.id}`,
      ))!.n >= 200
    )
      fail(422, "WORK_ITEM_LIMIT");
    await this.authorizeItem(c, id, input.quoteLineId, input.exemptionId);
    const item = await one(
      c,
      sql`INSERT INTO work_items(work_order_id,label,quote_line_id,exemption_id,due_at) VALUES(${order.id},${input.label},${input.quoteLineId || null},${input.exemptionId || null},${new Date(input.dueAt)}) RETURNING id`,
    );
    await this.assign(c, ctx, item!.id, input.technicianIds, input.reason);
    await this.invalidate(c, ctx, v);
    return this.record(c, ctx, v, "WORK_ITEM_CREATED", input.reason, {
      workItemId: item!.id,
    });
  }
  async item(c: Conn, ctx: Context, id: string, input: Row, progress = false) {
    const item = await one(
      c,
      sql`SELECT i.*,w.visit_id,w.status AS work_status FROM work_items i JOIN work_orders w ON w.id=i.work_order_id JOIN service_visits v ON v.id=w.visit_id WHERE i.id=${id} AND ${scope(ctx, "v")}`,
    );
    if (!item) fail(404, "NOT_FOUND");
    const v = await this.visit(c, ctx, item.visit_id, input.expectedVersion);
    if (progress) {
      if (item.work_status !== "IN_PROGRESS") fail(409, "INVALID_TRANSITION");
      if (input.status === "SKIPPED") {
        manager(ctx);
        if (item.status !== "PENDING") fail(409, "INVALID_TRANSITION");
      } else if (
        (input.status === "IN_PROGRESS" && item.status !== "PENDING") ||
        (input.status === "DONE" && item.status !== "IN_PROGRESS")
      )
        fail(409, "INVALID_TRANSITION");
      if (input.status !== "SKIPPED") {
        await this.authorizeItem(
          c,
          v.id,
          item.quote_line_id,
          item.exemption_id,
        );
        if (!item.quote_line_id && !item.exemption_id)
          fail(422, "WORK_NOT_AUTHORIZED");
        const people = await rows(
          c,
          sql`SELECT technician_id FROM work_item_assignments WHERE work_item_id=${id} AND ended_at IS NULL`,
        );
        if (!people.length) fail(422, "TECHNICIAN_REQUIRED");
        await this.technicians(
          c,
          ctx,
          people.map((p) => p.technician_id),
        );
        if (input.status === "IN_PROGRESS")
          for (const p of people)
            await checkStaffShift(c, ctx, p.technician_id);
      }
      await c.execute(
        sql`UPDATE work_items SET status=${input.status},started_at=CASE WHEN ${input.status}='IN_PROGRESS' THEN ${ctx.now} ELSE started_at END,finished_at=CASE WHEN ${input.status} IN ('DONE','SKIPPED') THEN ${ctx.now}::timestamptz ELSE NULL END WHERE id=${id}`,
      );
    } else {
      if (item.status !== "PENDING") fail(409, "WORK_ITEM_LOCKED");
      const line =
          input.quoteLineId === undefined
            ? item.quote_line_id
            : input.quoteLineId,
        ex =
          input.exemptionId === undefined
            ? item.exemption_id
            : input.exemptionId;
      await this.authorizeItem(c, v.id, line, ex);
      if (input.dueAt && +new Date(input.dueAt) <= +ctx.now)
        fail(422, "DUE_DATE_INVALID");
      await c.execute(
        sql`UPDATE work_items SET label=${input.label || item.label},quote_line_id=${line},exemption_id=${ex},due_at=${input.dueAt ? new Date(input.dueAt) : item.due_at} WHERE id=${id}`,
      );
      if (input.technicianIds)
        await this.assign(c, ctx, id, input.technicianIds, input.reason);
      await this.invalidate(c, ctx, v);
    }
    const order = (await this.order(c, v.id))!;
    await c.execute(
      sql`INSERT INTO work_logs(work_order_id,actor_user_id,occurred_at,type,note,work_item_id) VALUES(${order.id},${ctx.actor!.userId},${ctx.now},${progress ? "ITEM_" + input.status : "ITEM_EDITED"},${input.reason},${id})`,
    );
    return this.record(
      c,
      ctx,
      v,
      progress ? "WORK_ITEM_" + input.status : "WORK_ITEM_UPDATED",
      input.reason,
      { workItemId: id },
    );
  }
  async coverage(c: Conn, id: string, order: Row) {
    if (
      await one(
        c,
        sql`SELECT id FROM quote_revisions WHERE visit_id=${id} AND status IN ('DRAFT','SUBMITTED') LIMIT 1`,
      )
    )
      fail(409, "QUOTE_PENDING");
    const items = await rows(
      c,
      sql`SELECT * FROM work_items WHERE work_order_id=${order.id}`,
    );
    if (!items.length) fail(422, "WORK_EMPTY");
    for (const i of items) {
      if (i.status === "SKIPPED") continue;
      if (!i.quote_line_id && !i.exemption_id) fail(422, "WORK_NOT_AUTHORIZED");
      await this.authorizeItem(c, id, i.quote_line_id, i.exemption_id);
    }
    const uncovered = await one(
      c,
      sql`SELECT l.id FROM quote_lines l JOIN quote_revisions r ON r.id=l.revision_id WHERE r.visit_id=${id} AND r.status='APPROVED' AND l.kind='SERVICE' AND NOT EXISTS(SELECT 1 FROM work_items i WHERE i.work_order_id=${order.id} AND i.quote_line_id=l.id AND i.status<>'SKIPPED') LIMIT 1`,
    );
    if (uncovered)
      fail(
        422,
        "APPROVED_SCOPE_INCOMPLETE",
        "Chưa có công việc cho toàn bộ dịch vụ khách đã duyệt.",
      );
    return items;
  }
  async work(c: Conn, ctx: Context, id: string, action: string, input: Row) {
    const v = await this.visit(c, ctx, id, input.expectedVersion),
      order = (await this.order(c, id, true))!;
    if (action === "start" || action === "resume") {
      if (
        (action === "start" &&
          (order.status !== "NOT_STARTED" || v.stage !== "INSPECTED")) ||
        (action === "resume" && order.status !== "PAUSED")
      )
        fail(409, "INVALID_TRANSITION");
      const items = await this.coverage(c, id, order);
      for (const i of items.filter((i) => i.status !== "SKIPPED")) {
        const assigned = await rows(
          c,
          sql`SELECT technician_id FROM work_item_assignments WHERE work_item_id=${i.id} AND ended_at IS NULL`,
        );
        if (!assigned.length) fail(422, "TECHNICIAN_REQUIRED");
        await this.technicians(
          c,
          ctx,
          assigned.map((a) => a.technician_id),
        );
        for (const a of assigned)
          await checkStaffShift(c, ctx, a.technician_id);
        if (
          await one(
            c,
            sql`SELECT a.id FROM work_item_assignments a JOIN work_items i ON i.id=a.work_item_id JOIN work_orders w ON w.id=i.work_order_id WHERE a.technician_id=ANY(${ids(assigned.map((a) => a.technician_id))}) AND a.ended_at IS NULL AND w.visit_id<>${id} AND w.status='IN_PROGRESS' AND i.status NOT IN ('DONE','SKIPPED') LIMIT 1`,
          )
        )
          fail(409, "TECHNICIAN_BUSY");
      }
      await c.execute(
        sql`UPDATE work_orders SET status='IN_PROGRESS',started_at=COALESCE(started_at,${ctx.now}),finished_at=NULL,due_at=(SELECT max(due_at) FROM work_items WHERE work_order_id=${order.id}) WHERE id=${order.id}`,
      );
      v.stage = "IN_PROGRESS";
    } else if (action === "pause") {
      if (order.status !== "IN_PROGRESS") fail(409, "INVALID_TRANSITION");
      await c.execute(
        sql`UPDATE work_orders SET status='PAUSED' WHERE id=${order.id}`,
      );
    } else if (action === "finish") {
      if (order.status !== "IN_PROGRESS") fail(409, "INVALID_TRANSITION");
      const items = await this.coverage(c, id, order);
      if (
        items.some((i) => !["DONE", "SKIPPED"].includes(i.status)) ||
        items.every((i) => i.status === "SKIPPED")
      )
        fail(422, "WORK_INCOMPLETE");
      await c.execute(
        sql`UPDATE work_orders SET status='FINISHED',finished_at=${ctx.now} WHERE id=${order.id}`,
      );
      v.stage = "QUALITY_CHECK";
    } else if (action === "log") {
      if (!["IN_PROGRESS", "PAUSED"].includes(order.status))
        fail(409, "INVALID_TRANSITION");
      if (
        input.workItemId &&
        !(await one(
          c,
          sql`SELECT id FROM work_items WHERE id=${input.workItemId} AND work_order_id=${order.id}`,
        ))
      )
        fail(422, "WORK_ITEM_INVALID");
    } else fail(404, "NOT_FOUND");
    await c.execute(
      sql`UPDATE service_visits SET stage=${v.stage} WHERE id=${id}`,
    );
    const log = await one(
      c,
      sql`INSERT INTO work_logs(work_order_id,actor_user_id,occurred_at,type,note,work_item_id) VALUES(${order.id},${ctx.actor!.userId},${ctx.now},${action.toUpperCase()},${input.note || input.reason},${input.workItemId || null}) RETURNING id`,
    );
    return this.record(
      c,
      ctx,
      v,
      "WORK_" + action.toUpperCase(),
      input.reason,
      { workLogId: log!.id },
    );
  }
  async extend(c: Conn, ctx: Context, id: string, input: Row) {
    await this.visit(c, ctx, id, input.expectedVersion);
    return fail(
      410,
      "RESOURCE_SCHEDULING_REMOVED",
      "Trạm sử dụng giới hạn lịch theo khung giờ.",
    );
  }
  async release(c: Conn, ctx: Context, id: string, reason: string) {
    await c.execute(
      sql`UPDATE resource_occupancies SET ended_at=${ctx.now},release_reason=${reason} WHERE visit_id=${id} AND ended_at IS NULL`,
    );
    const holds = await rows(
      c,
      sql`SELECT id FROM capacity_reservations WHERE visit_id=${id} AND status='ACTIVE'`,
    );
    for (const h of holds) await this.capacity.release(c, ctx, h.id, reason);
  }
  async releaseReady(c: Conn, ctx: Context, id: string, input: Row) {
    const v = await this.visit(c, ctx, id, input.expectedVersion);
    if (v.stage !== "READY") fail(409, "INVALID_TRANSITION");
    await this.release(c, ctx, id, input.reason);
    return this.record(c, ctx, v, "RESOURCE_RELEASED", input.reason);
  }
  async accept(c: Conn, ctx: Context, id: string, input: Row) {
    const v = await this.visit(c, ctx, id, input.expectedVersion),
      order = await this.order(c, id);
    if (!order || order.status !== "FINISHED" || v.stage !== "QUALITY_CHECK")
      fail(409, "INVALID_TRANSITION");
    if (
      input.result === "PASSED" &&
      !(await this.inventory.fulfilled(c, ctx, id)).fulfilled
    )
      fail(
        409,
        "STOCK_SETTLEMENT_REQUIRED",
        "Chưa xuất đủ phụ tùng cho phạm vi nghiệm thu.",
      );
    const inspector = await one(
      c,
      sql`SELECT id,name FROM staff_profiles WHERE id=${input.inspectorId} AND station_id=${ctx.station.id} AND active`,
    );
    if (!inspector) fail(422, "INSPECTOR_INVALID");
    const items = (await this.coverage(c, id, order)).filter(
        (i) => i.status !== "SKIPPED",
      ),
      map = new Map(input.checks.map((x: Row) => [x.workItemId, x]));
    if (
      map.size !== input.checks.length ||
      map.size !== items.length ||
      items.some((i) => !map.has(i.id))
    )
      fail(422, "ACCEPTANCE_INCOMPLETE");
    const failed = input.checks.filter((x: Row) => !x.passed);
    if (input.result !== (failed.length ? "NEEDS_WORK" : "PASSED"))
      fail(422, "ACCEPTANCE_RESULT_MISMATCH");
    const snapshot = {
      station: {
        name: ctx.station.name,
        phone: ctx.station.phone,
        address: ctx.station.address,
      },
      visitCode: v.code,
      customer: v.contact_snapshot,
      vehicle: v.vehicle_snapshot,
      inspectorName: inspector.name,
    };
    const a = await one(
      c,
      sql`INSERT INTO acceptances(visit_id,work_order_id,scope_version,result,inspector_id,recorded_by,checked_at,note,print_snapshot) VALUES(${id},${order.id},${order.scope_version},${input.result},${input.inspectorId},${ctx.actor!.userId},${ctx.now},${input.note},${json(snapshot)}) RETURNING id`,
    );
    for (const i of items) {
      const check = map.get(i.id) as Row;
      await c.execute(
        sql`INSERT INTO acceptance_checks(acceptance_id,work_item_id,label_snapshot,passed,note) VALUES(${a!.id},${i.id},${i.label},${check.passed},${check.note})`,
      );
    }
    if (failed.length) {
      await c.execute(
        sql`UPDATE work_items SET status='IN_PROGRESS',finished_at=NULL WHERE id=ANY(${ids(failed.map((x: Row) => x.workItemId))})`,
      );
      await c.execute(
        sql`UPDATE work_orders SET status='PAUSED',finished_at=NULL,scope_version=scope_version+1 WHERE id=${order.id}`,
      );
      v.stage = "IN_PROGRESS";
      await c.execute(
        sql`UPDATE service_visits SET stage='IN_PROGRESS' WHERE id=${id}`,
      );
    }
    return this.record(c, ctx, v, "ACCEPTANCE_" + input.result, input.reason, {
      acceptanceId: a!.id,
    });
  }
  async passed(c: Conn, id: string) {
    const order = await this.order(c, id);
    if (!order || order.status !== "FINISHED") fail(409, "WORK_INCOMPLETE");
    const a = await one(
      c,
      sql`SELECT * FROM acceptances WHERE visit_id=${id} AND scope_version=${order.scope_version} ORDER BY checked_at DESC,id DESC LIMIT 1`,
    );
    if (!a || a.result !== "PASSED") fail(409, "ACCEPTANCE_REQUIRED");
    await this.coverage(c, id, order);
    return a;
  }
  async ready(c: Conn, ctx: Context, id: string, input: Row) {
    const v = await this.visit(c, ctx, id, input.expectedVersion);
    if (v.stage !== "QUALITY_CHECK") fail(409, "INVALID_TRANSITION");
    await this.passed(c, id);
    v.stage = "READY";
    await c.execute(
      sql`UPDATE service_visits SET stage='READY',ready_at=${ctx.now} WHERE id=${id}`,
    );
    return this.record(c, ctx, v, "VISIT_READY", input.reason);
  }
  async handover(c: Conn, ctx: Context, id: string, input: Row) {
    const v = await this.visit(c, ctx, id, input.expectedVersion);
    if (v.stage !== "READY") fail(409, "HANDOVER_BLOCKED");
    const acceptance = await this.passed(c, id),
      amount = await this.finance.balance(c, id);
    if (!amount.assessed) fail(409, "OBLIGATION_UNASSESSED");
    if (!(await this.inventory.fulfilled(c, ctx, id)).fulfilled)
      fail(
        409,
        "STOCK_SETTLEMENT_REQUIRED",
        "Cần đối soát phụ tùng trước khi bàn giao.",
      );
    if (amount.outstanding !== "0")
      fail(
        409,
        "PAYMENT_REQUIRED",
        "Phiếu còn tiền phải thu. Cần thu đủ và phân bổ tiền trước khi bàn giao.",
      );
    const basis =
      amount.total === "0" && amount.netReceived === "0"
        ? "NO_CHARGE"
        : "SETTLED";
    if (input.paymentBasis !== basis) fail(422, "PAYMENT_BASIS_INVALID");
    await this.inventory.releaseVisit(c, ctx, id, input.reason);
    await this.release(c, ctx, id, "HANDOVER: " + input.reason);
    const h = await one(
      c,
      sql`INSERT INTO visit_handovers(visit_id,acceptance_id,handed_over_by,handed_over_at,recipient_name,evidence_note,payment_basis,approved_obligation,net_received) VALUES(${id},${acceptance.id},${ctx.actor!.userId},${ctx.now},${input.recipientName},${input.evidenceNote},${basis},${amount.total},${amount.netReceived}) RETURNING id`,
    );
    v.stage = "HANDED_OVER";
    await c.execute(
      sql`UPDATE service_visits SET stage='HANDED_OVER',handed_over_at=${ctx.now} WHERE id=${id}`,
    );
    if (v.booking_id) {
      await c.execute(
        sql`UPDATE bookings SET status='COMPLETED',completed_at=${ctx.now},version=version+1,updated_at=${ctx.now} WHERE id=${v.booking_id} AND status='ARRIVED'`,
      );
      await event(c, ctx, v.booking_id, "BOOKING_HANDED_OVER", input.reason, {
        visitId: id,
      });
    }
    return this.record(c, ctx, v, "VISIT_HANDED_OVER", input.reason, {
      handoverId: h!.id,
    });
  }
  async abort(c: Conn, ctx: Context, id: string, input: Row) {
    manager(ctx);
    const v = await this.visit(c, ctx, id, input.expectedVersion),
      amount = await this.finance.balance(c, id);
    if (BigInt(amount.total || "0") > 0n || BigInt(amount.netReceived) > 0n)
      fail(
        409,
        "ABORT_SETTLEMENT_REQUIRED",
        "Cần đối soát tiền/phụ tùng trước khi dừng phiếu.",
      );
    const requests = await rows(
      c,
      sql`SELECT id FROM stock_requests WHERE visit_id=${id}`,
    );
    for (const r of requests)
      if ((await this.inventory.netIssued(c, r.id)) > 0n)
        fail(
          409,
          "ABORT_SETTLEMENT_REQUIRED",
          "Cần trả hoặc xử lý phụ tùng đã xuất trước khi dừng phiếu.",
        );
    await this.inventory.releaseVisit(c, ctx, id, input.reason);
    await this.release(c, ctx, id, "ABORT: " + input.reason);
    await c.execute(
      sql`UPDATE work_orders SET status='ABORTED' WHERE visit_id=${id}`,
    );
    v.stage = "ABORTED";
    await c.execute(
      sql`UPDATE service_visits SET stage='ABORTED',aborted_at=${ctx.now} WHERE id=${id}`,
    );
    if (v.booking_id) {
      await c.execute(
        sql`UPDATE bookings SET status='CANCELLED',cancelled_at=${ctx.now},cancel_reason=${input.reason},change_kind='CANCELLED',version=version+1,updated_at=${ctx.now} WHERE id=${v.booking_id} AND status='ARRIVED'`,
      );
      await event(c, ctx, v.booking_id, "BOOKING_VISIT_ABORTED", input.reason, {
        visitId: id,
      });
    }
    return this.record(c, ctx, v, "VISIT_ABORTED", input.reason, {
      evidenceNote: input.evidenceNote,
    });
  }
  async conflicts(c: Conn, ctx: Context, q: Row) {
    manager(ctx);
    const result = await page(
      c,
      this.config,
      ctx,
      sql`SELECT a.id,a.start_at AS cursor_key,a.end_at,a.resource_id,r.booking_id,r.visit_id AS conflicting_visit_id,o.visit_id,o.expected_release_at,u.name FROM reservation_allocations a JOIN capacity_reservations r ON r.id=a.reservation_id JOIN resource_occupancies o ON o.resource_id=a.resource_id AND o.ended_at IS NULL JOIN resource_units u ON u.id=o.resource_id WHERE u.station_id=${ctx.station.id} AND a.released_at IS NULL AND r.visit_id IS DISTINCT FROM o.visit_id AND a.end_at>${ctx.now} AND a.start_at<${new Date(+ctx.now + 7 * 86400000)} AND (o.expected_release_at<=${ctx.now} OR a.start_at<o.expected_release_at)`,
      q,
      "startsAt:asc",
      false,
    );
    return {
      data: result.items.map((x) => ({
        id: x.id,
        resourceId: x.resource_id,
        resourceName: x.name,
        occupiedByVisitId: x.visit_id,
        bookingId: x.booking_id,
        conflictingVisitId: x.conflicting_visit_id,
        startsAt: iso(x.cursor_key),
        endsAt: iso(x.end_at),
        expectedReleaseAt: iso(x.expected_release_at),
      })),
      page: result.page,
    };
  }
  async print(c: Conn, ctx: Context, id: string, kind: "quote" | "acceptance") {
    if (kind === "quote") {
      const { revision: r } = await this.revision(c, ctx, id);
      if (r.status === "DRAFT")
        fail(409, "QUOTE_NOT_SUBMITTED", "Gửi báo giá để cố định bản in.");
      const view = await this.revisionView(c, r);
      return { kind: "quote", snapshot: r.print_snapshot, revision: view };
    }
    const a = await one(
      c,
      sql`SELECT a.*,s.name AS inspector_name FROM acceptances a JOIN staff_profiles s ON s.id=a.inspector_id JOIN service_visits v ON v.id=a.visit_id WHERE a.id=${id} AND ${scope(ctx, "v")}`,
    );
    if (!a) fail(404, "NOT_FOUND");
    await this.visit(c, ctx, a.visit_id);
    return {
      kind: "acceptance",
      snapshot: a.print_snapshot,
      acceptance: {
        id: a.id,
        result: a.result,
        inspectorName: a.print_snapshot.inspectorName,
        checkedAt: iso(a.checked_at),
        note: a.note,
        checks: await rows(
          c,
          sql`SELECT label_snapshot AS label,passed,note FROM acceptance_checks WHERE acceptance_id=${id}`,
        ),
      },
    };
  }
}
