import { randomUUID } from "node:crypto";
import type { Config } from "./config";
import { sql, one, rows, json, type Conn, type Row } from "./database";
import { fail, audit, canonical, hash, iso, type Context } from "./common";
import { permissionBundle } from "./auth";

export async function assertStationWritable(c: Conn, stationId: string) {
  if (
    (
      await one(
        c,
        sql`SELECT frozen FROM station_write_guards WHERE station_id=${stationId}`,
      )
    )?.frozen
  )
    fail(
      503,
      "STATION_FROZEN",
      "Trạm đang tạm khóa cập nhật để bảo trì. Vui lòng thử lại sau.",
    );
}
export async function operatorContext(
  c: Conn,
  config: Config,
  email: string,
): Promise<Context> {
  const station = await one(
    c,
    sql`SELECT * FROM stations WHERE code=${config.stationCode} FOR UPDATE`,
  );
  if (!station) fail(503, "STATION_NOT_CONFIGURED");
  const user = await one(
    c,
    sql`SELECT u.id,u.auth_version,u.must_change_password,s.id AS staff_id,s.name,s.job_role,u.email_normalized,ARRAY(SELECT permission_code FROM user_permission_grants WHERE user_id=u.id) AS grants FROM users u JOIN staff_profiles s ON s.user_id=u.id JOIN user_roles r ON r.user_id=u.id WHERE s.station_id=${station.id} AND u.email_normalized=${email.trim().toLowerCase()} AND u.status='ACTIVE' AND s.active AND r.role_code='MANAGER'`,
  );
  if (!user || !user.grants.includes("roles.manage"))
    fail(403, "OPERATOR_NOT_AUTHORIZED");
  if (user.must_change_password) fail(403, "PASSWORD_CHANGE_REQUIRED");
  if ((await one(c, sql`SELECT count(*)::int AS n FROM stations`))!.n !== 1)
    fail(409, "SINGLE_STATION_REQUIRED");
  return {
    station,
    now: config.now(),
    requestId: randomUUID(),
    correlationId: randomUUID(),
    ip: "offline",
    actor: {
      userId: user.id,
      staffId: user.staff_id,
      stationId: station.id,
      authVersion: user.auth_version,
      role: "MANAGER",
      permissions: [...permissionBundle("MANAGER"), ...user.grants],
      name: user.name,
      email: user.email_normalized,
      jobRole: user.job_role,
      mustChange: false,
    },
  };
}
const volatile = new Set([
  "sessions",
  "rate_limit_buckets",
  "idempotency_keys",
  "audit_logs",
  "outbox_jobs",
  "notifications",
  "notification_deliveries",
  "users",
  "user_credentials",
  "station_write_guards",
  "ops_checkpoints",
  "ops_cutovers",
]);
export async function databaseFingerprint(c: Conn, businessOnly = false) {
  await c.execute(sql`SET LOCAL TIME ZONE 'UTC'`);
  const tables = await rows(
    c,
    sql`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`,
  );
  const result: Record<string, { count: number; checksum: string }> = {};
  for (const { tablename } of tables) {
    if (businessOnly && volatile.has(tablename)) continue;
    const table = sql.identifier(tablename);
    const r = await one(
      c,
      sql`SELECT count(*)::int AS n,md5(COALESCE(string_agg(h,'' ORDER BY h),'')) AS digest FROM(SELECT md5(to_jsonb(t)::text) AS h FROM ${table} t) x`,
    );
    result[tablename] = { count: r!.n, checksum: r!.digest };
  }
  return { tables: result, sha256: hash(canonical(result)) };
}
export async function freezeStation(
  c: Conn,
  ctx: Context,
  freeze: boolean,
  expectedVersion: number,
  reason: string,
) {
  const old = await one(
    c,
    sql`SELECT * FROM station_write_guards WHERE station_id=${ctx.station.id} FOR UPDATE`,
  );
  if ((old?.version || 0) !== expectedVersion) fail(409, "VERSION_CONFLICT");
  const row = await one(
    c,
    sql`INSERT INTO station_write_guards(station_id,version,frozen,reason,changed_at,changed_by) VALUES(${ctx.station.id},1,${freeze},${reason},${ctx.now},${ctx.actor!.userId}) ON CONFLICT(station_id) DO UPDATE SET version=station_write_guards.version+1,frozen=EXCLUDED.frozen,reason=EXCLUDED.reason,changed_at=EXCLUDED.changed_at,changed_by=EXCLUDED.changed_by RETURNING version,frozen`,
  );
  await audit(
    c,
    ctx,
    freeze ? "STATION_WRITE_FROZEN" : "STATION_WRITE_RESUMED",
    "station",
    ctx.station.id,
    reason,
  );
  return { version: row!.version as number, frozen: row!.frozen as boolean };
}
export async function checkpoint(c: Conn, ctx: Context, reason: string) {
  if (
    !(
      await one(
        c,
        sql`SELECT frozen FROM station_write_guards WHERE station_id=${ctx.station.id}`,
      )
    )?.frozen
  )
    fail(409, "FREEZE_REQUIRED");
  const snapshot = await databaseFingerprint(c, true);
  const row = await one(
    c,
    sql`INSERT INTO ops_checkpoints(station_id,created_at,created_by,reason,fingerprint,snapshot) VALUES(${ctx.station.id},${ctx.now},${ctx.actor!.userId},${reason},${snapshot.sha256},${json(snapshot.tables)}) RETURNING id`,
  );
  await audit(
    c,
    ctx,
    "CUTOVER_CHECKPOINT_CREATED",
    "checkpoint",
    row!.id,
    reason,
  );
  return { id: row!.id, fingerprint: snapshot.sha256, createdAt: iso(ctx.now) };
}
export async function checkpointChanges(
  c: Conn,
  ctx: Pick<Context, "station">,
  id: string,
) {
  const cp = await one(
    c,
    sql`SELECT * FROM ops_checkpoints WHERE id=${id} AND station_id=${ctx.station.id}`,
  );
  if (!cp) fail(404, "NOT_FOUND");
  const current = await databaseFingerprint(c, true),
    before = cp.snapshot as Record<string, unknown>;
  const changedTables = [
    ...new Set([...Object.keys(before), ...Object.keys(current.tables)]),
  ].filter(
    (t) =>
      canonical(before[t] ?? null) !== canonical(current.tables[t] ?? null),
  );
  return {
    checkpoint: cp,
    current,
    changedTables,
    rollback: changedTables.length
      ? "FORWARD_FIX_REQUIRED"
      : "NO_BUSINESS_DELTA",
  };
}
