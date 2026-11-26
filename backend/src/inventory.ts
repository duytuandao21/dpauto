import { randomUUID } from "node:crypto";
import type { Config } from "./config";
import { sql, one, rows, json, type Conn, type Row } from "./database";
import {
  fail,
  permission,
  scopedVisit,
  expectVersion,
  audit,
  page,
  iso,
  type Context,
} from "./common";
import { quantity, decimal, money, rounded, issueValue } from "./stock-money";
import type { Visits } from "./visits";

export class Inventory {
  constructor(
    readonly config: Config,
    readonly visits: Visits,
  ) {}
  cost(ctx: Context) {
    return ctx.actor!.permissions.includes("inventory.cost.read");
  }
  async catalog(c: Conn, ctx: Context, q: Row, warehouse = false) {
    const table = sql.identifier(warehouse ? "warehouses" : "parts");
    const p = await page(
      c,
      this.config,
      ctx,
      sql`SELECT *,name AS cursor_key FROM ${table} WHERE station_id=${ctx.station.id} ${q.q ? sql`AND (name ILIKE ${"%" + q.q + "%"} OR code ILIKE ${"%" + q.q + "%"})` : sql``}`,
      q,
      "name:asc",
      false,
    );
    return {
      data: p.items.map((x) => ({
        id: x.id,
        code: x.code,
        name: x.name,
        ...(!warehouse ? { unit: x.unit } : {}),
        active: x.active,
        deletedAt: x.deleted_at ?? null,
        version: x.version,
      })),
      page: p.page,
    };
  }
  async catalogWrite(
    c: Conn,
    ctx: Context,
    input: Row,
    id?: string,
    warehouse = false,
  ) {
    if (warehouse && input.name?.length > 120) fail(400, "VALIDATION_FAILED");
    permission(ctx, "inventory.manage");
    const table = sql.identifier(warehouse ? "warehouses" : "parts");
    let value;
    if (id) {
      const old = await one(
        c,
        sql`SELECT * FROM ${table} WHERE id=${id} AND station_id=${ctx.station.id} AND deleted_at IS NULL`,
      );
      if (!old) fail(404, "NOT_FOUND");
      expectVersion(old, input.expectedVersion);
      if (input.active === false) await this.assertUnused(c, id, warehouse);
      value = await one(
        c,
        sql`UPDATE ${table} SET name=${input.name || old.name},active=${input.active ?? old.active},version=version+1 WHERE id=${id} RETURNING id,version`,
      );
    } else
      value = await one(
        c,
        warehouse
          ? sql`INSERT INTO warehouses(station_id,code,name,created_at) VALUES(${ctx.station.id},${input.code},${input.name},${ctx.now}) RETURNING id,version`
          : sql`INSERT INTO parts(station_id,code,name,unit,created_at) VALUES(${ctx.station.id},${input.code},${input.name},${input.unit},${ctx.now}) RETURNING id,version`,
      );
    await audit(
      c,
      ctx,
      "STOCK_CATALOG_CHANGED",
      warehouse ? "warehouse" : "part",
      value!.id,
      input.reason || "Tạo danh mục kho",
    );
    return { ...value, eventId: randomUUID() };
  }
  /** Stock on hand, reservations or open ticket requests keep a part/warehouse in use. */
  private async assertUnused(c: Conn, id: string, warehouse: boolean) {
    if (
      await one(
        c,
        sql`SELECT b.part_id FROM stock_balances b WHERE ${warehouse ? sql`b.warehouse_id=${id}` : sql`b.part_id=${id}`} AND (b.on_hand<>0 OR b.reserved<>0) LIMIT 1`,
      )
    )
      fail(
        409,
        "STOCK_REMAINS",
        "Vẫn còn tồn kho hoặc hàng đang giữ chỗ. Hãy xuất hoặc điều chỉnh về 0 trước.",
      );
    if (
      await one(
        c,
        sql`SELECT r.id FROM stock_requests r JOIN service_visits v ON v.id=r.visit_id WHERE ${warehouse ? sql`r.warehouse_id=${id}` : sql`r.part_id=${id}`} AND v.deleted_at IS NULL AND v.stage NOT IN ('HANDED_OVER','COMPLETED','ABORTED') LIMIT 1`,
      )
    )
      fail(
        409,
        "STOCK_REQUESTS_REMAIN",
        "Đang có yêu cầu xuất kho trên phiếu dịch vụ chưa xong.",
      );
  }
  async catalogRemove(
    c: Conn,
    ctx: Context,
    id: string,
    input: Row,
    warehouse = false,
  ) {
    const table = sql.identifier(warehouse ? "warehouses" : "parts");
    const old = await one(
      c,
      sql`SELECT * FROM ${table} WHERE id=${id}::uuid AND station_id=${ctx.station.id} AND deleted_at IS NULL FOR UPDATE`,
    );
    if (!old) fail(404, "NOT_FOUND");
    expectVersion(old!, input.expectedVersion);
    await this.assertUnused(c, id, warehouse);
    if (
      await one(
        c,
        sql`SELECT d.id FROM stock_documents d ${warehouse ? sql`` : sql`JOIN stock_document_lines l ON l.document_id=d.id`} WHERE d.status='DRAFT' AND d.deleted_at IS NULL AND ${warehouse ? sql`d.warehouse_id=${id}::uuid` : sql`l.part_id=${id}::uuid`} LIMIT 1`,
      )
    )
      fail(
        409,
        "STOCK_DRAFTS_REMAIN",
        "Còn phiếu kho nháp dùng mục này. Hãy ghi sổ hoặc xóa phiếu nháp trước.",
      );
    await c.execute(
      sql`UPDATE ${table} SET active=false,deleted_at=${ctx.now},deleted_by=${ctx.actor!.userId},version=version+1 WHERE id=${id}::uuid`,
    );
    await audit(
      c,
      ctx,
      "STOCK_CATALOG_DELETED",
      warehouse ? "warehouse" : "part",
      id,
      input.reason,
    );
    return { id, deleted: true, version: old!.version + 1 };
  }
  async balance(c: Conn, warehouse: string, part: string) {
    await c.execute(
      sql`INSERT INTO stock_balances(warehouse_id,part_id) VALUES(${warehouse},${part}) ON CONFLICT DO NOTHING`,
    );
    return (await one(
      c,
      sql`SELECT * FROM stock_balances WHERE warehouse_id=${warehouse} AND part_id=${part} FOR UPDATE`,
    ))!;
  }
  async balances(c: Conn, ctx: Context, q: Row) {
    const p = await page(
      c,
      this.config,
      ctx,
      sql`SELECT b.*,p.name AS cursor_key,p.code,p.unit,p.name,w.name AS warehouse_name FROM stock_balances b JOIN parts p ON p.id=b.part_id JOIN warehouses w ON w.id=b.warehouse_id WHERE p.station_id=${ctx.station.id} ${q.warehouseId ? sql`AND b.warehouse_id=${q.warehouseId}` : sql``} ${q.partId ? sql`AND b.part_id=${q.partId}` : sql``} ${q.q ? sql`AND (p.name ILIKE ${"%" + q.q + "%"} OR p.code ILIKE ${"%" + q.q + "%"})` : sql``}`,
      q,
      "name:asc",
      false,
    );
    return {
      data: p.items.map((b) => ({
        partId: b.part_id,
        warehouseId: b.warehouse_id,
        name: b.name,
        code: b.code,
        unit: b.unit,
        warehouseName: b.warehouse_name,
        onHand: b.on_hand,
        reserved: b.reserved,
        available: decimal(quantity(b.on_hand) - quantity(b.reserved)),
        version: b.version,
        ...(this.cost(ctx) ? { carryingValue: b.carrying_value } : {}),
      })),
      page: p.page,
    };
  }
  async doc(c: Conn, ctx: Context, id: string) {
    const d = await one(
      c,
      sql`SELECT * FROM stock_documents WHERE id=${id} AND station_id=${ctx.station.id} AND deleted_at IS NULL`,
    );
    if (!d) fail(404, "NOT_FOUND");
    return d;
  }
  async read(c: Conn, ctx: Context, id: string) {
    const d = await this.doc(c, ctx, id),
      ls = await rows(
        c,
        sql`SELECT * FROM stock_document_lines WHERE document_id=${id} ORDER BY sequence_no`,
      );
    return {
      id: d.id,
      warehouseId: d.warehouse_id,
      kind: d.kind,
      status: d.status,
      version: d.version,
      counterparty: d.counterparty,
      reason: d.reason,
      createdAt: iso(d.created_at),
      postedAt: d.posted_at ? iso(d.posted_at) : null,
      lines: ls.map((l) => ({
        id: l.id,
        partId: l.part_id,
        part: l.part_snapshot,
        quantity: l.quantity,
        requestId: l.request_id,
        originalLineId: l.original_line_id,
        returnCondition: l.return_condition,
        expectedBalanceVersion: l.expected_balance_version,
        quantityDelta: l.quantity_delta,
        ...(this.cost(ctx)
          ? { unitCost: l.unit_cost, valueDelta: l.value_delta }
          : {}),
      })),
    };
  }
  async documents(c: Conn, ctx: Context, q: Row) {
    const p = await page(
      c,
      this.config,
      ctx,
      sql`SELECT d.*,d.created_at AS cursor_key,w.name AS warehouse_name FROM stock_documents d JOIN warehouses w ON w.id=d.warehouse_id WHERE d.station_id=${ctx.station.id} AND d.deleted_at IS NULL ${q.warehouseId ? sql`AND d.warehouse_id=${q.warehouseId}` : sql``} ${q.kind ? sql`AND d.kind=${q.kind}` : sql``}`,
      q,
      "createdAt:desc",
      true,
    );
    return {
      data: p.items.map((d) => ({
        id: d.id,
        warehouseId: d.warehouse_id,
        warehouseName: d.warehouse_name,
        kind: d.kind,
        status: d.status,
        version: d.version,
        createdAt: iso(d.created_at),
        reason: d.reason,
      })),
      page: p.page,
    };
  }
  async save(c: Conn, ctx: Context, input: Row, id?: string) {
    if (["ADJUSTMENT", "STOCKTAKE"].includes(input.kind))
      permission(ctx, "inventory.adjust");
    if (["RECEIPT", "ADJUSTMENT", "STOCKTAKE"].includes(input.kind))
      permission(ctx, "inventory.cost.read");
    const warehouse = await one(
      c,
      sql`SELECT id FROM warehouses WHERE id=${input.warehouseId} AND station_id=${ctx.station.id} AND active`,
    );
    if (!warehouse) fail(422, "WAREHOUSE_INVALID");
    let d: Row;
    if (id) {
      d = await this.doc(c, ctx, id);
      expectVersion(d, input.expectedVersion);
      if (d.status !== "DRAFT") fail(409, "DOCUMENT_POSTED");
      await c.execute(
        sql`DELETE FROM stock_document_lines WHERE document_id=${id}`,
      );
      await c.execute(
        sql`UPDATE stock_documents SET warehouse_id=${input.warehouseId},kind=${input.kind},counterparty=${input.counterparty},reason=${input.reason},version=version+1 WHERE id=${id}`,
      );
      d.version++;
    } else
      d = (await one(
        c,
        sql`INSERT INTO stock_documents(station_id,command_id,warehouse_id,kind,counterparty,reason,created_by,created_at) VALUES(${ctx.station.id},${input.commandId},${input.warehouseId},${input.kind},${input.counterparty},${input.reason},${ctx.actor!.userId},${ctx.now}) RETURNING *`,
      ))!;
    if (
      input.kind === "STOCKTAKE" &&
      new Set(input.lines.map((l: Row) => l.partId)).size !== input.lines.length
    )
      fail(422, "DUPLICATE_COUNT");
    for (const [i, l] of input.lines.entries()) {
      const p = await one(
        c,
        sql`SELECT id,name,code,unit FROM parts WHERE id=${l.partId} AND station_id=${ctx.station.id} AND active`,
      );
      if (!p) fail(422, "PART_INVALID");
      const q = quantity(l.quantity);
      if (
        input.kind === "STOCKTAKE"
          ? q < 0n
          : input.kind === "ADJUSTMENT"
            ? q === 0n
            : q <= 0n
      )
        fail(422, "QUANTITY_INVALID");
      if (
        ["RECEIPT", "ADJUSTMENT", "STOCKTAKE"].includes(input.kind) &&
        q > 0n &&
        l.unitCost === undefined
      )
        fail(422, "COST_REQUIRED");
      if (input.kind === "STOCKTAKE" && !l.expectedBalanceVersion)
        fail(422, "COUNT_VERSION_REQUIRED");
      if (
        (input.kind === "ISSUE" && !l.requestId) ||
        (input.kind === "RETURN" && (!l.originalLineId || !l.returnCondition))
      )
        fail(422, "STOCK_REFERENCE_REQUIRED");
      if (
        (input.kind !== "ISSUE" && l.requestId) ||
        (input.kind !== "RETURN" && (l.originalLineId || l.returnCondition))
      )
        fail(422, "STOCK_REFERENCE_INVALID");
      await c.execute(
        sql`INSERT INTO stock_document_lines(document_id,sequence_no,part_id,quantity,unit_cost,request_id,original_line_id,return_condition,expected_balance_version,part_snapshot) VALUES(${d.id},${i},${p.id},${l.quantity},${l.unitCost || null},${l.requestId || null},${l.originalLineId || null},${l.returnCondition || null},${l.expectedBalanceVersion || null},${json(p)})`,
      );
    }
    await audit(
      c,
      ctx,
      "STOCK_DRAFT_SAVED",
      "stock_document",
      d.id,
      input.reason,
    );
    return { id: d.id, version: d.version, eventId: randomUUID() };
  }
  /** Drafts never touched the ledger, so they can simply be hidden. */
  async removeDraft(c: Conn, ctx: Context, id: string, input: Row) {
    const d = await this.doc(c, ctx, id);
    expectVersion(d, input.expectedVersion);
    if (d.status !== "DRAFT")
      fail(409, "DOCUMENT_POSTED", "Phiếu đã ghi sổ, không thể xóa.");
    await c.execute(
      sql`UPDATE stock_documents SET deleted_at=${ctx.now},deleted_by=${ctx.actor!.userId},version=version+1 WHERE id=${id}`,
    );
    await audit(
      c,
      ctx,
      "STOCK_DRAFT_DELETED",
      "stock_document",
      id,
      input.reason,
    );
    return { id, deleted: true, version: d.version + 1 };
  }
  async netIssued(c: Conn, requestId: string) {
    const x = await one(
      c,
      sql`SELECT COALESCE(sum(l.quantity),0)::text AS issued FROM stock_document_lines l JOIN stock_documents d ON d.id=l.document_id WHERE l.request_id=${requestId} AND d.status='POSTED' AND d.kind='ISSUE'`,
    );
    const r = await one(
      c,
      sql`SELECT COALESCE(sum(r.quantity),0)::text AS returned FROM stock_document_lines r JOIN stock_documents d ON d.id=r.document_id JOIN stock_document_lines l ON l.id=r.original_line_id WHERE l.request_id=${requestId} AND d.status='POSTED' AND d.kind='RETURN'`,
    );
    return quantity(x!.issued) - quantity(r!.returned);
  }
  async requests(c: Conn, ctx: Context, id: string) {
    await scopedVisit(c, ctx, id);
    const ls = await rows(
        c,
        sql`SELECT l.id,l.name,l.quantity,l.unit FROM authorized_quote_lines l JOIN quote_revisions q ON q.id=l.revision_id WHERE q.visit_id=${id} AND q.status='APPROVED' AND l.kind='PART' ORDER BY q.revision_no,l.sequence_no`,
      ),
      result = [];
    for (const l of ls) {
      const r = await one(
          c,
          sql`SELECT r.*,p.code,w.name AS warehouse_name FROM stock_requests r JOIN parts p ON p.id=r.part_id JOIN warehouses w ON w.id=r.warehouse_id WHERE r.quote_line_id=${l.id}`,
        ),
        issued = r ? await this.netIssued(c, r.id) : 0n;
      result.push({
        quoteLineId: l.id,
        name: l.name,
        quantity: l.quantity,
        unit: l.unit,
        request: r
          ? {
              id: r.id,
              partId: r.part_id,
              code: r.code,
              warehouseId: r.warehouse_id,
              warehouseName: r.warehouse_name,
              reserved: r.reserved,
              issued: decimal(issued),
              outstanding: decimal(quantity(r.quantity) - issued),
              version: r.version,
            }
          : null,
      });
    }
    return result;
  }
  async fulfilled(c: Conn, ctx: Context, id: string) {
    const data = await this.requests(c, ctx, id);
    return {
      fulfilled: data.every(
        (l) => !!l.request && quantity(l.request.outstanding) === 0n,
      ),
      lines: data,
    };
  }
  async request(c: Conn, ctx: Context, id: string, input: Row) {
    // shortcut: one part and warehouse per approved line; split requests when fulfillment across warehouses is required.
    const v = await scopedVisit(c, ctx, id, true);
    expectVersion(v, input.expectedVersion);
    if (["HANDED_OVER", "COMPLETED", "ABORTED"].includes(v.stage))
      fail(409, "VISIT_CLOSED");
    const l = await one(
      c,
      sql`SELECT l.* FROM authorized_quote_lines l JOIN quote_revisions q ON q.id=l.revision_id WHERE l.id=${input.quoteLineId} AND q.visit_id=${id} AND q.status='APPROVED' AND l.kind='PART'`,
    );
    const p = await one(
        c,
        sql`SELECT * FROM parts WHERE id=${input.partId} AND station_id=${ctx.station.id} AND active`,
      ),
      w = await one(
        c,
        sql`SELECT id FROM warehouses WHERE id=${input.warehouseId} AND station_id=${ctx.station.id} AND active`,
      );
    if (!l || !p || !w) fail(422, "STOCK_REFERENCE_INVALID");
    if (l.unit.trim().toLowerCase() !== p.unit.trim().toLowerCase())
      fail(
        422,
        "UNIT_MISMATCH",
        "Đơn vị báo giá phải trùng đơn vị tồn kho; chưa tự quy đổi.",
      );
    const r = await one(
      c,
      sql`INSERT INTO stock_requests(visit_id,quote_line_id,warehouse_id,part_id,quantity,created_by,created_at) VALUES(${id},${l.id},${w.id},${p.id},${l.quantity},${ctx.actor!.userId},${ctx.now}) RETURNING id`,
    );
    await this.balance(c, w.id, p.id);
    await this.visits.bump(c, ctx, v);
    return {
      ...this.visits.receipt(
        v,
        await this.visits.log(c, ctx, id, "STOCK_REQUESTED", input.reason),
      ),
      requestId: r!.id,
    };
  }
  async reserve(c: Conn, ctx: Context, id: string, input: Row) {
    const r = await one(
      c,
      sql`SELECT r.* FROM stock_requests r JOIN service_visits v ON v.id=r.visit_id WHERE r.id=${id} AND v.station_id=${ctx.station.id}`,
    );
    if (!r) fail(404, "NOT_FOUND");
    expectVersion(r, input.expectedVersion);
    const v = await scopedVisit(c, ctx, r.visit_id, true);
    if (["HANDED_OVER", "COMPLETED", "ABORTED"].includes(v.stage))
      fail(409, "VISIT_CLOSED");
    if (
      input.action === "RESERVE" &&
      !(await one(
        c,
        sql`SELECT id FROM authorized_quote_lines WHERE id=${r.quote_line_id}`,
      ))
    )
      fail(409, "QUOTE_LINE_NOT_AUTHORIZED");
    const b = await this.balance(c, r.warehouse_id, r.part_id),
      q = quantity(input.quantity),
      current = quantity(r.reserved),
      delta = input.action === "RESERVE" ? q : -q;
    if (
      (delta > 0n &&
        (q > quantity(b.on_hand) - quantity(b.reserved) ||
          q >
            quantity(r.quantity) - (await this.netIssued(c, id)) - current)) ||
      current + delta < 0n
    )
      fail(409, "INSUFFICIENT_STOCK");
    await this.changeReservation(c, ctx, r, delta, input.reason);
    await this.visits.bump(c, ctx, v);
    return {
      ...this.visits.receipt(
        v,
        await this.visits.log(c, ctx, v.id, "STOCK_RESERVED", input.reason),
      ),
      requestId: id,
    };
  }
  async changeReservation(
    c: Conn,
    ctx: Context,
    r: Row,
    delta: bigint,
    reason: string,
  ) {
    if (!delta) return;
    await c.execute(
      sql`UPDATE stock_balances SET reserved=reserved+${decimal(delta)},version=version+1 WHERE warehouse_id=${r.warehouse_id} AND part_id=${r.part_id}`,
    );
    await c.execute(
      sql`UPDATE stock_requests SET reserved=reserved+${decimal(delta)},version=version+1 WHERE id=${r.id}`,
    );
    await c.execute(
      sql`INSERT INTO stock_reservation_events(request_id,quantity,actor_user_id,occurred_at,reason) VALUES(${r.id},${decimal(delta)},${ctx.actor!.userId},${ctx.now},${reason})`,
    );
  }
  async post(c: Conn, ctx: Context, id: string, input: Row) {
    const d = await this.doc(c, ctx, id);
    expectVersion(d, input.expectedVersion);
    if (d.status !== "DRAFT") fail(409, "DOCUMENT_POSTED");
    if (["ADJUSTMENT", "STOCKTAKE"].includes(d.kind))
      permission(ctx, "inventory.adjust");
    if (["RECEIPT", "ADJUSTMENT", "STOCKTAKE"].includes(d.kind))
      permission(ctx, "inventory.cost.read");
    const w = await one(
      c,
      sql`SELECT id FROM warehouses WHERE id=${d.warehouse_id} AND active`,
    );
    if (!w) fail(422, "WAREHOUSE_INVALID");
    const ls = await rows(
        c,
        sql`SELECT * FROM stock_document_lines WHERE document_id=${id} ORDER BY sequence_no`,
      ),
      visits = new Set<string>(),
      pendingIssue = new Map<string, bigint>(),
      pendingReturn = new Map<string, bigint>();
    if (!ls.length) fail(422, "DOCUMENT_EMPTY");
    for (const l of ls) {
      if (
        !(await one(
          c,
          sql`SELECT id FROM parts WHERE id=${l.part_id} AND active`,
        ))
      )
        fail(422, "PART_INVALID");
      let b = await this.balance(c, d.warehouse_id, l.part_id),
        qty = quantity(l.quantity),
        delta = qty,
        value = 0n;
      const onHand = quantity(b.on_hand),
        carrying = BigInt(b.carrying_value);
      if (d.kind === "ISSUE") {
        const r = await one(
          c,
          sql`SELECT * FROM stock_requests WHERE id=${l.request_id}`,
        );
        if (!r || r.warehouse_id !== d.warehouse_id || r.part_id !== l.part_id)
          fail(422, "STOCK_REFERENCE_INVALID");
        const v = await scopedVisit(c, ctx, r.visit_id);
        if (["HANDED_OVER", "COMPLETED", "ABORTED"].includes(v.stage))
          fail(409, "VISIT_CLOSED");
        if (
          !(await one(
            c,
            sql`SELECT id FROM authorized_quote_lines WHERE id=${r.quote_line_id}`,
          ))
        )
          fail(409, "QUOTE_LINE_NOT_AUTHORIZED");
        if (
          qty >
            quantity(r.quantity) -
              (await this.netIssued(c, r.id)) -
              (pendingIssue.get(r.id) || 0n) ||
          qty > onHand - quantity(b.reserved) + quantity(r.reserved)
        )
          fail(409, "INSUFFICIENT_STOCK");
        pendingIssue.set(r.id, (pendingIssue.get(r.id) || 0n) + qty);
        const own = quantity(r.reserved),
          release = qty < own ? qty : own;
        await this.changeReservation(c, ctx, r, -release, input.reason);
        await c.execute(
          sql`UPDATE stock_requests SET version=version+1 WHERE id=${r.id}`,
        );
        delta = -qty;
        value = -issueValue(carrying, onHand, qty);
        visits.add(v.id);
      } else if (d.kind === "RETURN") {
        const original = await one(
          c,
          sql`SELECT l.*,r.visit_id,r.warehouse_id FROM stock_document_lines l JOIN stock_documents d ON d.id=l.document_id JOIN stock_requests r ON r.id=l.request_id WHERE l.id=${l.original_line_id} AND d.kind='ISSUE' AND d.status='POSTED'`,
        );
        if (
          !original ||
          original.part_id !== l.part_id ||
          original.warehouse_id !== d.warehouse_id
        )
          fail(422, "STOCK_REFERENCE_INVALID");
        const v = await scopedVisit(c, ctx, original.visit_id, false, true);
        if (["HANDED_OVER", "COMPLETED"].includes(v.stage))
          fail(
            409,
            "POST_HANDOVER_RETURN_BLOCKED",
            "Cần quy trình bảo hành/điều chỉnh nghĩa vụ trước khi trả phụ tùng của xe đã giao.",
          );
        const previous = await one(
            c,
            sql`SELECT COALESCE(sum(l.quantity),0)::text AS qty FROM stock_document_lines l JOIN stock_documents d ON d.id=l.document_id WHERE l.original_line_id=${original.id} AND d.status='POSTED' AND d.kind='RETURN'`,
          ),
          returned = quantity(previous!.qty),
          issued = quantity(original.quantity);
        const already = returned + (pendingReturn.get(original.id) || 0n);
        if (qty > issued - already) fail(409, "RETURN_EXCEEDS_ISSUED");
        pendingReturn.set(
          original.id,
          (pendingReturn.get(original.id) || 0n) + qty,
        );
        const cost = -BigInt(original.value_delta);
        value =
          rounded(cost * (already + qty), issued) -
          rounded(cost * already, issued);
        if (l.return_condition === "SCRAP") {
          delta = 0n;
          value = 0n;
        }
        await c.execute(
          sql`UPDATE stock_requests SET version=version+1 WHERE id=${original.request_id}`,
        );
        visits.add(v.id);
      } else {
        if (d.kind === "STOCKTAKE") {
          if (b.version !== l.expected_balance_version)
            fail(409, "COUNT_STALE");
          delta = qty - onHand;
        }
        value =
          delta >= 0n
            ? rounded(delta * BigInt(l.unit_cost || "0"), 1000n)
            : -issueValue(carrying, onHand, -delta);
      }
      b = await this.balance(c, d.warehouse_id, l.part_id);
      if (onHand + delta < quantity(b.reserved))
        fail(409, "INSUFFICIENT_STOCK");
      if (onHand + delta > 9999999999999999n) fail(422, "QUANTITY_INVALID");
      const next = money(carrying + value);
      await c.execute(
        sql`UPDATE stock_balances SET on_hand=on_hand+${decimal(delta)},carrying_value=${next},version=version+1 WHERE warehouse_id=${d.warehouse_id} AND part_id=${l.part_id}`,
      );
      await c.execute(
        sql`UPDATE stock_document_lines SET quantity_delta=${decimal(delta)},value_delta=${value.toString()} WHERE id=${l.id}`,
      );
      await c.execute(
        sql`INSERT INTO stock_ledger(document_line_id,warehouse_id,part_id,quantity_delta,value_delta,occurred_at) VALUES(${l.id},${d.warehouse_id},${l.part_id},${decimal(delta)},${value.toString()},${ctx.now})`,
      );
    }
    await c.execute(
      sql`UPDATE stock_documents SET status='POSTED',version=version+1,posted_by=${ctx.actor!.userId},posted_at=${ctx.now} WHERE id=${id}`,
    );
    for (const visitId of visits) {
      const v = await scopedVisit(c, ctx, visitId, false, d.kind === "RETURN");
      if (!v.deleted_at && ["QUALITY_CHECK", "READY"].includes(v.stage)) {
        await c.execute(
          sql`UPDATE work_orders SET scope_version=scope_version+1,status='PAUSED',finished_at=NULL WHERE visit_id=${visitId}`,
        );
        await c.execute(
          sql`UPDATE service_visits SET stage='IN_PROGRESS',ready_at=NULL WHERE id=${visitId}`,
        );
      }
      await this.visits.bump(c, ctx, v);
      await this.visits.log(c, ctx, visitId, "STOCK_POSTED", input.reason, {
        documentId: id,
      });
    }
    await audit(c, ctx, "STOCK_POSTED", "stock_document", id, input.reason);
    return { id, version: d.version + 1, eventId: randomUUID() };
  }
  async ledger(c: Conn, ctx: Context, q: Row) {
    const p = await page(
      c,
      this.config,
      ctx,
      sql`SELECT l.*,l.occurred_at AS cursor_key,p.name,p.code,p.unit,d.kind,d.id AS document_id FROM stock_ledger l JOIN parts p ON p.id=l.part_id JOIN stock_document_lines x ON x.id=l.document_line_id JOIN stock_documents d ON d.id=x.document_id WHERE d.station_id=${ctx.station.id} ${q.partId ? sql`AND l.part_id=${q.partId}` : sql``} ${q.warehouseId ? sql`AND l.warehouse_id=${q.warehouseId}` : sql``}`,
      q,
      "occurredAt:desc",
      true,
    );
    return {
      data: p.items.map((l) => ({
        id: l.id,
        partId: l.part_id,
        warehouseId: l.warehouse_id,
        name: l.name,
        code: l.code,
        unit: l.unit,
        kind: l.kind,
        documentId: l.document_id,
        quantityDelta: l.quantity_delta,
        occurredAt: iso(l.occurred_at),
        ...(this.cost(ctx) ? { valueDelta: l.value_delta } : {}),
      })),
      page: p.page,
    };
  }
  async releaseVisit(c: Conn, ctx: Context, id: string, reason: string) {
    const rs = await rows(
      c,
      sql`SELECT * FROM stock_requests WHERE visit_id=${id} AND reserved>0`,
    );
    for (const r of rs)
      await this.changeReservation(c, ctx, r, -quantity(r.reserved), reason);
  }
  async reconcile(c: Conn, ctx: Context, q: Row) {
    const p = await page(
      c,
      this.config,
      ctx,
      sql`SELECT b.*,p.name,p.code,p.name AS cursor_key,COALESCE(l.qty,0)::text AS ledger_quantity,COALESCE(l.value,0)::text AS ledger_value,COALESCE(r.qty,0)::text AS ledger_reserved FROM stock_balances b JOIN parts p ON p.id=b.part_id LEFT JOIN (SELECT warehouse_id,part_id,sum(quantity_delta) AS qty,sum(value_delta) AS value FROM stock_ledger GROUP BY warehouse_id,part_id) l ON l.warehouse_id=b.warehouse_id AND l.part_id=b.part_id LEFT JOIN (SELECT r.warehouse_id,r.part_id,sum(e.quantity) AS qty FROM stock_reservation_events e JOIN stock_requests r ON r.id=e.request_id GROUP BY r.warehouse_id,r.part_id) r ON r.warehouse_id=b.warehouse_id AND r.part_id=b.part_id WHERE p.station_id=${ctx.station.id} AND (b.on_hand<>COALESCE(l.qty,0) OR b.carrying_value<>COALESCE(l.value,0) OR b.reserved<>COALESCE(r.qty,0))`,
      q,
      "name:asc",
      false,
    );
    return {
      data: p.items.map((b) => ({
        id: b.id,
        partId: b.part_id,
        warehouseId: b.warehouse_id,
        name: b.name,
        code: b.code,
        onHand: b.on_hand,
        reserved: b.reserved,
        ledgerQuantity: b.ledger_quantity,
        ledgerReserved: b.ledger_reserved,
        ...(this.cost(ctx)
          ? { carryingValue: b.carrying_value, ledgerValue: b.ledger_value }
          : {}),
      })),
      page: p.page,
    };
  }
}
