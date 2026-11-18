import { randomUUID } from "node:crypto";
import type { Workflow } from "./workflow";
import { sql, one, rows, json, ids, type Conn, type Row } from "./database";
import { fail, event, permission, type Context } from "./common";
import { checkServiceTransition } from "./service-workflow";
import { checkStaffShift } from "./operations";

export class ServiceWorkflowV2 {
  constructor(readonly workflow: Workflow) {}
  async scope(c: Conn, id: string) {
    return rows(
      c,
      sql`SELECT * FROM authorized_quote_lines WHERE visit_id=${id} ORDER BY revision_id,sequence_no`,
    );
  }
  async checks(c: Conn, id: string) {
    return (await this.scope(c, id)).flatMap((l) =>
      (l.workflow_requirements.qualityChecks as string[]).map(
        (label, index) => ({
          key: `${l.id}:${index}`,
          label: `${l.name}: ${label}`,
        }),
      ),
    );
  }
  async unresolved(c: Conn, id: string) {
    const pending = await one(
      c,
      sql`SELECT id FROM quote_revisions WHERE visit_id=${id} AND status IN ('DRAFT','PENDING_APPROVAL','SUBMITTED') LIMIT 1`,
    );
    if (pending)
      fail(
        409,
        "QUOTE_PENDING",
        "Cần xử lý hoặc hủy báo giá đang chờ trước khi hoàn tất phiếu.",
      );
  }
  async summary(c: Conn, ctx: Context, v: Row) {
    const amounts = await one(
      c,
      sql`SELECT COALESCE(sum(total) FILTER(WHERE status IN ('DRAFT','PENDING_APPROVAL','SUBMITTED','APPROVED')),0)::text AS proposed,
      COALESCE(sum(COALESCE(approved_total,total)) FILTER(WHERE kind='INITIAL' AND status='APPROVED'),0)::text AS original,
      COALESCE(sum(total) FILTER(WHERE kind='CHANGE_ORDER' AND status IN ('DRAFT','PENDING_APPROVAL')),0)::text AS pending,
      COALESCE(sum(COALESCE(approved_total,total)) FILTER(WHERE kind='CHANGE_ORDER' AND status='APPROVED'),0)::text AS extras
      FROM quote_revisions WHERE visit_id=${v.id} AND status<>'VOIDED'`,
    );
    return {
      requiredChecks: await this.checks(c, v.id),
      approvedLines: (await this.scope(c, v.id)).map((l) => ({
        id: l.id,
        name: l.name,
        kind: l.kind,
        total: l.total,
        quantity: l.quantity,
        unit: l.unit,
      })),
      quoteTotals: amounts,
    };
  }
  async work(
    c: Conn,
    ctx: Context,
    v: Row,
    order: Row,
    action: string,
    input: Row,
  ) {
    const id = v.id;
    if (action === "start" || action === "resume") {
      if (action === "start") {
        checkServiceTransition(v.stage, "IN_PROGRESS");
        if (order.status !== "NOT_STARTED") fail(409, "INVALID_TRANSITION");
      } else if (
        v.stage !== "IN_PROGRESS" ||
        !v.is_paused ||
        order.status !== "PAUSED"
      )
        fail(409, "INVALID_TRANSITION");
      const approved = await one(
        c,
        sql`SELECT id FROM quote_revisions WHERE visit_id=${id} AND kind='INITIAL' AND status='APPROVED'`,
      );
      const free = await one(
        c,
        sql`SELECT id FROM work_exemptions WHERE visit_id=${id} AND mode='NO_QUOTE_FREE'`,
      );
      if (!approved && !free)
        fail(
          409,
          "QUOTE_APPROVAL_REQUIRED",
          "Cần chốt báo giá gốc trước khi thi công.",
        );
      const initialPending = await one(
        c,
        sql`SELECT id FROM quote_revisions WHERE visit_id=${id} AND kind='INITIAL' AND status IN ('DRAFT','PENDING_APPROVAL','SUBMITTED')`,
      );
      if (initialPending) fail(409, "QUOTE_PENDING");
      const lines = await this.scope(c, id);
      for (const l of lines.filter(
        (l) => l.workflow_requirements.technicianRequired,
      )) {
        const item = await one(
          c,
          sql`SELECT id FROM work_items WHERE work_order_id=${order.id} AND quote_line_id=${l.id} AND status<>'SKIPPED'`,
        );
        if (!item)
          fail(
            422,
            "TECHNICIAN_REQUIRED",
            `Cần công việc và kỹ thuật viên cho ${l.name}.`,
          );
      }
      const items = await rows(
        c,
        sql`SELECT * FROM work_items WHERE work_order_id=${order.id} AND status NOT IN ('DONE','SKIPPED')`,
      );
      for (const item of items) {
        await this.workflow.authorizeItem(
          c,
          id,
          item.quote_line_id,
          item.exemption_id,
        );
        if (!item.quote_line_id && !item.exemption_id)
          fail(422, "WORK_NOT_AUTHORIZED");
        const assigned = await rows(
          c,
          sql`SELECT technician_id FROM work_item_assignments WHERE work_item_id=${item.id} AND ended_at IS NULL`,
        );
        const line = lines.find((l) => l.id === item.quote_line_id);
        if (line?.workflow_requirements.technicianRequired && !assigned.length)
          fail(422, "TECHNICIAN_REQUIRED");
        if (assigned.length) {
          const people = assigned.map((a) => a.technician_id);
          await this.workflow.technicians(c, ctx, people);
          for (const person of people) await checkStaffShift(c, ctx, person);
          if (
            await one(
              c,
              sql`SELECT a.id FROM work_item_assignments a JOIN work_items i ON i.id=a.work_item_id JOIN work_orders w ON w.id=i.work_order_id WHERE a.technician_id=ANY(${ids(people)}) AND a.ended_at IS NULL AND w.visit_id<>${id} AND w.status='IN_PROGRESS' AND i.status NOT IN ('DONE','SKIPPED') LIMIT 1`,
            )
          )
            fail(409, "TECHNICIAN_BUSY");
        }
      }
      v.stage = "IN_PROGRESS";
      await c.execute(
        sql`UPDATE work_orders SET status='IN_PROGRESS',started_at=COALESCE(started_at,${ctx.now}),finished_at=NULL WHERE id=${order.id}`,
      );
      await c.execute(
        sql`UPDATE service_visits SET stage='IN_PROGRESS',is_paused=false,pause_reason=NULL,paused_at=NULL WHERE id=${id}`,
      );
    } else if (action === "pause") {
      if (
        v.stage !== "IN_PROGRESS" ||
        v.is_paused ||
        order.status !== "IN_PROGRESS"
      )
        fail(409, "INVALID_TRANSITION");
      await c.execute(
        sql`UPDATE work_orders SET status='PAUSED' WHERE id=${order.id}`,
      );
      await c.execute(
        sql`UPDATE service_visits SET is_paused=true,pause_reason=${input.reason},paused_at=${ctx.now} WHERE id=${id}`,
      );
    } else if (action === "finish") {
      checkServiceTransition(v.stage, "HANDOVER", v.is_paused);
      if (order.status !== "IN_PROGRESS") fail(409, "INVALID_TRANSITION");
      await this.unresolved(c, id);
      if (input.quality) {
        permission(ctx, "acceptance.record");
        await this.accept(c, ctx, v, {
          ...input.quality,
          reason: input.reason,
        });
      }
      const items = await rows(
        c,
        sql`SELECT * FROM work_items WHERE work_order_id=${order.id}`,
      );
      for (const l of (await this.scope(c, id)).filter(
        (l) => l.workflow_requirements.technicianRequired,
      )) {
        const item = items.find(
          (i) => i.quote_line_id === l.id && i.status === "DONE",
        );
        if (
          !item ||
          !(await one(
            c,
            sql`SELECT id FROM work_item_assignments WHERE work_item_id=${item.id} LIMIT 1`,
          ))
        )
          fail(
            422,
            "TECHNICIAN_REQUIRED",
            `Chưa hoàn tất công việc có kỹ thuật viên cho ${l.name}.`,
          );
      }
      if (items.some((i) => !["DONE", "SKIPPED"].includes(i.status)))
        fail(
          422,
          "WORK_INCOMPLETE",
          "Hoàn tất các công việc đang theo dõi trước.",
        );
      const a = await one(
        c,
        sql`SELECT * FROM acceptances WHERE visit_id=${id} AND scope_version=${order.scope_version} ORDER BY record_no DESC LIMIT 1`,
      );
      if (!a || a.result !== "PASSED" || !a.completion_confirmed)
        fail(
          409,
          "ACCEPTANCE_REQUIRED",
          "Cần xác nhận hoàn tất và kiểm tra chất lượng của phạm vi hiện tại.",
        );
      await c.execute(
        sql`UPDATE work_orders SET status='FINISHED',finished_at=${ctx.now} WHERE id=${order.id}`,
      );
      v.stage = "HANDOVER";
      await c.execute(
        sql`UPDATE service_visits SET stage='HANDOVER',ready_at=${ctx.now} WHERE id=${id}`,
      );
    } else if (action === "log") {
      if (v.stage !== "IN_PROGRESS") fail(409, "INVALID_TRANSITION");
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
      sql`INSERT INTO work_logs(work_order_id,actor_user_id,occurred_at,type,note,work_item_id) VALUES(${order.id},${ctx.actor!.userId},${ctx.now},${action.toUpperCase()},${input.note || input.reason},${input.workItemId || null})`,
    );
    return this.workflow.record(
      c,
      ctx,
      v,
      "WORK_" + action.toUpperCase(),
      input.reason,
      { stage: v.stage },
    );
  }
  async accept(c: Conn, ctx: Context, v: Row, input: Row) {
    const order = await this.workflow.order(c, v.id);
    if (
      v.stage !== "IN_PROGRESS" ||
      v.is_paused ||
      order?.status !== "IN_PROGRESS"
    )
      fail(409, "INVALID_TRANSITION");
    const inspector = await one(
      c,
      sql`SELECT id,name FROM staff_profiles WHERE id=${input.inspectorId} AND station_id=${ctx.station.id} AND active`,
    );
    if (!inspector) fail(422, "INSPECTOR_INVALID");
    const required = await this.checks(c, v.id),
      supplied = input.qualityChecks || [];
    if (
      new Set(supplied.map((x: Row) => x.key)).size !== supplied.length ||
      required.length !== supplied.length ||
      required.some((r) => !supplied.some((x: Row) => x.key === r.key))
    )
      fail(422, "ACCEPTANCE_INCOMPLETE", "Chưa kiểm tra đủ các mục bắt buộc.");
    const items = await rows(
      c,
      sql`SELECT * FROM work_items WHERE work_order_id=${order.id} AND status<>'SKIPPED'`,
    );
    if (
      input.checks.length !== items.length ||
      new Set(input.checks.map((x: Row) => x.workItemId)).size !==
        items.length ||
      items.some((i) => !input.checks.some((x: Row) => x.workItemId === i.id))
    )
      fail(422, "ACCEPTANCE_INCOMPLETE");
    const failed =
      supplied.some((x: Row) => !x.passed) ||
      input.checks.some((x: Row) => !x.passed) ||
      !input.completionConfirmed;
    if (input.result !== (failed ? "NEEDS_WORK" : "PASSED"))
      fail(422, "ACCEPTANCE_RESULT_MISMATCH");
    if (!failed && items.some((i) => i.status !== "DONE"))
      fail(422, "WORK_INCOMPLETE");
    const a = await one(
      c,
      sql`INSERT INTO acceptances(visit_id,work_order_id,scope_version,result,inspector_id,recorded_by,checked_at,note,print_snapshot,quality_checks,completion_confirmed) VALUES(${v.id},${order.id},${order.scope_version},${input.result},${inspector.id},${ctx.actor!.userId},${ctx.now},${input.note},${json({ station: { name: ctx.station.name, phone: ctx.station.phone, address: ctx.station.address }, visitCode: v.code, customer: v.contact_snapshot, vehicle: v.vehicle_snapshot, inspectorName: inspector.name })},${json(supplied.map((x: Row) => ({ ...x, label: required.find((r) => r.key === x.key)?.label })))},${!!input.completionConfirmed}) RETURNING id`,
    );
    for (const item of items) {
      const check = input.checks.find((x: Row) => x.workItemId === item.id);
      await c.execute(
        sql`INSERT INTO acceptance_checks(acceptance_id,work_item_id,label_snapshot,passed,note) VALUES(${a!.id},${item.id},${item.label},${check.passed},${check.note})`,
      );
      if (!check.passed)
        await c.execute(
          sql`UPDATE work_items SET status='IN_PROGRESS',finished_at=NULL WHERE id=${item.id}`,
        );
    }
    return this.workflow.record(
      c,
      ctx,
      v,
      "ACCEPTANCE_" + input.result,
      input.reason,
      { acceptanceId: a!.id },
    );
  }
  async handover(c: Conn, ctx: Context, v: Row, input: Row) {
    checkServiceTransition(v.stage, "COMPLETED");
    const order = await this.workflow.order(c, v.id);
    if (order?.status !== "FINISHED") fail(409, "WORK_INCOMPLETE");
    await this.unresolved(c, v.id);
    const a = await one(
      c,
      sql`SELECT * FROM acceptances WHERE visit_id=${v.id} AND scope_version=${order.scope_version} ORDER BY record_no DESC LIMIT 1`,
    );
    if (!a || a.result !== "PASSED" || !a.completion_confirmed)
      fail(409, "ACCEPTANCE_REQUIRED");
    let amount = await this.workflow.finance.balance(c, v.id);
    if (!amount.assessed) fail(409, "OBLIGATION_UNASSESSED");
    if (!(await this.workflow.inventory.fulfilled(c, ctx, v.id)).fulfilled)
      fail(
        409,
        "STOCK_SETTLEMENT_REQUIRED",
        "Cần đối soát phụ tùng trước khi hoàn thành phiếu.",
      );
    if (amount.outstanding !== "0" && !input.paymentReceived)
      fail(
        409,
        "PAYMENT_REQUIRED",
        "Cần thu đủ và phân bổ tiền trước khi hoàn thành phiếu.",
      );
    const basis =
      amount.total === "0" && amount.netReceived === "0"
        ? "NO_CHARGE"
        : "SETTLED";
    if (input.paymentBasis !== basis) fail(422, "PAYMENT_BASIS_INVALID");
    if (amount.outstanding !== "0") {
      // shortcut: completion confirms collection; record its method separately when cashier collection is enabled.
      const payment = await this.workflow.finance.collect(c, ctx, {
        commandId: randomUUID(),
        expectedVersion: v.version,
        visitId: v.id,
        kind: "COLLECT",
        amount: amount.outstanding,
        method: "OTHER",
        reference: `Hoàn thành phiếu ${v.code}`,
        payerName: v.contact_snapshot.name,
        reason: "Xác nhận đã thu đủ tiền khi hoàn thành phiếu",
      });
      v.version = payment.version;
      amount = await this.workflow.finance.balance(c, v.id);
    }
    await this.workflow.inventory.releaseVisit(c, ctx, v.id, input.reason);
    await this.workflow.release(c, ctx, v.id, input.reason);
    const h = await one(
      c,
      sql`INSERT INTO visit_handovers(visit_id,acceptance_id,handed_over_by,handed_over_at,recipient_name,evidence_note,payment_basis,approved_obligation,net_received) VALUES(${v.id},${a.id},${ctx.actor!.userId},${ctx.now},${input.recipientName},${input.evidenceNote},${basis},${amount.total},${amount.netReceived}) RETURNING id`,
    );
    v.stage = "COMPLETED";
    await c.execute(
      sql`UPDATE service_visits SET stage='COMPLETED',handed_over_at=${ctx.now} WHERE id=${v.id}`,
    );
    if (v.booking_id) {
      await c.execute(
        sql`UPDATE bookings SET status='COMPLETED',completed_at=${ctx.now},version=version+1,updated_at=${ctx.now} WHERE id=${v.booking_id} AND status='ARRIVED'`,
      );
      await event(c, ctx, v.booking_id, "BOOKING_HANDED_OVER", input.reason, {
        visitId: v.id,
      });
    }
    return this.workflow.record(c, ctx, v, "VISIT_COMPLETED", input.reason, {
      handoverId: h!.id,
    });
  }
}
