import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { loadConfig } from "../src/config";
import { Database, sql, one, rows } from "../src/database";
import { parse, fail, type Context } from "../src/common";
import { policyInput, serviceCreate } from "../src/contracts";
import { Capacity } from "../src/capacity/capacity";
import { assertStationWritable } from "../src/ops-control";
import { Catalog } from "../src/catalog";
import { permissionBundle } from "../src/auth";

async function main() {
  if (!process.argv[2])
    throw Error("Pass the station configuration JSON path.");
  const input = JSON.parse(await readFile(process.argv[2], "utf8")),
    config = loadConfig(),
    db = new Database(config.databaseUrl);
  try {
    await db.tx(async (c) => {
      const station = await one(
        c,
        sql`SELECT * FROM stations WHERE code=${config.stationCode} FOR UPDATE`,
      );
      const user = await one(
        c,
        sql`SELECT u.*,s.id AS staff_id,s.name,s.job_role FROM users u JOIN staff_profiles s ON s.user_id=u.id JOIN user_roles r ON r.user_id=u.id WHERE u.email_normalized=${process.env.BOOTSTRAP_EMAIL || ""} AND r.role_code='MANAGER' AND u.status='ACTIVE' AND s.active AND s.station_id=${station?.id || null}`,
      );
      if (!station || !user) fail(403, "FORBIDDEN");
      await assertStationWritable(c, station.id);
      const grants = await rows(
        c,
        sql`SELECT permission_code FROM user_permission_grants WHERE user_id=${user.id}`,
      );
      if (!grants.some((g) => g.permission_code === "roles.manage"))
        fail(403, "FORBIDDEN");
      const ctx: Context = {
        station,
        now: config.now(),
        ip: "offline",
        requestId: randomUUID(),
        correlationId: randomUUID(),
        actor: {
          userId: user.id,
          staffId: user.staff_id,
          stationId: station.id,
          authVersion: user.auth_version,
          role: "MANAGER",
          permissions: [
            ...permissionBundle("MANAGER"),
            ...grants.map((g) => g.permission_code),
          ],
          name: user.name,
          email: user.email_normalized,
          jobRole: user.job_role,
          mustChange: user.must_change_password,
        },
      };
      const capacity = new Capacity(config),
        catalog = new Catalog(config);
      const policy = parse(policyInput, {
        ...input.policy,
        expectedVersion: station.configuration_version,
        bookingEnabled: false,
      });
      await capacity.writePolicy(c, ctx, policy);
      ctx.station = (await one(
        c,
        sql`SELECT * FROM stations WHERE id=${station.id}`,
      ))!;
      for (const raw of input.services || []) {
        const service = parse(serviceCreate, raw);
        await catalog.write(c, ctx, service);
        ctx.station = (await one(
          c,
          sql`SELECT * FROM stations WHERE id=${station.id}`,
        ))!;
      }
      if (input.policy.bookingEnabled === true)
        await capacity.writePolicy(c, ctx, {
          ...policy,
          expectedVersion: ctx.station.configuration_version,
          bookingEnabled: true,
        });
    });
    console.log("Station configuration committed.");
  } finally {
    await db.close();
  }
}
main().catch(() => {
  console.error(
    "Configuration failed; no partial changes committed. Check JSON, booking settings and existing bookings.",
  );
  process.exitCode = 1;
});
