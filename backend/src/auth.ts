import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Config } from "./config";
import {
  Database,
  sql,
  one,
  rows,
  type Conn,
  type Row,
  json,
} from "./database";
import {
  fail,
  hash,
  equal,
  mac,
  iso,
  audit,
  type Actor,
  type Context,
} from "./common";

const params = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
let running = false;
const queue: (() => void)[] = [];
async function scrypt(password: string, salt: string) {
  if (running) {
    if (queue.length >= 8) fail(503, "AUTH_BUSY");
    await new Promise<void>((resolve) => queue.push(resolve));
  }
  running = true;
  try {
    return (
      await new Promise<Buffer>((resolve, reject) =>
        scryptCallback(
          password,
          Buffer.from(salt, "hex"),
          64,
          params,
          (error, key) => (error ? reject(error) : resolve(key)),
        ),
      )
    ).toString("hex");
  } finally {
    const next = queue.shift();
    if (next) next();
    else running = false;
  }
}
export async function hashPassword(password: string) {
  const salt = randomBytes(32).toString("hex");
  return { salt, hash: await scrypt(password, salt) };
}
async function verify(password: string, credential?: Row) {
  const digest = await scrypt(
    password,
    credential?.password_salt || "00".repeat(32),
  );
  return (
    !!credential &&
    credential.algorithm === "scrypt-v1" &&
    equal(digest, credential.password_hash)
  );
}
export const permissionBundle = (role: string): string[] =>
  role === "CMS_ADMIN"
    ? ["cms.read"]
    : role === "MANAGER"
      ? [
          "booking.create",
          "bookings.read.station",
          "booking.update",
          "booking.confirm",
          "booking.reschedule",
          "booking.cancel",
          "booking.no_show",
          "booking.contact",
          "booking.assign",
          "catalog.read",
          "catalog.manage",
          "capacity.read",
          "capacity.manage",
          "station.read",
          "station.manage",
          "audit.read",
          "staff.read",
          "customers.read",
          "visits.read",
          "visits.receive",
          "visits.update",
          "visits.contact",
          "visits.assign",
          "quotes.read",
          "quotes.write",
          "quotes.decide",
          "work.write",
          "work.exempt",
          "acceptance.record",
          "visits.handover",
          "visits.abort",
          "inventory.read",
        ]
      : role === "ADVISOR"
        ? [
            "booking.create",
            "bookings.read.own",
            "booking.update",
            "booking.confirm",
            "booking.reschedule",
            "booking.cancel",
            "booking.no_show",
            "booking.contact",
            "catalog.read",
            "customers.read",
            "visits.read",
            "visits.receive",
            "visits.update",
            "visits.contact",
            "quotes.read",
            "quotes.write",
            "quotes.decide",
            "work.write",
            "acceptance.record",
            "visits.handover",
          ]
        : [];

