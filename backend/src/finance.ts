import { randomUUID } from "node:crypto";
import type { Config } from "./config";
import type { Visits } from "./visits";
import { sql, one, rows, json, type Conn, type Row } from "./database";
import {
  fail,
  scopedVisit,
  scopedBooking,
  expectVersion,
  audit,
  event,
  page,
  iso,
  range,
  type Context,
} from "./common";
import { money } from "./stock-money";

export class Finance {
  constructor(
    readonly config: Config,
    readonly visits: Visits,
  ) {}
  async obligation(c: Conn, id: string) {
    const r = await one(
      c,
      sql`SELECT count(*)::int AS n,COALESCE(sum(total),0)::text AS total FROM quote_revisions WHERE visit_id=${id} AND status='APPROVED'`,
    );
    if (r!.n) {
      const credits = await one(
        c,
        sql`SELECT COALESCE(sum(amount),0)::text AS total FROM obligation_credits WHERE visit_id=${id}`,
      );
      return {
        assessed: true,
        total: money(BigInt(r!.total) - BigInt(credits!.total)),
      };
    }
    const free = await one(
      c,
      sql`SELECT id FROM work_exemptions WHERE visit_id=${id} AND mode='NO_QUOTE_FREE' LIMIT 1`,
    );
    return { assessed: !!free, total: free ? "0" : null };
  }
  async balance(c: Conn, id: string) {
    const obligation = await this.obligation(c, id),
      r = await one(
        c,
        sql`SELECT COALESCE(sum(a.amount-COALESCE((SELECT sum(r.amount) FROM cash_reductions r WHERE r.allocation_id=a.id),0)),0)::text AS net FROM cash_allocations a WHERE a.visit_id=${id}`,
      ),
      net = BigInt(r!.net),
      due = BigInt(obligation.total || "0"),
      remaining = due > net ? due - net : 0n,
      credit = net > due ? net - due : 0n;
    return {
      ...obligation,
      netReceived: money(net),
      outstanding: obligation.assessed ? money(remaining) : null,
      credit: obligation.assessed ? money(credit) : null,
      paymentStatus: !obligation.assessed
        ? "UNASSESSED"
        : net > due
          ? "CREDIT"
          : net === due
            ? "SETTLED"
            : net === 0n
              ? "UNPAID"
              : "PARTIAL",
    };
  }
  async credit(c: Conn, ctx: Context, id: string, input: Row) {
    const v = await scopedVisit(c, ctx, id, true);
    expectVersion(v, input.expectedVersion);
    const current = await this.obligation(c, id);
    if (!current.assessed || BigInt(input.amount) > BigInt(current.total!))
      fail(409, "CREDIT_EXCEEDS_OBLIGATION");
    const r = await one(
      c,
      sql`INSERT INTO obligation_credits(visit_id,command_id,amount,reason,evidence,approved_by,occurred_at) VALUES(${id},${input.commandId},${input.amount},${input.reason},${input.evidence},${ctx.actor!.userId},${ctx.now}) RETURNING id`,
    );
    await this.visits.bump(c, ctx, v);
    return {
      ...this.visits.receipt(
        v,
        await this.visits.log(c, ctx, id, "OBLIGATION_CREDITED", input.reason, {
          creditId: r!.id,
        }),
      ),
      id: r!.id,
    };
  }
  async payment(c: Conn, ctx: Context, id: string) {
    const p = await one(
      c,
      sql`SELECT * FROM cash_entries WHERE id=${id} AND station_id=${ctx.station.id}`,
    );
    if (!p) fail(404, "NOT_FOUND");
    return p;
  }
  async available(c: Conn, id: string) {
    const p = (await one(c, sql`SELECT * FROM cash_entries WHERE id=${id}`))!;
    const a = await one(
      c,
      sql`SELECT COALESCE(sum(amount),0)::text AS assigned FROM cash_allocations WHERE payment_id=${id}`,
    );
    const r = await one(
      c,
      sql`SELECT COALESCE(sum(e.amount),0)::text AS refunded,COALESCE(sum((SELECT sum(x.amount) FROM cash_reductions x WHERE x.entry_id=e.id AND x.allocation_id IS NULL)),0)::text AS unallocated_refund FROM cash_entries e WHERE e.original_id=${id}`,
    );
    return {
      available:
        BigInt(p.amount) - BigInt(a!.assigned) - BigInt(r!.unallocated_refund),
      refundable: BigInt(p.amount) - BigInt(r!.refunded),
    };
  }
  async read(c: Conn, ctx: Context, id: string) {
    const p = await this.payment(c, ctx, id),
      original = !p.original_id;
    const allocations = original
      ? await rows(
          c,
          sql`SELECT a.*,v.code,COALESCE((SELECT sum(x.amount) FROM cash_reductions x WHERE x.allocation_id=a.id),0)::text AS refunded FROM cash_allocations a JOIN service_visits v ON v.id=a.visit_id WHERE a.payment_id=${id} ORDER BY a.occurred_at,a.id`,
        )
      : [];
    const remaining = original ? await this.available(c, id) : null;
    return {
      id: p.id,
      kind: p.kind,
      amount: p.amount,
      currency: p.currency,
      method: p.method,
      bookingId: p.booking_id,
      visitId: p.visit_id,
      customerId: p.customer_id,
      originalId: p.original_id,
      reference: p.reference,
      payerName: p.payer_name,
      reason: p.reason,
      occurredAt: iso(p.occurred_at),
      snapshot: p.print_snapshot,
      available: remaining ? money(remaining.available) : null,
      refundable: remaining ? money(remaining.refundable) : null,
      allocations: allocations.map((a) => ({
        id: a.id,
        visitId: a.visit_id,
        visitCode: a.code,
        amount: a.amount,
        refundable: money(BigInt(a.amount) - BigInt(a.refunded)),
      })),
    };
  }
  async list(c: Conn, ctx: Context, q: Row) {
    const p = await page(
      c,
      this.config,
      ctx,
      sql`SELECT e.*,e.occurred_at AS cursor_key FROM cash_entries e WHERE e.station_id=${ctx.station.id} ${q.visitId ? sql`AND (e.visit_id=${q.visitId} OR EXISTS(SELECT 1 FROM cash_allocations a WHERE a.payment_id=COALESCE(e.original_id,e.id) AND a.visit_id=${q.visitId}))` : sql``} ${q.bookingId ? sql`AND e.booking_id=${q.bookingId}` : sql``} ${q.customerId ? sql`AND e.customer_id=${q.customerId}` : sql``} ${q.q ? sql`AND (e.payer_name ILIKE ${"%" + q.q + "%"} OR e.reference ILIKE ${"%" + q.q + "%"})` : sql``}`,
      q,
      "occurredAt:desc",
      true,
    );
    return {
      data: p.items.map((e) => ({
        id: e.id,
        kind: e.kind,
        amount: e.amount,
        method: e.method,
        reference: e.reference,
        payerName: e.payer_name,
        occurredAt: iso(e.occurred_at),
        visitId: e.visit_id,
        bookingId: e.booking_id,
        customerId: e.customer_id,
        originalId: e.original_id,
      })),
      page: p.page,
    };
  }
  async log(c: Conn, ctx: Context, p: Row, type: string, reason: string) {
    if (p.visit_id) {
      const v = await scopedVisit(c, ctx, p.visit_id);
      await this.visits.bump(c, ctx, v);
      return {
        ...this.visits.receipt(
          v,
          await this.visits.log(c, ctx, v.id, type, reason, {
            paymentId: p.id,
          }),
        ),
        id: p.id,
      };
    }
    if (p.booking_id) {
      await c.execute(
        sql`UPDATE bookings SET version=version+1,updated_at=${ctx.now} WHERE id=${p.booking_id}`,
      );
      const b = (await scopedBooking(c, ctx, p.booking_id))!;
      return {
        id: p.id,
        bookingId: b.id,
        version: b.version,
        eventId: await event(c, ctx, b.id, type, reason, { paymentId: p.id }),
      };
    }
    await audit(c, ctx, type, "cash_entry", p.id, reason);
    return { id: p.id, eventId: randomUUID() };
  }
  async collect(c: Conn, ctx: Context, input: Row) {
    let subject: Row,
      customerId: string,
      vehicle: Row | null = null,
      visitCode: string | null = null;
    if (input.visitId) {
      subject = await scopedVisit(c, ctx, input.visitId, true);
      expectVersion(subject, input.expectedVersion);
      if (["HANDED_OVER", "ABORTED"].includes(subject.stage))
        fail(409, "VISIT_CLOSED");
      customerId = subject.customer_id;
      vehicle = subject.vehicle_snapshot;
      visitCode = subject.code;
      if (input.kind !== "COLLECT") fail(422, "PAYMENT_SUBJECT_INVALID");
      money(
        BigInt((await this.balance(c, subject.id)).netReceived) +
          BigInt(input.amount),
      );
    } else if (input.bookingId) {
      subject = await scopedBooking(c, ctx, input.bookingId, true);
      expectVersion(subject, input.expectedVersion);
      if (!["PENDING", "CONFIRMED"].includes(subject.status))
        fail(409, "DEPOSIT_BOOKING_CLOSED");
      customerId = subject.customer_id;
      vehicle = subject.vehicle_snapshot;
      if (input.kind !== "DEPOSIT") fail(422, "PAYMENT_SUBJECT_INVALID");
    } else {
      subject = await this.visits.directory.contact(
        c,
        ctx,
        input.customer || { id: input.customerId },
      );
      expectVersion(subject, input.expectedVersion);
      customerId = subject.id;
      if (input.kind !== "DEPOSIT") fail(422, "PAYMENT_SUBJECT_INVALID");
    }
    const customer = await one(
        c,
        sql`SELECT name,phone_normalized AS phone FROM customers WHERE id=${customerId}`,
      ),
      snapshot = {
        station: {
          name: ctx.station.name,
          address: ctx.station.address,
          phone: ctx.station.phone,
        },
        customer,
        vehicle,
        visitCode,
      };
    const p = (await one(
      c,
      sql`INSERT INTO cash_entries(station_id,command_id,kind,amount,method,booking_id,visit_id,customer_id,reference,payer_name,reason,recorded_by,occurred_at,print_snapshot) VALUES(${ctx.station.id},${input.commandId},${input.kind},${input.amount},${input.method},${input.bookingId || null},${input.visitId || null},${!input.bookingId && !input.visitId ? customerId : null},${input.reference},${input.payerName},${input.reason},${ctx.actor!.userId},${ctx.now},${json(snapshot)}) RETURNING *`,
    ))!;
    if (input.visitId)
      await this.insertAllocation(
        c,
        ctx,
        p.id,
        input.visitId,
        input.amount,
        randomUUID(),
        input.reason,
      );
    return this.log(c, ctx, p, "CASH_" + input.kind, input.reason);
  }
  async insertAllocation(
    c: Conn,
    ctx: Context,
    paymentId: string,
    visitId: string,
    amount: string,
    commandId: string,
    reason: string,
  ) {
    await c.execute(
      sql`INSERT INTO cash_allocations(payment_id,visit_id,amount,command_id,recorded_by,occurred_at,reason) VALUES(${paymentId},${visitId},${amount},${commandId},${ctx.actor!.userId},${ctx.now},${reason})`,
    );
  }
  async attachDeposits(c: Conn, ctx: Context, visitId: string) {
    const v = await scopedVisit(c, ctx, visitId);
    if (!v.booking_id) return;
    const payments = await rows(
      c,
      sql`SELECT id FROM cash_entries WHERE booking_id=${v.booking_id} AND kind='DEPOSIT' ORDER BY occurred_at,id`,
    );
    for (const p of payments) {
      const a = await this.available(c, p.id);
      if (a.available > 0n) {
        await this.insertAllocation(
          c,
          ctx,
          p.id,
          visitId,
          money(a.available),
          randomUUID(),
          "Phân bổ cọc lịch hẹn khi tiếp nhận",
        );
        await this.visits.log(
          c,
          ctx,
          visitId,
          "DEPOSIT_ALLOCATED",
          "Phân bổ cọc đã thu, không phát sinh thêm dòng tiền",
          { paymentId: p.id },
        );
      }
    }
    await this.balance(c, visitId);
  }
  async allocate(c: Conn, ctx: Context, id: string, input: Row) {
    const p = await this.payment(c, ctx, id);
    if (p.original_id) fail(422, "PAYMENT_SUBJECT_INVALID");
    const v = await scopedVisit(c, ctx, input.visitId, true);
    expectVersion(v, input.expectedVersion);
    if (["HANDED_OVER", "ABORTED"].includes(v.stage)) fail(409, "VISIT_CLOSED");
    if (
      p.customer_id
        ? p.customer_id !== v.customer_id
        : p.booking_id
          ? p.booking_id !== v.booking_id
          : p.visit_id !== v.id
    )
      fail(422, "PAYMENT_SUBJECT_INVALID");
    const available = await this.available(c, id);
    if (input.expectedAvailable !== money(available.available))
      fail(409, "PAYMENT_CONFLICT");
    if (BigInt(input.amount) > available.available)
      fail(409, "PAYMENT_EXCEEDS_AVAILABLE");
    money(
      BigInt((await this.balance(c, v.id)).netReceived) + BigInt(input.amount),
    );
    await this.insertAllocation(
      c,
      ctx,
      id,
      v.id,
      input.amount,
      input.commandId,
      input.reason,
    );
    await this.visits.bump(c, ctx, v);
    return {
      id,
      ...this.visits.receipt(
        v,
        await this.visits.log(c, ctx, v.id, "DEPOSIT_ALLOCATED", input.reason, {
          paymentId: id,
        }),
      ),
    };
  }
  async refund(c: Conn, ctx: Context, id: string, input: Row) {
    const p = await this.payment(c, ctx, id);
    if (p.original_id) fail(422, "PAYMENT_SUBJECT_INVALID");
    const available = await this.available(c, id),
      amount = BigInt(input.amount);
    if (input.expectedRefundable !== money(available.refundable))
      fail(409, "PAYMENT_CONFLICT");
    if (amount > available.refundable) fail(409, "REFUND_EXCEEDS_BALANCE");
    const allocations = await rows(
      c,
      sql`SELECT a.*,a.amount-COALESCE((SELECT sum(r.amount) FROM cash_reductions r WHERE r.allocation_id=a.id),0) AS remaining FROM cash_allocations a WHERE a.payment_id=${id} ORDER BY a.id`,
    );
    const changes: {
      allocationId: string | null;
      visitId: string | null;
      amount: bigint;
    }[] = [];
    if (input.kind === "REVERSAL") {
      if (input.allocationId || amount !== available.refundable)
        fail(422, "REVERSAL_MUST_BE_FULL");
      for (const a of allocations)
        if (BigInt(a.remaining) > 0n)
          changes.push({
            allocationId: a.id,
            visitId: a.visit_id,
            amount: BigInt(a.remaining),
          });
      if (available.available > 0n)
        changes.push({
          allocationId: null,
          visitId: null,
          amount: available.available,
        });
    } else if (input.allocationId) {
      const a = allocations.find((a) => a.id === input.allocationId);
      if (!a || amount > BigInt(a.remaining))
        fail(409, "REFUND_EXCEEDS_BALANCE");
      changes.push({ allocationId: a.id, visitId: a.visit_id, amount });
    } else {
      if (amount > available.available) fail(409, "REFUND_ALLOCATION_REQUIRED");
      changes.push({ allocationId: null, visitId: null, amount });
    }
    const perVisit = new Map<string, bigint>();
    for (const x of changes)
      if (x.visitId)
        perVisit.set(x.visitId, (perVisit.get(x.visitId) || 0n) + x.amount);
    for (const [visitId, reduction] of perVisit) {
      const v = await scopedVisit(c, ctx, visitId),
        balance = await this.balance(c, visitId);
      if (
        v.stage === "HANDED_OVER" &&
        BigInt(balance.netReceived) - reduction < BigInt(balance.total || "0")
      )
        fail(
          409,
          "REFUND_REOPENS_SETTLED_VISIT",
          "Không thể hoàn/đảo làm phát sinh nợ trên phiếu đã bàn giao; cần điều chỉnh nghĩa vụ hợp lệ trước.",
        );
    }
    const result = (await one(
      c,
      sql`INSERT INTO cash_entries(station_id,command_id,kind,amount,method,booking_id,visit_id,customer_id,original_id,reference,payer_name,reason,recorded_by,occurred_at,print_snapshot) VALUES(${ctx.station.id},${input.commandId},${input.kind},${input.amount},${input.method},${p.booking_id},${p.visit_id},${p.customer_id},${id},${input.reference},${p.payer_name},${input.reason},${ctx.actor!.userId},${ctx.now},${json(p.print_snapshot)}) RETURNING *`,
    ))!;
    for (const x of changes)
      await c.execute(
        sql`INSERT INTO cash_reductions(entry_id,allocation_id,amount) VALUES(${result.id},${x.allocationId},${money(x.amount)})`,
      );
    for (const visitId of perVisit.keys())
      if (visitId !== p.visit_id) {
        const v = await scopedVisit(c, ctx, visitId);
        await this.visits.bump(c, ctx, v);
        await this.visits.log(
          c,
          ctx,
          visitId,
          "CASH_" + input.kind,
          input.reason,
          { paymentId: result.id },
        );
      }
    return this.log(c, ctx, result, "CASH_" + input.kind, input.reason);
  }
  async accounts(c: Conn, ctx: Context, q: Row) {
    const p = await page(
      c,
      this.config,
      ctx,
      sql`SELECT v.*,v.received_at AS cursor_key FROM service_visits v WHERE v.station_id=${ctx.station.id} ${q.visitId ? sql`AND v.id=${q.visitId}` : sql``} ${q.q ? sql`AND (v.code ILIKE ${"%" + q.q + "%"} OR v.contact_snapshot->>'name' ILIKE ${"%" + q.q + "%"} OR v.vehicle_snapshot->>'plate' ILIKE ${"%" + q.q + "%"})` : sql``} ${q.outstandingOnly ? sql`AND COALESCE((SELECT sum(total) FROM quote_revisions WHERE visit_id=v.id AND status='APPROVED'),0)-COALESCE((SELECT sum(amount) FROM obligation_credits WHERE visit_id=v.id),0)>COALESCE((SELECT sum(a.amount-COALESCE((SELECT sum(r.amount) FROM cash_reductions r WHERE r.allocation_id=a.id),0)) FROM cash_allocations a WHERE a.visit_id=v.id),0)` : sql``}`,
      q,
      "receivedAt:desc",
      true,
    );
    const data = [];
    for (const v of p.items)
      data.push({
        id: v.id,
        code: v.code,
        version: v.version,
        stage: v.stage,
        customer: v.contact_snapshot,
        vehicle: v.vehicle_snapshot,
        balance: await this.balance(c, v.id),
      });
    return { data, page: p.page };
  }
  async report(c: Conn, ctx: Context, q: Row) {
    const dates = range(q.from, q.to),
      cash = await one(
        c,
        sql`SELECT COALESCE(sum(amount) FILTER(WHERE kind IN ('DEPOSIT','COLLECT')),0)::text AS incoming,COALESCE(sum(amount) FILTER(WHERE kind IN ('REFUND','REVERSAL')),0)::text AS outgoing FROM cash_entries WHERE station_id=${ctx.station.id} AND occurred_at>=${dates.from} AND occurred_at<${dates.to}`,
      ),
      quotes = await one(
        c,
        sql`SELECT COALESCE(sum(q.total),0)::text AS quoted FROM quote_revisions q JOIN service_visits v ON v.id=q.visit_id WHERE v.station_id=${ctx.station.id} AND q.status='APPROVED' AND q.decided_at>=${dates.from} AND q.decided_at<${dates.to}`,
      );
    const outstanding = await one(
      c,
      sql`SELECT COALESCE(sum(GREATEST(0,COALESCE((SELECT sum(q.total) FROM quote_revisions q WHERE q.visit_id=v.id AND q.status='APPROVED'),0)-COALESCE((SELECT sum(amount) FROM obligation_credits WHERE visit_id=v.id),0)-COALESCE((SELECT sum(a.amount-COALESCE((SELECT sum(x.amount) FROM cash_reductions x WHERE x.allocation_id=a.id),0)) FROM cash_allocations a WHERE a.visit_id=v.id),0))),0)::text AS amount FROM service_visits v WHERE v.station_id=${ctx.station.id}`,
    );
    return {
      from: q.from,
      to: q.to,
      asOf: iso(ctx.now),
      cashIn: cash!.incoming,
      cashOut: cash!.outgoing,
      netCash: (BigInt(cash!.incoming) - BigInt(cash!.outgoing)).toString(),
      approvedQuotes: quotes!.quoted,
      outstanding: outstanding!.amount,
      currency: "VND",
    };
  }
}
