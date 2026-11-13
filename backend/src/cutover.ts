import { sql, one, rows, type Conn } from "./database";
import { audit, fail, type Context } from "./common";
import type { Config } from "./config";
import { checkpointChanges, freezeStation } from "./ops-control";
import { databaseIdentity, type RestoreProof } from "./backup";

export async function cutoverPlan(
  c: Conn,
  ctx: Context,
  checkpointId: string,
  mode: "NEW_BUSINESS" | "FULL",
) {
  const changes = await checkpointChanges(c, ctx, checkpointId),
    guard = await one(
      c,
      sql`SELECT version,frozen FROM station_write_guards WHERE station_id=${ctx.station.id}`,
    ),
    issues: string[] = [];
  if (!guard?.frozen) issues.push("FREEZE_REQUIRED");
  if (changes.changedTables.length) issues.push("CHECKPOINT_STALE");
  const batches = await rows(
    c,
    sql`SELECT id,status,scope_mode,validation FROM legacy_batches WHERE station_id=${ctx.station.id} AND status<>'ABANDONED'`,
  );
  const legacy = await one(
    c,
    sql`SELECT count(*)::int AS n FROM legacy_identities WHERE station_id=${ctx.station.id} AND ownership='LEGACY'`,
  );
  if (mode === "FULL") {
    if (!batches.length) issues.push("LEGACY_SOURCE_REQUIRED");
    if (
      !batches.some(
        (b) =>
          b.scope_mode === "CUTOVER" &&
          Object.values(b.validation.counts as Record<string, number>).some(
            (n) => n > 0,
          ),
      )
    )
      issues.push("SOURCE_INVENTORY_REQUIRED");
    if (batches.some((b) => b.status !== "IMPORTED" || !b.validation.valid))
      issues.push("LEGACY_BATCHES_UNRESOLVED");
    if (legacy!.n) issues.push("LEGACY_WRITE_OWNERS_REMAIN");
    const uncovered = await one(
      c,
      sql`WITH historical AS (
      SELECT i.customer_id,sum((r.payload->>'outstanding')::numeric) AS amount
      FROM legacy_identities i JOIN legacy_records r ON r.id=i.current_record_id
      WHERE i.station_id=${ctx.station.id} AND i.entity_type='HISTORY' GROUP BY i.customer_id
    ), opening AS (
      SELECT i.customer_id,sum((r.payload->>'amount')::numeric) AS amount
      FROM legacy_identities i JOIN legacy_records r ON r.id=i.current_record_id
      WHERE i.station_id=${ctx.station.id} AND i.entity_type='FINANCE' AND i.ownership='DPAUTO'
      AND r.payload->>'kind'='DEBT' AND r.payload->>'mode'='OPENING' GROUP BY i.customer_id
    ) SELECT count(*)::int AS n FROM historical h LEFT JOIN opening o USING(customer_id)
      WHERE h.amount>0 AND h.amount<>COALESCE(o.amount,0)`,
    );
    if (uncovered!.n) issues.push("HISTORICAL_DEBT_NOT_RECONCILED");
  }
  return {
    mode,
    checkpointId,
    fingerprint: changes.checkpoint.fingerprint,
    version: guard?.version || 0,
    ready: !issues.length,
    issues,
    legacyOwned: legacy!.n,
    changedTables: changes.changedTables,
    rollback: changes.rollback,
  };
}
export async function activateCutover(
  c: Conn,
  ctx: Context,
  config: Config,
  input: {
    checkpointId: string;
    mode: "NEW_BUSINESS" | "FULL";
    approval: string;
    restore: RestoreProof;
    trainingConfirmed: boolean;
    sourceFreezeConfirmed: boolean;
    reason: string;
  },
) {
  const plan = await cutoverPlan(c, ctx, input.checkpointId, input.mode);
  if (!plan.ready) fail(409, "CUTOVER_GATES_NOT_MET");
  if (input.approval !== plan.fingerprint)
    fail(409, "APPROVAL_FINGERPRINT_MISMATCH");
  if (
    !input.trainingConfirmed ||
    (input.mode === "FULL" && !input.sourceFreezeConfirmed)
  )
    fail(422, "CUTOVER_SIGNOFF_REQUIRED");
  const proof = input.restore;
  if (
    !proof.verified ||
    proof.checkpointId !== input.checkpointId ||
    proof.checkpointFingerprint !== plan.fingerprint ||
    proof.sourceDatabase !== databaseIdentity(config.databaseUrl) ||
    proof.targetDatabase === proof.sourceDatabase
  )
    fail(422, "RESTORE_PROOF_MISMATCH");
  if (
    await one(
      c,
      sql`SELECT id FROM ops_cutovers WHERE checkpoint_id=${input.checkpointId}`,
    )
  )
    fail(409, "CHECKPOINT_ALREADY_ACTIVATED");
  const r = await one(
    c,
    sql`INSERT INTO ops_cutovers(station_id,checkpoint_id,mode,restore_proof_sha256,approved_by,approved_at,reason,training_confirmed,source_freeze_confirmed) VALUES(${ctx.station.id},${input.checkpointId},${input.mode},${proof.dumpSha256},${ctx.actor!.userId},${ctx.now},${input.reason},${input.trainingConfirmed},${input.sourceFreezeConfirmed}) RETURNING id`,
  );
  const guard = await freezeStation(c, ctx, false, plan.version, input.reason);
  await audit(
    c,
    ctx,
    "CUTOVER_ACTIVATED",
    "cutover",
    r!.id,
    `${input.mode}; ${input.checkpointId}; ${input.reason}`,
  );
  return {
    id: r!.id,
    mode: input.mode,
    ...guard,
    legacyPolicy:
      input.mode === "NEW_BUSINESS"
        ? "OLD_TRANSACTIONS_REMAIN_IN_LEGACY"
        : "RECONCILED",
  };
}
