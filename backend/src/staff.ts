import { randomUUID } from "node:crypto";
import { sql, rows, one, type Conn, type Row } from "./database";
import {
  page,
  fail,
  permission,
  expectVersion,
  audit,
  type Context,
} from "./common";
import type { Config } from "./config";
import { hashPassword, writeCredential } from "./auth";

export class Staff {
  constructor(readonly config: Config) {}
  async list(c: Conn, ctx: Context, q: Row) {
    const key = q.sort === "createdAt:desc" ? sql`s.created_at` : sql`s.name`;
    const result = await page(
      c,
      this.config,
      ctx,
      sql`SELECT s.*,${key} AS cursor_key,
      (SELECT count(*)::int FROM bookings b WHERE b.assigned_advisor_id=s.id AND b.status='PENDING') AS pending,
      (SELECT count(*)::int FROM bookings b WHERE b.assigned_advisor_id=s.id AND b.status='CONFIRMED') AS confirmed
      FROM staff_profiles s WHERE s.station_id=${ctx.station.id} ${ctx.actor!.role === "ADVISOR" && !(q.jobRole === "TECHNICIAN" && q.active === true) ? sql`AND s.id=${ctx.actor!.staffId}` : sql``}
      ${q.q ? sql`AND (lower(s.name) LIKE ${"%" + q.q.toLowerCase() + "%"} OR s.phone_normalized LIKE ${"%" + q.q + "%"})` : sql``}
      ${q.jobRole ? sql`AND s.job_role=${q.jobRole}` : sql``} ${q.active !== undefined ? sql`AND s.active=${q.active}` : sql``}`,
      q,
      q.sort,
      q.sort.endsWith("desc"),
    );
    const data = [];
    for (const s of result.items) {
      if (ctx.actor!.role === "ADVISOR") {
        data.push({
          id: s.id,
          name: s.name,
          jobRole: s.job_role,
          active: s.active,
          version: s.version,
        });
        continue;
      }
      const view: Row = {
        id: s.id,
        name: s.name,
        jobRole: s.job_role,
        active: s.active,
        phone: s.phone_normalized,
        email: s.email,
        version: s.version,
        accountEnabled: !!s.user_id,
        workload: { pending: s.pending, confirmed: s.confirmed },
        shiftsAvailable: false,
      };
      if (s.user_id && ctx.actor!.permissions.includes("roles.manage")) {
        const u = await one(
          c,
          sql`SELECT u.id,u.email_normalized,u.status,u.must_change_password,r.role_code FROM users u JOIN user_roles r ON r.user_id=u.id WHERE u.id=${s.user_id}`,
        );
        const grants = await rows(
          c,
          sql`SELECT permission_code FROM user_permission_grants WHERE user_id=${s.user_id}`,
        );
        view.account = {
          userId: u!.id,
          email: u!.email_normalized,
          status: u!.status,
          role: u!.role_code,
          permissions: grants.map((g) => g.permission_code),
          mustChangePassword: u!.must_change_password,
        };
      }
      data.push(view);
    }
    return {
      data,
      page: result.page,
      extra: {
        jobRoleOptions: [
          { code: "MANAGER", name: "Quản lý" },
          { code: "ADVISOR", name: "Cố vấn" },
          { code: "TECHNICIAN", name: "Kỹ thuật viên" },
        ],
      },
    };
  }
  async prepare(input: Row) {
    const password =
      input.temporaryPassword ||
      input.account?.temporaryPassword ||
      input.account?.enable?.temporaryPassword;
    return password ? hashPassword(password) : undefined;
  }
  async guardOffboard(c: Conn, ctx: Context, staffId: string) {
    if (
      await one(
        c,
        sql`SELECT id FROM staff_shifts WHERE staff_id=${staffId} AND kind='WORK' AND canceled_at IS NULL AND ends_at>${ctx.now} LIMIT 1`,
      )
    )
      fail(409, "FUTURE_SHIFTS_REMAIN");
    if (
      await one(
        c,
        sql`SELECT a.id FROM work_item_assignments a JOIN work_items i ON i.id=a.work_item_id JOIN work_orders w ON w.id=i.work_order_id JOIN service_visits v ON v.id=w.visit_id WHERE a.technician_id=${staffId} AND a.ended_at IS NULL AND i.status NOT IN ('DONE','SKIPPED') AND v.deleted_at IS NULL AND v.stage NOT IN ('HANDED_OVER','COMPLETED','ABORTED') LIMIT 1`,
      )
    )
      fail(409, "WORK_ASSIGNMENTS_REMAIN");
    if (
      await one(
        c,
        sql`SELECT id FROM service_visits WHERE assigned_advisor_id=${staffId} AND station_id=${ctx.station.id} AND deleted_at IS NULL AND stage NOT IN ('HANDED_OVER','COMPLETED','ABORTED') LIMIT 1`,
      )
    )
      fail(409, "ASSIGNMENTS_REMAIN");
    if (
      await one(
        c,
        sql`SELECT id FROM bookings WHERE assigned_advisor_id=${staffId} AND station_id=${ctx.station.id} AND status IN ('PENDING','CONFIRMED') LIMIT 1`,
      )
    )
      fail(409, "ASSIGNMENTS_REMAIN");

  }
  async lastAuthority(c: Conn, userId: string, losing: boolean) {
    if (!losing) return;
    const has = await one(
      c,
      sql`SELECT 1 FROM user_permission_grants WHERE user_id=${userId} AND permission_code='roles.manage'`,
    );
    if (!has) return;
    const others = await one(
      c,
      sql`SELECT count(*)::int AS n FROM user_permission_grants g JOIN users u ON u.id=g.user_id JOIN staff_profiles s ON s.user_id=u.id JOIN user_roles r ON r.user_id=u.id WHERE g.permission_code='roles.manage' AND r.role_code='MANAGER' AND u.status='ACTIVE' AND s.active AND u.id<>${userId}`,
    );
    if (!others!.n) fail(409, "LAST_ADMIN_REQUIRED");
  }
  async createAccount(
    c: Conn,
    ctx: Context,
    input: Row,
    next: Awaited<ReturnType<typeof hashPassword>>,
  ) {
    permission(ctx, "roles.manage");
    if (
      input.permissions?.some(
        (p: string) =>
          input.role === "ADVISOR" ||
          (input.role === "CMS_ADMIN" && !p.startsWith("cms.")),
      )
    )
      fail(422, "ACCOUNT_INPUT_INVALID");
    const u = await one(
      c,
      sql`INSERT INTO users(email_normalized,status) VALUES(${input.email},'ACTIVE') RETURNING *`,
    );
    await writeCredential(c, u!.id, next);
    await c.execute(
      sql`INSERT INTO user_roles(user_id,role_code,granted_by) VALUES(${u!.id},${input.role},${ctx.actor!.userId})`,
    );
    for (const grant of input.permissions || [])
      await c.execute(
        sql`INSERT INTO user_permission_grants(user_id,permission_code,granted_by) VALUES(${u!.id},${grant},${ctx.actor!.userId})`,
      );
    return u!.id;
  }
  async create(
    c: Conn,
    ctx: Context,
    input: Row,
    next?: Awaited<ReturnType<typeof hashPassword>>,
  ) {
    const userId = input.account
      ? await this.createAccount(c, ctx, input.account, next!)
      : null;
    const s = await one(
      c,
      sql`INSERT INTO staff_profiles(station_id,user_id,name,phone_normalized,email,job_role,active) VALUES(${ctx.station.id},${userId},${input.name},${input.phone},${input.email},${input.jobRole},${input.active}) RETURNING *`,
    );
    await audit(c, ctx, "STAFF_CREATED", "staff", s!.id);
    return { id: s!.id, version: 1, eventId: randomUUID() };
  }
  async patch(
    c: Conn,
    ctx: Context,
    id: string,
    input: Row,
    next?: Awaited<ReturnType<typeof hashPassword>>,
  ) {
    const s = await one(
      c,
      sql`SELECT * FROM staff_profiles WHERE id=${id} AND station_id=${ctx.station.id} FOR UPDATE`,
    );
    if (!s) fail(404, "NOT_FOUND");
    expectVersion(s, input.expectedVersion);
    let userId = s.user_id;
    const ac = input.account;
    if (ac) permission(ctx, "roles.manage");
    if (
      input.active === false ||
      ac?.status === "DISABLED" ||
      (ac?.role && ac.role !== "ADVISOR") ||
      (input.jobRole && input.jobRole !== "ADVISOR" && s.job_role === "ADVISOR")
    )
      await this.guardOffboard(c, ctx, id);
    if (input.active === false && userId)
      await this.lastAuthority(c, userId, true);
    if (ac?.enable) {
      if (userId) fail(409, "ACCOUNT_EXISTS");
      userId = await this.createAccount(c, ctx, ac.enable, next!);
    } else if (ac) {
      if (!userId) fail(422, "ACCOUNT_NOT_ENABLED");
      const oldRole = await one(
        c,
        sql`SELECT role_code FROM user_roles WHERE user_id=${userId}`,
      );
      const targetRole = ac.role || oldRole!.role_code;
      if (
        ac.permissions?.some(
          (p: string) =>
            targetRole === "ADVISOR" ||
            (targetRole === "CMS_ADMIN" && !p.startsWith("cms.")),
        )
      )
        fail(422, "ACCOUNT_INPUT_INVALID");
      await this.lastAuthority(
        c,
        userId,
        ac.status === "DISABLED" ||
          targetRole !== "MANAGER" ||
          (ac.permissions !== undefined &&
            !ac.permissions.includes("roles.manage")),
      );
      if (ac.role)
        await c.execute(
          sql`UPDATE user_roles SET role_code=${ac.role},granted_by=${ctx.actor!.userId},granted_at=${ctx.now} WHERE user_id=${userId}`,
        );
      if (ac.permissions !== undefined || targetRole !== oldRole!.role_code) {
        await c.execute(
          sql`DELETE FROM user_permission_grants WHERE user_id=${userId}`,
        );
        for (const grant of targetRole === "ADVISOR"
          ? []
          : ac.permissions || [])
          await c.execute(
            sql`INSERT INTO user_permission_grants(user_id,permission_code,granted_by) VALUES(${userId},${grant},${ctx.actor!.userId})`,
          );
      }
      await c.execute(
        sql`UPDATE users SET status=COALESCE(${ac.status || null},status),auth_version=auth_version+1,version=version+1 WHERE id=${userId}`,
      );
    }
    await c.execute(
      sql`UPDATE staff_profiles SET name=${input.name ?? s.name},phone_normalized=${input.phone ?? s.phone_normalized},email=${input.email ?? s.email},job_role=${input.jobRole ?? s.job_role},active=${input.active ?? s.active},user_id=${userId},version=version+1,updated_at=${ctx.now} WHERE id=${id}`,
    );
    if (userId && (ac || input.active !== undefined)) {
      await c.execute(
        sql`UPDATE users SET auth_version=auth_version+1 WHERE id=${userId}`,
      );
      await c.execute(
        sql`UPDATE sessions SET revoked_at=${ctx.now} WHERE user_id=${userId} AND revoked_at IS NULL`,
      );
    }
    await audit(c, ctx, "STAFF_UPDATED", "staff", id, input.reason);
    return { id, version: s.version + 1, eventId: randomUUID() };
  }
  async reset(
    c: Conn,
    ctx: Context,
    id: string,
    input: Row,
    next: Awaited<ReturnType<typeof hashPassword>>,
  ) {
    const s = await one(
      c,
      sql`SELECT * FROM staff_profiles WHERE id=${id} AND station_id=${ctx.station.id}`,
    );
    if (!s) fail(404, "NOT_FOUND");
    expectVersion(s, input.expectedVersion);
    if (!s.user_id) fail(422, "ACCOUNT_NOT_ENABLED");
    if (s.user_id === ctx.actor!.userId) fail(403, "FORBIDDEN");
    await c.execute(sql`SELECT id FROM users WHERE id=${s.user_id} FOR UPDATE`);
    await writeCredential(c, s.user_id, next);
    await c.execute(
      sql`UPDATE users SET must_change_password=true,auth_version=auth_version+1,version=version+1 WHERE id=${s.user_id}`,
    );
    await c.execute(
      sql`UPDATE sessions SET revoked_at=${ctx.now} WHERE user_id=${s.user_id} AND revoked_at IS NULL`,
    );
    await c.execute(
      sql`UPDATE staff_profiles SET version=version+1 WHERE id=${id}`,
    );
    await audit(c, ctx, "PASSWORD_RESET", "staff", id, input.reason);
    return { id, version: s.version + 1, eventId: randomUUID() };
  }
}
