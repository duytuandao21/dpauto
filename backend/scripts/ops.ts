import { parseArgs } from "node:util";
import { loadConfig } from "../src/config";
import { Database, sql, one, rows } from "../src/database";
import { fail, parse, text, uuid } from "../src/common";
import {
  operatorContext,
  freezeStation,
  checkpoint,
  checkpointChanges,
} from "../src/ops-control";
import {
  backupDatabase,
  restoreDatabase,
  readProof,
  privateJson,
  signedDocument,
} from "../src/backup";
import { activateCutover, cutoverPlan } from "../src/cutover";

async function main() {
  const { positionals, values: v } = parseArgs({
    allowPositionals: true,
    options: {
      operator: { type: "string" },
      reason: { type: "string" },
      version: { type: "string" },
      checkpoint: { type: "string" },
      out: { type: "string" },
      file: { type: "string" },
      "confirm-target": { type: "string" },
      "restore-report": { type: "string" },
      mode: { type: "string" },
      approve: { type: "string" },
      "training-confirmed": { type: "boolean" },
      "source-freeze-confirmed": { type: "boolean" },
    },
  });
  const action = positionals[0];
  if (
    ![
      "status",
      "freeze",
      "resume",
      "checkpoint",
      "plan",
      "activate",
      "backup",
      "restore",
      "delta",
    ].includes(action)
  )
    fail(400, "OPS_COMMAND_INVALID");
  const config = loadConfig();
  if (action === "restore") {
    if (
      !v.file ||
      !v.out ||
      !process.env.RESTORE_DATABASE_URL ||
      !v["confirm-target"]
    )
      fail(400, "RESTORE_INPUT_REQUIRED");
    console.log(
      JSON.stringify(
        await restoreDatabase(
          config,
          v.file,
          process.env.RESTORE_DATABASE_URL,
          v["confirm-target"],
          v.out,
        ),
      ),
    );
    return;
  }
  const db = new Database(config.databaseUrl);
  try {
    const result = await db.tx(async (c) => {
      const ctx = await operatorContext(
        c,
        config,
        parse(text(254), v.operator),
      );
      if (action === "status")
        return {
          guard: (await one(
            c,
            sql`SELECT version,frozen,reason,changed_at FROM station_write_guards WHERE station_id=${ctx.station.id}`,
          )) || { version: 0, frozen: false },
          checkpoint: await one(
            c,
            sql`SELECT id,fingerprint,created_at FROM ops_checkpoints WHERE station_id=${ctx.station.id} ORDER BY created_at DESC,id DESC LIMIT 1`,
          ),
        };
      if (action === "freeze" || action === "resume") {
        if (!/^\d+$/.test(v.version || "")) fail(400, "GUARD_VERSION_REQUIRED");
        return freezeStation(
          c,
          ctx,
          action === "freeze",
          Number(v.version),
          parse(text(400), v.reason),
        );
      }
      if (action === "checkpoint")
        return checkpoint(c, ctx, parse(text(400), v.reason));
      const id = parse(uuid, v.checkpoint);
      if (action === "backup") return { checkpointId: id };
      if (action === "delta") {
        if (
          !(
            await one(
              c,
              sql`SELECT frozen FROM station_write_guards WHERE station_id=${ctx.station.id}`,
            )
          )?.frozen
        )
          fail(409, "FREEZE_REQUIRED");
        const change = await checkpointChanges(c, ctx, id),
          data: Record<string, unknown[]> = {};
        let size = 0;
        for (const name of change.changedTables) {
          const table = sql.identifier(name),
            records = await rows(
              c,
              sql`SELECT to_jsonb(t) AS data FROM ${table} t LIMIT 10001`,
            );
          if (records.length > 10000) fail(413, "DELTA_REQUIRES_FULL_BACKUP");
          data[name] = records.map((r) => r.data);
          size += Buffer.byteLength(JSON.stringify(data[name]));
          if (size > 20 * 1024 * 1024) fail(413, "DELTA_REQUIRES_FULL_BACKUP");
        }
        if (!v.out) fail(400, "OUTPUT_PATH_REQUIRED");
        await privateJson(
          v.out,
          signedDocument(
            {
              kind: "DPAUTO_DELTA_V1",
              checkpointId: id,
              createdAt: config.now().toISOString(),
              rollback: change.rollback,
              before: change.checkpoint.snapshot,
              current: change.current.tables,
              changedTables: change.changedTables,
              data,
            },
            config.secret,
          ),
        );
        return {
          rollback: change.rollback,
          changedTables: change.changedTables,
          path: v.out,
        };
      }
      const mode =
        v.mode === "FULL"
          ? "FULL"
          : v.mode === "NEW_BUSINESS"
            ? "NEW_BUSINESS"
            : fail(400, "CUTOVER_MODE_REQUIRED");
      if (action === "plan") return cutoverPlan(c, ctx, id, mode);
      if (!v["restore-report"]) fail(400, "RESTORE_PROOF_REQUIRED");
      return activateCutover(c, ctx, config, {
        checkpointId: id,
        mode,
        approval: parse(text(64), v.approve),
        restore: await readProof(v["restore-report"], config.secret),
        reason: parse(text(400), v.reason),
        trainingConfirmed: !!v["training-confirmed"],
        sourceFreezeConfirmed: !!v["source-freeze-confirmed"],
      });
    });
    if (action === "backup") {
      if (!v.out) fail(400, "OUTPUT_PATH_REQUIRED");
      console.log(
        JSON.stringify(
          await backupDatabase(db, config, parse(uuid, v.checkpoint), v.out),
        ),
      );
    } else console.log(JSON.stringify(result));
  } finally {
    await db.close();
  }
}
main().catch((e) => {
  console.error(
    e && typeof e === "object" && "code" in e
      ? String(e.code)
      : e instanceof Error && e.message.startsWith("POSTGRES_TOOL_")
        ? e.message
        : "OPS_COMMAND_FAILED",
  );
  process.exitCode = 1;
});
