import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql, type SQL } from "drizzle-orm";

export { sql };
export type Conn = Pick<NodePgDatabase, "execute">;
// SQL projections differ per module; serializers explicitly whitelist each public field.
export type Row = Record<string, any>;
export async function rows<T = Row>(c: Conn, q: SQL): Promise<T[]> {
  const result = await c.execute(q);
  // Drizzle raw queries preserve timestamptz strings; domain calculations use Date values.
  const timestamps = result.fields
    .filter((f) => f.dataTypeID === 1184)
    .map((f) => f.name);
  return result.rows.map((raw) => {
    const row = { ...raw };
    for (const key of timestamps)
      if (row[key] !== null) row[key] = new Date(row[key] as string);
    return row;
  }) as T[];
}
export async function one<T = Row>(c: Conn, q: SQL): Promise<T | undefined> {
  return (await rows<T>(c, q))[0];
}
export class Database {
  readonly pool: Pool;
  readonly db: NodePgDatabase;
  constructor(url: string) {
    this.pool = new Pool({
      connectionString: url,
      max: 10,
      connectionTimeoutMillis: 5000,
    });
    this.db = drizzle(this.pool);
  }
  async tx<T>(fn: (c: Conn) => Promise<T>, read = false): Promise<T> {
    return this.db.transaction(
      async (c) => {
        await c.execute(sql`SET LOCAL lock_timeout='3s'`);
        await c.execute(sql`SET LOCAL statement_timeout='15s'`);
        return fn(c);
      },
      read
        ? { isolationLevel: "repeatable read", accessMode: "read only" }
        : undefined,
    );
  }
  close() {
    return this.pool.end();
  }
}
export function json(value: unknown) {
  return sql`${JSON.stringify(value)}::jsonb`;
}
export function ids(values: string[]) {
  return sql`ARRAY[${sql.join(
    values.map((v) => sql`${v}::uuid`),
    sql`, `,
  )}]::uuid[]`;
}