export class Auth {
  constructor(
    readonly db: Database,
    readonly config: Config,
  ) {}
  async rate(scope: string, subject: string, limit: number, seconds: number) {
    const now = this.config.now(),
      window = new Date(Math.floor(+now / (seconds * 1000)) * seconds * 1000);
    const r = await one(
      this.db.db,
      sql`INSERT INTO rate_limit_buckets(scope,subject_hash,window_start,window_seconds,hits,expires_at)
      VALUES(${scope},${mac(this.config.secret, subject)},${window},${seconds},1,${new Date(+window + (seconds + 60) * 1000)})
      ON CONFLICT(scope,subject_hash,window_start) DO UPDATE SET hits=rate_limit_buckets.hits+1 RETURNING hits`,
    );
    if (r!.hits > limit)
      fail(
        429,
        "RATE_LIMITED",
        "Bạn thao tác quá nhanh. Vui lòng thử lại sau.",
      );
  }
  async session(c: Conn, req: FastifyRequest) {
    const token = req.cookies[this.config.cookie];
    if (!token || token.length > 128) return undefined;
    const now = this.config.now();
    return one(
      c,
      sql`SELECT * FROM sessions WHERE token_hash=${hash(token)} AND revoked_at IS NULL AND expires_at>${now}
      AND (kind='PREAUTH' OR last_seen_at>${new Date(+now - 30 * 60000)})`,
    );
  }
  async actor(c: Conn, session: Row, lock = false): Promise<Actor> {
    if (session.kind !== "AUTH") fail(401, "UNAUTHENTICATED");
    if (lock)
      await c.execute(
        sql`SELECT id FROM users WHERE id=${session.user_id}::uuid FOR UPDATE`,
      );
    const u = await one(
      c,
      sql`SELECT u.id,u.email_normalized,u.auth_version,u.must_change_password,s.id AS staff_id,s.station_id,s.name,s.job_role,r.role_code,
      ARRAY(SELECT permission_code FROM user_permission_grants g WHERE g.user_id=u.id) AS grants
      FROM users u JOIN staff_profiles s ON s.user_id=u.id JOIN user_roles r ON r.user_id=u.id
      WHERE u.id=${session.user_id}::uuid AND u.status='ACTIVE' AND s.active AND u.auth_version=${session.auth_version}`,
    );
    const live = await one(
      c,
      sql`SELECT id FROM sessions WHERE id=${session.id}::uuid AND revoked_at IS NULL AND expires_at>${this.config.now()}`,
    );
    if (!u || !live) fail(401, "UNAUTHENTICATED");
    return {
      userId: u.id,
      staffId: u.staff_id,
      stationId: u.station_id,
      authVersion: u.auth_version,
      role: u.role_code,
      permissions: [
        ...permissionBundle(u.role_code),
        ...(u.role_code === "MANAGER"
          ? u.grants
          : u.role_code === "CMS_ADMIN"
            ? u.grants.filter((p: string) => p.startsWith("cms."))
            : []),
      ],
      name: u.name,
      email: u.email_normalized,
      jobRole: u.job_role,
      mustChange: u.must_change_password,
    };
  }
  csrf(req: FastifyRequest, session?: Row) {
    const origin = req.headers.origin;
    let referer: string | undefined;
    try {
      if (req.headers.referer) referer = new URL(req.headers.referer).origin;
    } catch {}
    if (
      (origin || referer) !== this.config.origin ||
      req.headers["sec-fetch-site"] === "cross-site" ||
      !session ||
      typeof req.headers["x-csrf-token"] !== "string" ||
      !equal(req.headers["x-csrf-token"], session.csrf_token)
    )
      fail(403, "CSRF_INVALID");
  }
  origin(req: FastifyRequest) {
    if (
      req.headers["sec-fetch-site"] === "cross-site" ||
      (req.headers.origin && req.headers.origin !== this.config.origin)
    )
      fail(403, "FORBIDDEN");
  }
  private cookie(reply: FastifyReply, token: string, maxAge: number) {
    reply.setCookie(this.config.cookie, token, {
      path: "/",
      httpOnly: true,
      secure: this.config.production,
      sameSite: "lax",
      maxAge,
    });
  }
  async issue(c: Conn, reply: FastifyReply, user?: Row) {
    const token = randomBytes(32).toString("base64url"),
      csrf = randomBytes(32).toString("base64url"),
      now = this.config.now();
    const expires = new Date(+now + (user ? 12 * 3600000 : 15 * 60000));
    const session = await one(
      c,
      sql`INSERT INTO sessions(user_id,kind,token_hash,csrf_token,auth_version,issued_at,last_seen_at,expires_at)
      VALUES(${user?.id || null},${user ? "AUTH" : "PREAUTH"},${hash(token)},${csrf},${user?.auth_version || null},${now},${now},${expires}) RETURNING *`,
    );
    // Cookie is applied by the caller after its transaction commits.
    return {
      session: session!,
      apply: () => this.cookie(reply, token, user ? 12 * 3600 : 15 * 60),
    };
  }
  async view(c: Conn, session: Row) {
    const a = await this.actor(c, session);
    return {
      user: {
        id: a.userId,
        email: a.email,
        status: "ACTIVE",
        authVersion: a.authVersion,
      },
      staff: {
        id: a.staffId,
        name: a.name,
        jobRole: a.jobRole,
        stationId: a.stationId,
      },
      roles: [a.role],
      permissions: a.mustChange ? ["auth.self"] : a.permissions,
      mustChangePassword: a.mustChange,
      session: {
        expiresAt: iso(session.expires_at),
        idleExpiresAt: iso(
          new Date(
            Math.min(
              +new Date(session.expires_at),
              +new Date(session.last_seen_at) + 30 * 60000,
            ),
          ),
        ),
      },
      csrfToken: session.csrf_token,
    };
  }
  async csrfContext(req: FastifyRequest, reply: FastifyReply) {
    this.origin(req);
    await this.rate("csrf", req.ip, 30, 600);
    let current = await this.session(this.db.db, req);
    if (current?.kind === "AUTH") {
      try {
        await this.actor(this.db.db, current);
      } catch {
        current = undefined;
      }
    }
    if (!current) {
      const issued = await this.issue(this.db.db, reply);
      current = issued.session;
      issued.apply();
    }
    return {
      csrfToken: current.csrf_token,
      context: current.kind,
      expiresAt: iso(current.expires_at),
    };
  }
  async login(
    req: FastifyRequest,
    reply: FastifyReply,
    input: Row,
    ctx: Context,
  ) {
    this.csrf(req, await this.session(this.db.db, req));
    await this.rate("login-ip", req.ip, 20, 900);
    const credential = await one(
      this.db.db,
      sql`SELECT c.*,u.email_normalized FROM user_credentials c JOIN users u ON u.id=c.user_id WHERE u.email_normalized=${input.email}`,
    );
    const valid = await verify(input.password, credential);
    if (!valid) {
      await this.rate("login-account", input.email, 5, 900);
      fail(401, "INVALID_CREDENTIALS", "Thông tin đăng nhập không hợp lệ.");
    }
    const failures = await one(
      this.db.db,
      sql`SELECT COALESCE(SUM(hits),0)::int AS hits FROM rate_limit_buckets WHERE scope='login-account' AND subject_hash=${mac(this.config.secret, input.email)} AND expires_at>${ctx.now}`,
    );
    if (failures!.hits >= 5) fail(429, "RATE_LIMITED");
    const issued = await this.db.tx(async (c) => {
      const u = await one(
        c,
        sql`SELECT u.*,c.version AS credential_version FROM users u JOIN user_credentials c ON c.user_id=u.id WHERE u.id=${credential!.user_id} FOR UPDATE OF u`,
      );
      if (
        !u ||
        u.status !== "ACTIVE" ||
        u.credential_version !== credential!.version
      )
        fail(401, "INVALID_CREDENTIALS");
      const staff = await one(
        c,
        sql`SELECT id FROM staff_profiles WHERE user_id=${u.id} AND active`,
      );
      if (!staff) fail(401, "INVALID_CREDENTIALS");
      const old = await this.session(c, req);
      if (old)
        await c.execute(
          sql`UPDATE sessions SET revoked_at=${ctx.now} WHERE id=${old.id}`,
        );
      await c.execute(
        sql`UPDATE users SET last_login_at=${ctx.now} WHERE id=${u.id}`,
      );
      const result = await this.issue(c, reply, u);
      const a = await this.actor(c, result.session);
      await audit(c, { ...ctx, actor: a }, "AUTH_LOGIN", "user", u.id);
      return result;
    });
    issued.apply();
    return this.view(this.db.db, issued.session);
  }
  async logout(req: FastifyRequest, reply: FastifyReply) {
    const s = await this.session(this.db.db, req);
    if (s) {
      this.csrf(req, s);
      await this.db.db.execute(
        sql`UPDATE sessions SET revoked_at=${this.config.now()} WHERE id=${s.id}`,
      );
    } else this.origin(req);
    reply.clearCookie(this.config.cookie, {
      path: "/",
      secure: this.config.production,
      httpOnly: true,
      sameSite: "lax",
    });
  }
  async change(
    req: FastifyRequest,
    reply: FastifyReply,
    input: Row,
    ctx: Context,
    session: Row,
  ) {
    await this.rate("password-change", ctx.actor!.userId, 5, 900);
    const cred = await one(
      this.db.db,
      sql`SELECT * FROM user_credentials WHERE user_id=${ctx.actor!.userId}`,
    );
    if (!(await verify(input.currentPassword, cred)))
      fail(401, "INVALID_CREDENTIALS");
    if (input.currentPassword === input.newPassword)
      fail(422, "PASSWORD_POLICY");
    const next = await hashPassword(input.newPassword);
    const issued = await this.db.tx(async (c) => {
      await this.actor(c, session, true);
      const current = await one(
        c,
        sql`SELECT version FROM user_credentials WHERE user_id=${ctx.actor!.userId}`,
      );
      if (current!.version !== cred!.version) fail(409, "VERSION_CONFLICT");
      await writeCredential(c, ctx.actor!.userId, next);
      const u = await one(
        c,
        sql`UPDATE users SET auth_version=auth_version+1,must_change_password=false,version=version+1,updated_at=${ctx.now} WHERE id=${ctx.actor!.userId} RETURNING *`,
      );
      await c.execute(
        sql`UPDATE sessions SET revoked_at=${ctx.now} WHERE user_id=${ctx.actor!.userId} AND revoked_at IS NULL`,
      );
      await audit(c, ctx, "PASSWORD_CHANGED", "user", u!.id);
      return this.issue(c, reply, u);
    });
    issued.apply();
    return this.view(this.db.db, issued.session);
  }
}
export async function writeCredential(
  c: Conn,
  userId: string,
  next: { hash: string; salt: string },
) {
  await c.execute(sql`INSERT INTO user_credentials(user_id,password_hash,password_salt,algorithm,parameters)
    VALUES(${userId},${next.hash},${next.salt},'scrypt-v1',${json({ N: params.N, r: 8, p: 1, keyBytes: 64 })})
    ON CONFLICT(user_id) DO UPDATE SET password_hash=excluded.password_hash,password_salt=excluded.password_salt,changed_at=now(),version=user_credentials.version+1`);
}
