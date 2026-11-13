import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { hash } from "./common";
import { rows, sql, type Conn } from "./database";
let expected: Promise<Map<string, string>> | undefined;
export async function schemaCompatible(c: Conn) {
  expected ??= (async () => {
    const dir = resolve(__dirname, "../migrations"),
      result = new Map<string, string>();
    for (const name of (await readdir(dir))
      .filter((n) => n.endsWith(".sql"))
      .sort())
      result.set(name, hash(await readFile(resolve(dir, name), "utf8")));
    return result;
  })();
  const want = await expected,
    actual = await rows(c, sql`SELECT name,checksum FROM dpauto_migrations`);
  return (
    actual.length === want.size &&
    actual.every((r) => want.get(r.name) === r.checksum)
  );
}
