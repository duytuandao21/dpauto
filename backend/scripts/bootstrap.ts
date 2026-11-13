import { z } from "zod";
import { Database, sql, one } from "../src/database";
import { loadConfig, type Config } from "../src/config";
import { hashPassword, writeCredential } from "../src/auth";
import {
  parse,
  text,
  phone,
  password,
  fail,
  audit,
  type Context,
} from "../src/common";

const bootstrapInput = z.strictObject({
  name: text(100),
  email: z.email().transform((s) => s.toLowerCase()),
  password,
  phone,
  stationName: text(120),
  address: text(250),
  directionsUrl: z.url().refine((s) => s.startsWith("https://")),
});
export async function bootstrap(db: Database, config: Config, raw: unknown) {
  const input = parse(bootstrapInput, raw),
    credential = await hashPassword(input.password);
  return db.tx(async (c) => {
    await c.execute(sql`SELECT pg_advisory_xact_lock(73301002)`);
    if (
      await one(
        c,
        sql`SELECT user_id FROM user_permission_grants WHERE permission_code='roles.manage' LIMIT 1`,
      )
    )
      fail(409, "ALREADY_BOOTSTRAPPED");
    let station = await one(
      c,
      sql`SELECT * FROM stations WHERE code=${config.stationCode} FOR UPDATE`,
    );
    if (!station)
      station = await one(
        c,
        sql`INSERT INTO stations(code,name,phone,address,directions_url,privacy_notice_version,booking_enabled) VALUES(${config.stationCode},${input.stationName},${input.phone},${input.address},${input.directionsUrl},'BOOKING_V1',true) RETURNING *`,
      );
    const user = await one(
      c,
      sql`INSERT INTO users(email_normalized,status,must_change_password) VALUES(${input.email},'ACTIVE',true) RETURNING *`,
    );
    await writeCredential(c, user!.id, credential);
    const staff = await one(
      c,
      sql`INSERT INTO staff_profiles(station_id,user_id,name,phone_normalized,email,job_role) VALUES(${station!.id},${user!.id},${input.name},${input.phone},${input.email},'MANAGER') RETURNING id`,
    );
    await c.execute(
      sql`INSERT INTO user_roles(user_id,role_code) VALUES(${user!.id},'MANAGER')`,
    );
    await c.execute(
      sql`INSERT INTO user_permission_grants(user_id,permission_code) VALUES(${user!.id},'roles.manage'),(${user!.id},'staff.manage')`,
    );
    const ctx: Context = {
      station: station!,
      now: config.now(),
      ip: "offline",
      requestId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
    };
    await audit(c, ctx, "OFFLINE_AUTHORITY_BOOTSTRAPPED", "user", user!.id);
    return { userId: user!.id, staffId: staff!.id, stationId: station!.id };
  });
}
if (require.main === module) {
  const config = loadConfig(),
    db = new Database(config.databaseUrl);
  bootstrap(db, config, {
    name: process.env.BOOTSTRAP_NAME,
    email: process.env.BOOTSTRAP_EMAIL,
    password: process.env.BOOTSTRAP_PASSWORD,
    phone: process.env.STATION_PHONE,
    stationName: process.env.STATION_NAME,
    address: process.env.STATION_ADDRESS,
    directionsUrl: process.env.STATION_DIRECTIONS_URL,
  })
    .then(() =>
      console.log(
        "First manager created. Change the temporary password on first login.",
      ),
    )
    .catch(() => {
      console.error(
        "Bootstrap failed. Check required inputs or existing authority.",
      );
      process.exitCode = 1;
    })
    .finally(() => db.close());
}
