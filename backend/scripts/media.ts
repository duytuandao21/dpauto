import { parseArgs } from "node:util";
import { randomUUID } from "node:crypto";
import { loadConfig } from "../src/config";
import { Database, sql, rows, one, json } from "../src/database";
import { mediaStore } from "../src/media-store";
import { purgeAsset } from "../src/cms";
import { processImage } from "../src/image-pipeline";

const usage = `Usage:
  npm run media -- check              upload, read back and delete a test file
  npm run media -- migrate [--dry-run] move images stored in Postgres to MEDIA_DRIVER storage
  npm run media -- purge [--days 30]   permanently remove images that stayed in the trash`;

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      "dry-run": { type: "boolean" },
      days: { type: "string", default: "30" },
    },
  });
  const config = loadConfig(),
    store = mediaStore(config.media),
    action = positionals[0];
  if (action === "check") {
    const key = `media/_check/${randomUUID()}.txt`,
      body = Buffer.from("dpauto media check");
    await store.put("public", key, body, "text/plain");
    await store.put("originals", key, body, "text/plain");
    if (!(await store.get("originals", key)).equals(body))
      throw Error("Private bucket returned different bytes");
    const url = store.url(key);
    if (/^https?:\/\//.test(url)) {
      const r = await fetch(url);
      if (!r.ok) throw Error(`Public URL answered ${r.status}: ${url}`);
      console.log("Public URL OK:", url);
    } else console.log("Public URL is relative (local driver):", url);
    await store.removePrefix("public", "media/_check/");
    await store.removePrefix("originals", "media/_check/");
    console.log(`Media storage OK (driver: ${store.driver}).`);
    return;
  }
  const db = new Database(config.databaseUrl);
  try {
    if (action === "migrate") {
      if (store.driver === "local" && config.production)
        throw Error("Refusing to migrate production images to local disk.");
      const legacy = await rows(
        db.db,
        sql`SELECT id,content FROM cms_assets WHERE storage='db' AND purged_at IS NULL ORDER BY created_at,id`,
      );
      let moved = 0,
        failed = 0;
      for (const a of legacy) {
        try {
          const { files, ...p } = await processImage(a.content as Buffer);
          if (values["dry-run"]) {
            console.log(`would move ${a.id} (${p.width}×${p.height})`);
            continue;
          }
          await Promise.all(
            files.map((f) => store.put(f.bucket, f.key, f.body, f.type)),
          );
          const done = await one(
            db.db,
            sql`UPDATE cms_assets SET storage=${store.driver},content=NULL,sha256=${p.sha256},width=${p.width},height=${p.height},mime=${p.mime},bytes=${p.bytes},original_key=${p.originalKey},variants=${json(p.variants)},og_key=${p.ogKey},placeholder=${p.placeholder} WHERE id=${a.id} AND storage='db' RETURNING id`,
          );
          if (done) moved++;
        } catch (e) {
          failed++;
          console.error(
            `failed ${a.id}: ${e instanceof Error ? e.message : e}`,
          );
        }
      }
      console.log(
        `${values["dry-run"] ? "Dry run: " : ""}${legacy.length} legacy image(s), moved ${moved}, failed ${failed}.`,
      );
      if (failed) process.exitCode = 1;
      return;
    }
    if (action === "purge") {
      const days = Number(values.days);
      if (!Number.isInteger(days) || days < 1)
        throw Error("--days must be ≥ 1");
      const before = new Date(Date.now() - days * 86400000);
      const due = await rows(
        db.db,
        sql`SELECT id,station_id,sha256,storage FROM cms_assets WHERE deleted_at < ${before} AND purged_at IS NULL ORDER BY deleted_at`,
      );
      for (const a of due) await purgeAsset(db.db, store, a as never);
      console.log(
        `Purged ${due.length} image(s) deleted before ${before.toISOString()}.`,
      );
      return;
    }
    console.log(usage);
    process.exitCode = 1;
  } finally {
    await db.close();
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
