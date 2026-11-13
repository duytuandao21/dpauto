import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { Pool } from "pg";

export async function migrate(url: string) {
  const pool = new Pool({ connectionString: url, max: 1 });
  const c = await pool.connect();
  try {
    await c.query("SELECT pg_advisory_lock(73301001)");
    await c.query(
      "CREATE TABLE IF NOT EXISTS dpauto_migrations(name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const folder = resolve(__dirname, "../migrations");
    for (const name of (await readdir(folder))
      .filter((n) => n.endsWith(".sql"))
      .sort()) {
      const text = await readFile(resolve(folder, name), "utf8"),
        checksum = createHash("sha256").update(text).digest("hex");
      const previous = (
        await c.query("SELECT checksum FROM dpauto_migrations WHERE name=$1", [
          name,
        ])
      ).rows[0];
      if (previous) {
        if (previous.checksum !== checksum)
          throw new Error("Applied migration checksum changed: " + name);
        continue;
      }
      await c.query("BEGIN");
      try {
        await c.query(text);
        await c.query(
          "INSERT INTO dpauto_migrations(name,checksum) VALUES($1,$2)",
          [name, checksum],
        );
        await c.query("COMMIT");
      } catch (e) {
        await c.query("ROLLBACK");
        throw e;
      }
      console.log("Applied " + name);
    }
  } finally {
    await c.query("SELECT pg_advisory_unlock(73301001)").catch(() => {});
    c.release();
    await pool.end();
  }
}
if (require.main === module)
  migrate(process.env.DATABASE_URL || "").catch(() => {
    console.error(
      "Migration failed; check database access and migration constraints.",
    );
    process.exitCode = 1;
  });
