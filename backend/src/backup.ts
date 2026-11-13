import { spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { readFile, writeFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { createHash } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { z } from "zod";
import type { Config } from "./config";
import { Database, sql, one } from "./database";
import { canonical, equal, fail, hash, iso, mac, parse, uuid } from "./common";
import { checkpointChanges, databaseFingerprint } from "./ops-control";

const digest = z.string().regex(/^[a-f0-9]{64}$/);
const tables = z.record(
  z.string(),
  z.strictObject({
    count: z.number().int().min(0),
    checksum: z.string().regex(/^[a-f0-9]{32}$/),
  }),
);
const backupSchema = z.strictObject({
  kind: z.literal("DPAUTO_BACKUP_V1"),
  createdAt: z.string(),
  checkpointId: uuid,
  checkpointFingerprint: digest,
  sourceDatabase: digest,
  dumpSha256: digest,
  tables,
});
const restoreSchema = z.strictObject({
  kind: z.literal("DPAUTO_RESTORE_V1"),
  createdAt: z.string(),
  checkpointId: uuid,
  checkpointFingerprint: digest,
  sourceDatabase: digest,
  dumpSha256: digest,
  targetDatabase: digest,
  verified: z.literal(true),
});
export type RestoreProof = z.infer<typeof restoreSchema>;
export function signedDocument(value: unknown, secret: string) {
  return { value, signature: mac(secret, canonical(value)) };
}
export function verifyDocument<T>(
  raw: unknown,
  schema: z.ZodType<T>,
  secret: string,
): T {
  const wrapper = parse(
    z.strictObject({ value: z.unknown(), signature: z.string().max(200) }),
    raw,
  );
  if (!equal(wrapper.signature, mac(secret, canonical(wrapper.value))))
    fail(422, "OPS_PROOF_SIGNATURE_INVALID");
  return parse(schema, wrapper.value);
}
export async function readProof(path: string, secret: string) {
  if ((await stat(path)).size > 1024 * 1024) fail(422, "OPS_PROOF_INVALID");
  return verifyDocument(
    JSON.parse(await readFile(path, "utf8")),
    restoreSchema,
    secret,
  );
}
export function databaseIdentity(url: string) {
  const p = new URL(url);
  return hash(
    canonical({
      host: p.hostname.toLowerCase(),
      port: p.port || "5432",
      database: decodeURIComponent(p.pathname.slice(1)),
    }),
  );
}
function pgConnection(url: string) {
  const p = new URL(url);
  if (
    !["postgres:", "postgresql:"].includes(p.protocol) ||
    !p.hostname ||
    !p.pathname.slice(1)
  )
    fail(422, "DATABASE_URL_INVALID");
  const env = { ...process.env };
  // libpq variables inherited from another database must not redirect an operations command.
  for (const k of Object.keys(env)) if (k.startsWith("PG")) delete env[k];
  Object.assign(env, {
    PGHOST: p.hostname,
    PGPORT: p.port || "5432",
    PGDATABASE: decodeURIComponent(p.pathname.slice(1)),
    PGUSER: decodeURIComponent(p.username),
    PGPASSWORD: decodeURIComponent(p.password),
  });
  const ssl = p.searchParams.get("sslmode");
  if (ssl) env.PGSSLMODE = ssl;
  if ([...p.searchParams.keys()].some((k) => k !== "sslmode"))
    fail(422, "UNSUPPORTED_LIBPQ_OPTION");
  return env;
}
async function executable(name: string) {
  const root =
    process.env.PG_BIN ||
    (process.platform === "win32"
      ? "C:/Program Files/PostgreSQL/18/bin"
      : "/usr/lib/postgresql/18/bin");
  return join(root, name + (process.platform === "win32" ? ".exe" : ""));
}
async function fileHash(path: string) {
  const h = createHash("sha256");
  for await (const chunk of createReadStream(path)) h.update(chunk as Buffer);
  return h.digest("hex");
}
async function runPg(
  name: string,
  args: string[],
  url: string,
  output?: string,
) {
  const child = spawn(await executable(name), args, {
    env: pgConnection(url),
    windowsHide: true,
    shell: false,
    stdio: ["ignore", output ? "pipe" : "ignore", "ignore"],
  });
  const completed = new Promise<void>((ok, reject) => {
    child.once("error", () => reject(Error("POSTGRES_TOOL_UNAVAILABLE")));
    child.once("close", (code) =>
      code === 0 ? ok() : reject(Error("POSTGRES_TOOL_FAILED")),
    );
  });
  if (output) {
    const stream = createWriteStream(output, { flags: "wx", mode: 0o600 });
    try {
      await Promise.all([completed, pipeline(child.stdout!, stream)]);
    } catch (e) {
      child.kill();
      await completed.catch(() => {});
      throw e;
    }
  } else await completed;
}
export async function privateJson(path: string, value: unknown) {
  await writeFile(path, JSON.stringify(value, null, 2) + "\n", {
    flag: "wx",
    mode: 0o600,
  });
}
export async function backupDatabase(
  db: Database,
  config: Config,
  checkpointId: string,
  path: string,
) {
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const c = drizzle(client),
      station = await one(
        c,
        sql`SELECT id FROM stations WHERE code=${config.stationCode}`,
      );
    if (!station) fail(503, "STATION_NOT_CONFIGURED");
    if (
      !(
        await one(
          c,
          sql`SELECT frozen FROM station_write_guards WHERE station_id=${station.id}`,
        )
      )?.frozen
    )
      fail(409, "FREEZE_REQUIRED");
    const changed = await checkpointChanges(c, { station }, checkpointId);
    if (changed.changedTables.length) fail(409, "CHECKPOINT_STALE");
    const metrics = await databaseFingerprint(c),
      snapshot = await client.query("SELECT pg_export_snapshot() AS id");
    await runPg(
      "pg_dump",
      [
        "--format=custom",
        "--no-owner",
        "--no-acl",
        "--snapshot=" + snapshot.rows[0].id,
      ],
      config.databaseUrl,
      resolve(path),
    );
    const value = {
      kind: "DPAUTO_BACKUP_V1",
      createdAt: iso(config.now()),
      checkpointId,
      checkpointFingerprint: changed.checkpoint.fingerprint,
      sourceDatabase: databaseIdentity(config.databaseUrl),
      dumpSha256: await fileHash(path),
      tables: metrics.tables,
    };
    await privateJson(
      path + ".manifest.json",
      signedDocument(value, config.secret),
    );
    await client.query("COMMIT");
    return {
      path: resolve(path),
      manifest: resolve(path + ".manifest.json"),
      sha256: value.dumpSha256,
    };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
export async function restoreDatabase(
  config: Config,
  path: string,
  targetUrl: string,
  confirmTarget: string,
  reportPath: string,
) {
  const target = new URL(targetUrl),
    name = decodeURIComponent(target.pathname.slice(1));
  if (
    !/^dpauto_restore_[a-zA-Z0-9_]+$/.test(name) ||
    confirmTarget !== name ||
    databaseIdentity(targetUrl) === databaseIdentity(config.databaseUrl)
  )
    fail(422, "RESTORE_TARGET_NOT_ISOLATED");
  if ((await stat(path + ".manifest.json")).size > 1024 * 1024)
    fail(422, "OPS_MANIFEST_INVALID");
  const manifest = verifyDocument(
    JSON.parse(await readFile(path + ".manifest.json", "utf8")),
    backupSchema,
    config.secret,
  );
  if (databaseIdentity(targetUrl) === manifest.sourceDatabase)
    fail(422, "RESTORE_TARGET_NOT_ISOLATED");
  if ((await fileHash(path)) !== manifest.dumpSha256)
    fail(422, "BACKUP_CHECKSUM_MISMATCH");
  const db = new Database(targetUrl);
  try {
    const current = await one(
      db.db,
      sql`SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND c.relkind IN ('r','p','v','m','S','f')`,
    );
    if (current!.n) fail(409, "RESTORE_TARGET_NOT_EMPTY");
    await runPg(
      "pg_restore",
      [
        "--exit-on-error",
        "--single-transaction",
        "--no-owner",
        "--no-acl",
        "--dbname=" + name,
        resolve(path),
      ],
      targetUrl,
    );
    const metrics = await db.tx((c) => databaseFingerprint(c), true);
    if (canonical(metrics.tables) !== canonical(manifest.tables))
      fail(409, "RESTORE_RECONCILIATION_FAILED");
    const proof: RestoreProof = {
      kind: "DPAUTO_RESTORE_V1",
      createdAt: iso(config.now()),
      checkpointId: manifest.checkpointId,
      checkpointFingerprint: manifest.checkpointFingerprint,
      sourceDatabase: manifest.sourceDatabase,
      dumpSha256: manifest.dumpSha256,
      targetDatabase: databaseIdentity(targetUrl),
      verified: true,
    };
    await privateJson(reportPath, signedDocument(proof, config.secret));
    return {
      verified: true,
      report: resolve(reportPath),
      tables: Object.keys(metrics.tables).length,
    };
  } finally {
    await db.close();
  }
}
