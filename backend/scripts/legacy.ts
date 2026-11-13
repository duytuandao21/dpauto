import { parseArgs } from "node:util";
import { Api } from "../src/api";
import { loadConfig } from "../src/config";
import { Database } from "../src/database";
import { fail, parse, text, uuid } from "../src/common";
import { operatorContext } from "../src/ops-control";
import { emptyTotals, readLegacyFile } from "../src/legacy-file";
import { recordTypes } from "../src/legacy-contracts";
import { privateJson } from "../src/backup";

async function main() {
  const { positionals, values: v } = parseArgs({
    allowPositionals: true,
    options: {
      file: { type: "string" },
      out: { type: "string" },
      operator: { type: "string" },
      batch: { type: "string" },
      record: { type: "string" },
      decision: { type: "string" },
      target: { type: "string" },
      "live-type": { type: "string" },
      "live-id": { type: "string" },
      version: { type: "string" },
      reason: { type: "string" },
      approve: { type: "string" },
      "allow-duplicate": { type: "boolean" },
      "ack-source-change": { type: "boolean" },
      "station-code": { type: "string" },
    },
  });
  const action = positionals[0];
  if (action === "template") {
    if (!v.out) fail(400, "OUTPUT_PATH_REQUIRED");
    const now = new Date().toISOString();
    await privateJson(v.out, {
      format: "DPAUTO_LEGACY_V1",
      stationCode: v["station-code"] || "TOAN_TRUNG",
      sourceSystem: "CRM_OLD",
      scopeMode: "REFERENCE_ONLY",
      exportedAt: now,
      cutoffAt: now,
      expected: {
        counts: Object.fromEntries(recordTypes.map((t) => [t, 0])),
        totals: emptyTotals(),
      },
      records: [],
    });
    console.log("Đã tạo khung JSON trống. Đây không phải dữ liệu xuất từ CRM.");
    return;
  }
  if (action === "inspect") {
    if (!v.file) fail(400, "SOURCE_FILE_REQUIRED");
    const r = await readLegacyFile(v.file);
    const report = { sha256: r.fileSha256, ...r.report };
    if (v.out) await privateJson(v.out, report);
    console.log(
      JSON.stringify({
        sha256: r.fileSha256,
        valid: r.report.valid,
        counts: r.report.counts,
        errors: r.report.errors.slice(0, 20),
      }),
    );
    if (!r.report.valid) process.exitCode = 1;
    return;
  }
  if (!["stage", "plan", "review", "apply", "abandon"].includes(action))
    fail(400, "LEGACY_COMMAND_INVALID");
  const config = loadConfig(),
    db = new Database(config.databaseUrl);
  try {
    const input =
      action === "stage" && v.file ? await readLegacyFile(v.file) : null;
    const result = await db.tx(async (c) => {
      const ctx = await operatorContext(
          c,
          config,
          parse(text(254), v.operator),
        ),
        legacy = new Api(db, config).legacy;
      if (action === "stage") {
        if (!input) fail(400, "SOURCE_FILE_REQUIRED");
        return legacy.stage(c, ctx, input);
      }
      const id = parse(uuid, v.batch);
      if (action === "abandon")
        return legacy.abandon(
          c,
          ctx,
          id,
          Number(v.version),
          parse(text(400), v.reason),
        );
      if (action === "plan") return legacy.plan(c, ctx, id, !!v.out);
      if (action === "review")
        return legacy.review(c, ctx, id, parse(uuid, v.record), {
          expectedVersion: Number(v.version),
          decision: v.decision,
          targetId: v.target,
          liveType: v["live-type"],
          liveId: v["live-id"],
          allowDuplicate: !!v["allow-duplicate"],
          ackSourceChange: !!v["ack-source-change"],
          reason: v.reason,
        });
      return legacy.apply(c, ctx, id, parse(text(64), v.approve));
    });
    if (v.out) await privateJson(v.out, result);
    const { records, ...summary } = result as Record<string, unknown>;
    console.log(JSON.stringify(summary));
  } finally {
    await db.close();
  }
}
main().catch((e) => {
  console.error(
    e && typeof e === "object" && "code" in e
      ? String(e.code)
      : "LEGACY_COMMAND_FAILED",
  );
  process.exitCode = 1;
});
