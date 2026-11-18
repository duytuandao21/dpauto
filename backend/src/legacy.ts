import type { Config } from "./config";
import { sql, one, rows, json, type Conn, type Row } from "./database";
import {
  audit,
  canonical,
  expectVersion,
  fail,
  hash,
  iso,
  normalize,
  page,
  permission,
  type Context,
} from "./common";
import type { Directory } from "./directory";
import type { Finance } from "./finance";
import { quantity } from "./stock-money";
import { reviewInput } from "./legacy-contracts";
import { parse } from "./common";
import type { readLegacyFile } from "./legacy-file";

export class Legacy {
  constructor(
    readonly config: Config,
    readonly directory: Directory,
    readonly finance: Finance,
  ) {}
  async batch(c: Conn, ctx: Context, id: string) {
    const b = await one(
      c,
      sql`SELECT * FROM legacy_batches WHERE id=${id} AND station_id=${ctx.station.id} FOR UPDATE`,
    );
    if (!b) fail(404, "NOT_FOUND");
    return b;
  }
  async stage(
    c: Conn,
    ctx: Context,
    file: Awaited<ReturnType<typeof readLegacyFile>>,
  ) {
    if (file.input.stationCode !== ctx.station.code)
      fail(422, "LEGACY_STATION_MISMATCH");
    const previous = await one(
      c,
      sql`SELECT id,status,version FROM legacy_batches WHERE station_id=${ctx.station.id} AND source_system=${file.input.sourceSystem} AND file_sha256=${file.fileSha256}`,
    );
    if (previous) return { ...previous, replayed: true };
    const b = (await one(
      c,
      sql`INSERT INTO legacy_batches(station_id,source_system,file_sha256,scope_mode,exported_at,cutoff_at,expected,validation,status,created_at,created_by) VALUES(${ctx.station.id},${file.input.sourceSystem},${file.fileSha256},${file.input.scopeMode},${new Date(file.input.exportedAt)},${new Date(file.input.cutoffAt)},${json(file.input.expected)},${json(file.report)},'STAGED',${ctx.now},${ctx.actor!.userId}) RETURNING *`,
    ))!;
    for (const r of file.records) {
      const safeArchive =
        ["LINK", "HISTORY", "MEDIA"].includes(r.type) ||
        (["STOCK", "FINANCE"].includes(r.type) && r.data?.mode === "HISTORY");
      await c.execute(
        sql`INSERT INTO legacy_records(batch_id,row_no,entity_type,external_id,source_version,checksum,payload,errors,decision,status,media_content) VALUES(${b.id},${r.row},${r.type},${r.key},${r.sourceVersion},${r.checksum},${json(r.errors.length ? null : r.data)},${json(r.errors)},${safeArchive ? "ARCHIVE" : null},${r.errors.length ? "QUARANTINED" : "STAGED"},${r.media || null})`,
      );
    }
    await audit(
      c,
      ctx,
      "LEGACY_STAGED",
      "legacy_batch",
      b.id,
      `source sha256 ${file.fileSha256}`,
    );
    return {
      id: b.id,
      status: b.status,
      version: b.version,
      valid: file.report.valid,
      errors: file.report.errors.slice(0, 20),
      counts: file.report.counts,
      totals: file.report.totals,
    };
  }
  async identity(c: Conn, ctx: Context, b: Row, type: string, key: string) {
    return one(
      c,
      sql`SELECT * FROM legacy_identities WHERE station_id=${ctx.station.id} AND source_system=${b.source_system} AND entity_type=${type} AND external_id=${key}`,
    );
  }
  async abandon(
    c: Conn,
    ctx: Context,
    id: string,
    version: number,
    reason: string,
  ) {
    const b = await this.batch(c, ctx, id);
    expectVersion(b, version);
    if (b.status !== "STAGED") fail(409, "LEGACY_BATCH_IMMUTABLE");
    await c.execute(
      sql`UPDATE legacy_batches SET status='ABANDONED',version=version+1 WHERE id=${id}`,
    );
    await audit(c, ctx, "LEGACY_BATCH_ABANDONED", "legacy_batch", id, reason);
    return { id, status: "ABANDONED", version: b.version + 1 };
  }
  async candidates(c: Conn, ctx: Context, r: Row) {
    const d = r.payload;
    if (!d) return [];
    if (r.entity_type === "CUSTOMER")
      return rows(
        c,
        sql`SELECT c.id,c.name,c.phone_normalized AS phone,c.version FROM customers c WHERE ${this.directory.customerScope(ctx)} AND c.phone_normalized=${d.phone} LIMIT 21`,
      );
    if (r.entity_type === "VEHICLE" && d.plate)
      return rows(
        c,
        sql`SELECT v.id,v.model,v.plate_normalized AS plate,v.version FROM vehicles v WHERE ${this.directory.vehicleScope(ctx)} AND v.plate_normalized=${d.plate.toUpperCase().replace(/[\s.-]/g, "")} LIMIT 21`,
      );
    return [];
  }
  async proof(c: Conn, ctx: Context, r: Row, type: string, id: string) {
    const d = r.payload;
    if (
      r.entity_type === "STOCK" &&
      d.mode === "OPENING" &&
      type === "STOCK_LINE"
    ) {
      permission(ctx, "inventory.cost.read");
      const p = await one(
        c,
        sql`SELECT l.id,l.quantity_delta::text,l.value_delta::text,p.code AS part_code,p.unit,w.code AS warehouse_code,d.status,d.kind,d.posted_at,s.on_hand::text,s.carrying_value::text FROM stock_document_lines l JOIN stock_documents d ON d.id=l.document_id JOIN parts p ON p.id=l.part_id JOIN warehouses w ON w.id=d.warehouse_id JOIN stock_balances s ON s.warehouse_id=w.id AND s.part_id=p.id WHERE l.id=${id} AND d.station_id=${ctx.station.id}`,
      );
      if (
        !p ||
        p.status !== "POSTED" ||
        p.kind !== "RECEIPT" ||
        +p.posted_at > +new Date(d.asOf) ||
        p.part_code !== d.partCode ||
        p.warehouse_code !== d.warehouseCode ||
        p.unit !== d.unit ||
        quantity(p.quantity_delta) !== quantity(d.quantity) ||
        BigInt(p.value_delta) !== BigInt(d.value) ||
        quantity(p.on_hand) !== quantity(d.quantity) ||
        BigInt(p.carrying_value) !== BigInt(d.value)
      )
        fail(422, "LEGACY_STOCK_PROOF_MISMATCH");
      return p;
    }
    if (r.entity_type === "FINANCE" && d.mode === "OPENING") {
      permission(ctx, "finance.read");
      if (d.kind === "DEPOSIT" && type === "CASH") {
        const p = await this.finance.payment(c, ctx, id);
        if (
          p.kind !== "DEPOSIT" ||
          !p.customer_id ||
          p.reference !== d.code ||
          +p.occurred_at > +new Date(d.asOf)
        )
          fail(422, "LEGACY_DEPOSIT_PROOF_MISMATCH");
        const balance = await this.finance.available(c, id);
        if (balance.available.toString() !== d.amount)
          fail(422, "LEGACY_DEPOSIT_PROOF_MISMATCH");
        return {
          id: p.id,
          customer_id: p.customer_id,
          available: balance.available.toString(),
        };
      }
      if (d.kind === "DEBT" && type === "VISIT") {
        const v = await one(
          c,
          sql`SELECT id,customer_id,version,received_at FROM service_visits WHERE id=${id} AND station_id=${ctx.station.id} AND deleted_at IS NULL`,
        );
        if (!v) fail(404, "NOT_FOUND");
        const balance = await this.finance.balance(c, id);
        if (
          balance.outstanding !== d.amount ||
          +v.received_at > +new Date(d.asOf)
        )
          fail(422, "LEGACY_DEBT_PROOF_MISMATCH");
        return { ...v, outstanding: balance.outstanding };
      }
    }
    if (r.entity_type === "ACTIVE_ORDER" && type === "VISIT") {
      const v = await one(
        c,
        sql`SELECT v.id,v.customer_id,v.vehicle_id,v.version,v.assigned_advisor_id FROM service_visits v JOIN staff_profiles s ON s.id=v.assigned_advisor_id WHERE v.id=${id} AND v.station_id=${ctx.station.id} AND v.deleted_at IS NULL AND v.stage NOT IN ('HANDED_OVER','COMPLETED','ABORTED') AND s.active AND EXISTS(SELECT 1 FROM capacity_reservations r WHERE r.visit_id=v.id AND r.status='ACTIVE')`,
      );
      if (!v) fail(422, "LEGACY_VISIT_PROOF_MISMATCH");
      return v;
    }
    fail(422, "LEGACY_PROOF_TYPE_INVALID");
  }
  async review(
    c: Conn,
    ctx: Context,
    batchId: string,
    recordId: string,
    raw: unknown,
  ) {
    const input = parse(reviewInput, raw),
      b = await this.batch(c, ctx, batchId);
    expectVersion(b, input.expectedVersion);
    if (b.status !== "STAGED") fail(409, "LEGACY_BATCH_IMMUTABLE");
    const r = await one(
      c,
      sql`SELECT * FROM legacy_records WHERE id=${recordId} AND batch_id=${batchId}`,
    );
    if (!r) fail(404, "NOT_FOUND");
    if (r.status === "QUARANTINED")
      fail(422, "LEGACY_SOURCE_REQUIRES_CORRECTION");
    const isEntity = ["CUSTOMER", "VEHICLE"].includes(r.entity_type),
      review: Row = {
        allowDuplicate: input.allowDuplicate,
        ackSourceChange: input.ackSourceChange,
      };
    const old = await this.identity(c, ctx, b, r.entity_type, r.external_id);
    review.existingChecksum = old?.checksum || null;
    if (isEntity) {
      if (!["CREATE", "LINK"].includes(input.decision))
        fail(422, "LEGACY_DECISION_INVALID");
      if (
        input.decision === "CREATE" &&
        !input.allowDuplicate &&
        (await this.candidates(c, ctx, r)).length
      )
        fail(409, "LEGACY_MATCH_REQUIRES_REVIEW");
      if (input.decision === "LINK") {
        if (!input.targetId) fail(422, "LEGACY_TARGET_REQUIRED");
        const target =
          r.entity_type === "CUSTOMER"
            ? await one(
                c,
                sql`SELECT c.id,c.version FROM customers c WHERE c.id=${input.targetId} AND ${this.directory.customerScope(ctx)}`,
              )
            : await one(
                c,
                sql`SELECT v.id,v.version FROM vehicles v WHERE v.id=${input.targetId} AND ${this.directory.vehicleScope(ctx)}`,
              );
        if (!target) fail(404, "NOT_FOUND");
        review.targetId = target.id;
        review.targetVersion = target.version;
      }
    } else {
      if (!["ARCHIVE", "KEEP_LEGACY"].includes(input.decision))
        fail(422, "LEGACY_DECISION_INVALID");
      if (input.liveType || input.liveId) {
        if (!input.liveType || !input.liveId || input.decision !== "ARCHIVE")
          fail(422, "LEGACY_PROOF_TYPE_INVALID");
        review.liveType = input.liveType;
        review.liveId = input.liveId;
        review.proofHash = hash(
          canonical(await this.proof(c, ctx, r, input.liveType, input.liveId)),
        );
      }
    }
    await c.execute(
      sql`UPDATE legacy_records SET decision=${input.decision},review=${json(review)},reviewed_by=${ctx.actor!.userId},reviewed_at=${ctx.now},reason=${input.reason} WHERE id=${recordId}`,
    );
    await c.execute(
      sql`UPDATE legacy_batches SET version=version+1 WHERE id=${batchId}`,
    );
    await audit(
      c,
      ctx,
      "LEGACY_MAPPING_REVIEWED",
      "legacy_record",
      recordId,
      input.reason,
    );
    return { id: recordId, batchId, version: b.version + 1 };
  }
  async plan(c: Conn, ctx: Context, id: string, privateDetails = false) {
    const b = await this.batch(c, ctx, id),
      records = await rows(
        c,
        sql`SELECT id,row_no,entity_type,external_id,source_version,checksum,payload,errors,decision,review,status,customer_id,vehicle_id FROM legacy_records WHERE batch_id=${id} ORDER BY row_no`,
      ),
      issues: Row[] = [];
    if (!b.validation.valid) issues.push({ code: "SOURCE_VALIDATION_FAILED" });
    const refs = new Set(
      records
        .filter((r) => r.status !== "QUARANTINED")
        .map((r) => r.entity_type + ":" + r.external_id),
    );
    for (const r of records) {
      const old = await this.identity(c, ctx, b, r.entity_type, r.external_id);
      if (b.status === "IMPORTED") continue;
      if (
        old &&
        old.checksum === r.checksum &&
        old.source_version === r.source_version
      )
        continue;
      if (!r.decision)
        issues.push({ row: r.row_no, code: "MANUAL_REVIEW_REQUIRED" });
      if (
        old &&
        (!r.review?.ackSourceChange ||
          r.review.existingChecksum !== old.checksum)
      )
        issues.push({ row: r.row_no, code: "SOURCE_CHANGED_REQUIRES_REVIEW" });
      if (
        old &&
        ["CUSTOMER", "VEHICLE"].includes(r.entity_type) &&
        (r.decision !== "LINK" ||
          r.review?.targetId !== (old.customer_id || old.vehicle_id))
      )
        issues.push({
          row: r.row_no,
          code: "IDENTITY_TARGET_MUST_REMAIN_STABLE",
        });
      for (const [field, type] of [
        ["customerKey", "CUSTOMER"],
        ["vehicleKey", "VEHICLE"],
        ["historyKey", "HISTORY"],
      ])
        if (
          r.payload?.[field] &&
          !refs.has(type + ":" + r.payload[field]) &&
          !(await this.identity(c, ctx, b, type, r.payload[field]))
        )
          issues.push({ row: r.row_no, code: "MISSING_REFERENCE", field });
      const opening =
        ["STOCK", "FINANCE"].includes(r.entity_type) &&
        r.payload?.mode === "OPENING";
      const nonzero =
        r.entity_type === "STOCK"
          ? quantity(r.payload?.quantity || "0") !== 0n
          : BigInt(r.payload?.amount || "0") !== 0n;
      if (
        (r.entity_type === "ACTIVE_ORDER" || (opening && nonzero)) &&
        r.decision === "ARCHIVE" &&
        !r.review?.liveId
      )
        issues.push({ row: r.row_no, code: "OPERATIONAL_PROOF_REQUIRED" });
      if (privateDetails) r.candidates = await this.candidates(c, ctx, r);
    }
    const fingerprint = hash(
      canonical({
        id,
        version: b.version,
        source: b.file_sha256,
        records: records.map((r) => ({
          id: r.id,
          checksum: r.checksum,
          decision: r.decision,
          review: r.review || null,
        })),
      }),
    );
    return {
      id,
      status: b.status,
      version: b.version,
      sourceSystem: b.source_system,
      fileSha256: b.file_sha256,
      cutoffAt: iso(b.cutoff_at),
      fingerprint,
      ready: issues.length === 0,
      issues,
      counts: b.validation.counts,
      totals: b.validation.totals,
      ...(privateDetails ? { records } : {}),
    };
  }
  async resolve(c: Conn, ctx: Context, b: Row, type: string, key: string) {
    const found = await this.identity(c, ctx, b, type, key);
    if (!found) fail(422, "LEGACY_REFERENCE_NOT_IMPORTED");
    return found;
  }
  async apply(c: Conn, ctx: Context, id: string, approval: string) {
    const b = await this.batch(c, ctx, id);
    if (b.status === "IMPORTED") return { id, replayed: true };
    if (b.status !== "STAGED") fail(409, "LEGACY_BATCH_IMMUTABLE");
    if (
      !(
        await one(
          c,
          sql`SELECT frozen FROM station_write_guards WHERE station_id=${ctx.station.id}`,
        )
      )?.frozen
    )
      fail(409, "FREEZE_REQUIRED");
    const plan = await this.plan(c, ctx, id);
    if (!plan.ready) fail(422, "LEGACY_REVIEW_REQUIRED");
    if (plan.fingerprint !== approval)
      fail(409, "APPROVAL_FINGERPRINT_MISMATCH");
    const records = await rows(
      c,
      sql`SELECT * FROM legacy_records WHERE batch_id=${id} ORDER BY CASE entity_type WHEN 'CUSTOMER' THEN 0 WHEN 'VEHICLE' THEN 1 WHEN 'LINK' THEN 2 WHEN 'HISTORY' THEN 3 WHEN 'MEDIA' THEN 5 ELSE 4 END,row_no`,
    );
    let imported = 0,
      skipped = 0;
    for (const r of records) {
      const d = r.payload,
        old = await this.identity(c, ctx, b, r.entity_type, r.external_id),
        review = r.review || {};
      if (
        old &&
        old.checksum === r.checksum &&
        old.source_version === r.source_version
      ) {
        await c.execute(
          sql`UPDATE legacy_records SET status='SKIPPED' WHERE id=${r.id}`,
        );
        skipped++;
        continue;
      }
      let customerId: string | null = null,
        vehicleId: string | null = null,
        stockLine: string | null = null,
        cashId: string | null = null,
        visitId: string | null = null,
        ownership = "ARCHIVE";
      if (r.entity_type === "CUSTOMER" || r.entity_type === "VEHICLE") {
        if (r.decision === "CREATE") {
          if (
            !review.allowDuplicate &&
            (await this.candidates(c, ctx, r)).length
          )
            fail(409, "LEGACY_MATCH_REQUIRES_REVIEW");
          const created =
            r.entity_type === "CUSTOMER"
              ? await one(
                  c,
                  sql`INSERT INTO customers(name,normalized_name,phone_normalized,origin) VALUES(${d.name},${normalize(d.name)},${d.phone},'MIGRATION') RETURNING id`,
                )
              : await one(
                  c,
                  sql`INSERT INTO vehicles(model,normalized_model,plate_normalized,model_year,origin) VALUES(${d.model || null},${d.model ? normalize(d.model) : null},${d.plate ? d.plate.toUpperCase().replace(/[\s.-]/g, "") : null},${d.year || null},'MIGRATION') RETURNING id`,
                );
          if (r.entity_type === "CUSTOMER") customerId = created!.id;
          else vehicleId = created!.id;
        } else {
          const target =
            r.entity_type === "CUSTOMER"
              ? await one(
                  c,
                  sql`SELECT c.id,c.version FROM customers c WHERE c.id=${review.targetId} AND ${this.directory.customerScope(ctx)}`,
                )
              : await one(
                  c,
                  sql`SELECT v.id,v.version FROM vehicles v WHERE v.id=${review.targetId} AND ${this.directory.vehicleScope(ctx)}`,
                );
          if (!target || target.version !== review.targetVersion)
            fail(409, "LEGACY_TARGET_CHANGED");
          if (r.entity_type === "CUSTOMER") customerId = target.id;
          else vehicleId = target.id;
        }
      } else {
        if (d.customerKey)
          customerId = (
            await this.resolve(c, ctx, b, "CUSTOMER", d.customerKey)
          ).customer_id;
        if (d.vehicleKey)
          vehicleId = (await this.resolve(c, ctx, b, "VEHICLE", d.vehicleKey))
            .vehicle_id;
        if (r.entity_type === "LINK")
          await c.execute(
            sql`INSERT INTO customer_vehicle_links(customer_id,vehicle_id,verified_at,valid_from,valid_to,source) VALUES(${customerId},${vehicleId},${ctx.now},${new Date(d.validFrom)},${d.validTo ? new Date(d.validTo) : null},'MIGRATION') ON CONFLICT(customer_id,vehicle_id,relationship,valid_from) DO NOTHING`,
          );
        if (r.entity_type === "MEDIA") {
          const h = await this.resolve(c, ctx, b, "HISTORY", d.historyKey),
            parent = (await one(
              c,
              sql`SELECT customer_id,vehicle_id FROM legacy_records WHERE id=${h.current_record_id}`,
            ))!;
          customerId = parent.customer_id;
          vehicleId = parent.vehicle_id;
          if (!r.media_content) fail(422, "LEGACY_MEDIA_MISSING");
        }
        if (r.decision === "KEEP_LEGACY") ownership = "LEGACY";
        if (review.liveId) {
          const proof = await this.proof(
            c,
            ctx,
            r,
            review.liveType,
            review.liveId,
          );
          if (hash(canonical(proof)) !== review.proofHash)
            fail(409, "LEGACY_PROOF_CHANGED");
          if (
            (proof.customer_id && proof.customer_id !== customerId) ||
            (proof.vehicle_id && proof.vehicle_id !== vehicleId)
          )
            fail(422, "LEGACY_PROOF_OWNER_MISMATCH");
          if (review.liveType === "STOCK_LINE") stockLine = proof.id;
          else if (review.liveType === "CASH") cashId = proof.id;
          else visitId = proof.id;
          ownership = "DPAUTO";
        }
      }
      await c.execute(
        sql`UPDATE legacy_records SET status='IMPORTED',customer_id=${customerId},vehicle_id=${vehicleId} WHERE id=${r.id}`,
      );
      await c.execute(
        sql`INSERT INTO legacy_identities(station_id,source_system,entity_type,external_id,source_version,checksum,current_record_id,customer_id,vehicle_id,stock_line_id,cash_id,visit_id,ownership) VALUES(${ctx.station.id},${b.source_system},${r.entity_type},${r.external_id},${r.source_version},${r.checksum},${r.id},${customerId},${vehicleId},${stockLine},${cashId},${visitId},${ownership}) ON CONFLICT(station_id,source_system,entity_type,external_id) DO UPDATE SET source_version=EXCLUDED.source_version,checksum=EXCLUDED.checksum,current_record_id=EXCLUDED.current_record_id,customer_id=EXCLUDED.customer_id,vehicle_id=EXCLUDED.vehicle_id,stock_line_id=EXCLUDED.stock_line_id,cash_id=EXCLUDED.cash_id,visit_id=EXCLUDED.visit_id,ownership=EXCLUDED.ownership`,
      );
      imported++;
    }
    await c.execute(
      sql`UPDATE legacy_batches SET status='IMPORTED',imported_at=${ctx.now},version=version+1 WHERE id=${id}`,
    );
    await audit(
      c,
      ctx,
      "LEGACY_IMPORTED",
      "legacy_batch",
      id,
      `approved ${approval}; imported ${imported}; reused ${skipped}`,
    );
    return { id, imported, skipped };
  }
  async history(c: Conn, ctx: Context, id: string, q: Row, vehicle = false) {
    if (vehicle) await this.directory.vehicle(c, ctx, id);
    else await this.directory.customer(c, ctx, id, 1);
    if (q.kind === "FINANCE") permission(ctx, "finance.read");
    const p = await page(
      c,
      this.config,
      ctx,
      sql`SELECT r.id,r.customer_id,r.payload,r.entity_type,i.source_system,i.external_id,i.source_version,i.ownership,b.imported_at AS cursor_key FROM legacy_records r JOIN legacy_identities i ON i.current_record_id=r.id JOIN legacy_batches b ON b.id=r.batch_id WHERE i.station_id=${ctx.station.id} AND r.status='IMPORTED' AND ${vehicle ? sql`r.vehicle_id=${id}` : sql`r.customer_id=${id}`} AND ${q.kind === "ALL" ? sql`r.entity_type IN ('HISTORY','ACTIVE_ORDER')` : sql`r.entity_type=${q.kind}`}`,
      q,
      "legacy-history",
      true,
    );
    const data = [];
    for (const r of p.items) {
      const media =
        r.entity_type === "HISTORY"
          ? await rows(
              c,
              sql`SELECT m.id,m.payload->>'name' AS name FROM legacy_records m JOIN legacy_identities i ON i.current_record_id=m.id WHERE i.station_id=${ctx.station.id} AND i.source_system=${r.source_system} AND m.customer_id=${r.customer_id} AND m.entity_type='MEDIA' AND m.status='IMPORTED' AND m.payload->>'historyKey'=${r.external_id}`,
            )
          : [];
      data.push({
        id: r.id,
        sourceSystem: r.source_system,
        sourceId: r.external_id,
        sourceVersion: r.source_version,
        ownership: r.ownership,
        kind: r.entity_type,
        data: r.payload,
        media,
      });
    }
    return { data, page: p.page };
  }
  async media(c: Conn, ctx: Context, id: string) {
    const r = await one(
      c,
      sql`SELECT r.customer_id,r.payload,r.media_content FROM legacy_records r JOIN legacy_identities i ON i.current_record_id=r.id WHERE r.id=${id} AND i.station_id=${ctx.station.id} AND r.entity_type='MEDIA' AND r.status='IMPORTED'`,
    );
    if (!r) fail(404, "NOT_FOUND");
    await this.directory.customer(c, ctx, r.customer_id, 1);
    return {
      bytes: r.media_content,
      contentType: r.payload.contentType,
      name: r.payload.name,
    };
  }
}
