import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { z } from "zod";
import { sql, one, rows, type Conn, type Row } from "./database";
import type { Config } from "./config";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message = "Không thể thực hiện yêu cầu.",
    readonly fields: unknown[] = [],
  ) {
    super(message);
  }
}
export function fail(status: number, code: string, message?: string): never {
  throw new ApiError(status, code, message);
}
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export const mac = (secret: string, s: string) =>
  createHmac("sha256", secret).update(s).digest("base64url");
export const equal = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  if (v && typeof v === "object")
    return (
      "{" +
      Object.keys(v)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + canonical((v as Row)[k]))
        .join(",") +
      "}"
    );
  return JSON.stringify(v);
}
export function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success)
    throw new ApiError(
      400,
      "VALIDATION_FAILED",
      "Vui lòng kiểm tra dữ liệu.",
      r.error.issues.map((i) => ({
        path: i.path.join("."),
        code: i.code,
        message: "Giá trị không hợp lệ.",
      })),
    );
  return r.data;
}
export const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
export const iso = (d: string | Date) => new Date(d).toISOString();
export const day = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
export const midnight = (d: string) => new Date(d + "T00:00:00+07:00");
export const minutes = (t: string) =>
  Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export const overlap = (a: number, b: number, c: number, d: number) =>
  a < d && c < b;
export const uuid = z.uuid();
export const version = z.number().int().min(1);
export const text = (n: number) => z.string().trim().min(1).max(n);
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => !Number.isNaN(+midnight(s)) && day(midnight(s)) === s);
export const instant = z
  .string()
  .datetime({ offset: true })
  .refine((s) => !Number.isNaN(Date.parse(s)));
export const phone = z
  .string()
  .max(30)
  .transform((s) => s.replace(/[\s().-]/g, ""))
  .refine((s) => /^(0|84|\+84)[35789]\d{8}$/.test(s))
  .transform((s) => "+84" + s.replace(/^(\+84|84|0)/, ""));
export const reason = text(400);
export const password = z
  .string()
  .refine(
    (s) =>
      [...s].length >= 15 &&
      [...s].length <= 128 &&
      Buffer.byteLength(s) <= 512,
  );
export const boolQuery = z
  .enum(["true", "false"])
  .transform((s) => s === "true")
  .optional();
export const pagination = {
  cursor: z.string().max(4096).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};
export function range(from: string, to: string, max = 93) {
  const a = +midnight(from),
    b = +midnight(to);
  if (b < a || b - a > (max - 1) * 86400000) fail(422, "INVALID_RANGE");
  return { from: new Date(a), to: new Date(b + 86400000) };
}

export type Actor = {
  userId: string;
  staffId: string;
  stationId: string;
  authVersion: number;
  role: "MANAGER" | "ADVISOR" | "CMS_ADMIN";
  permissions: string[];
  name: string;
  email: string;
  jobRole: string;
  mustChange: boolean;
};
export type Context = {
  actor?: Actor;
  station: Row;
  requestId: string;
  correlationId: string;
  ip: string;
  now: Date;
};
export function manager(ctx: Context) {
  if (ctx.actor?.role !== "MANAGER") fail(403, "FORBIDDEN");
}
export function permission(ctx: Context, p: string) {
  if (!ctx.actor?.permissions.includes(p)) fail(403, "FORBIDDEN");
}
export function scope(ctx: Context, alias = "b", includeDeleted = false) {
  if (!ctx.actor) fail(401, "UNAUTHENTICATED");
  const a = sql.identifier(alias);
  const access =
    ctx.actor.role === "MANAGER"
      ? sql`${a}.station_id=${ctx.station.id}::uuid`
      : alias === "b"
        ? // Unclaimed pending bookings form a shared queue every advisor can pick up.
          sql`${a}.station_id=${ctx.station.id}::uuid AND (${a}.assigned_advisor_id=${ctx.actor.staffId}::uuid OR (${a}.assigned_advisor_id IS NULL AND ${a}.status='PENDING'))`
        : sql`${a}.station_id=${ctx.station.id}::uuid AND ${a}.assigned_advisor_id=${ctx.actor.staffId}::uuid`;
  return includeDeleted
    ? access
    : sql`${access} AND ${a}.deleted_at IS NULL`;
}
export async function scopedBooking(
  c: Conn,
  ctx: Context,
  id: string,
  lock = false,
) {
  const b = await one(
    c,
    sql`SELECT b.* FROM bookings b WHERE b.id=${id}::uuid AND ${scope(ctx)} ${lock ? sql`FOR UPDATE` : sql``}`,
  );
  if (!b) fail(404, "NOT_FOUND");
  return b;
}
export async function scopedVisit(
  c: Conn,
  ctx: Context,
  id: string,
  lock = false,
  includeDeleted = false,
) {
  const visit = await one(
    c,
    sql`SELECT v.* FROM service_visits v WHERE v.id=${id}::uuid AND ${scope(ctx, "v", includeDeleted)} ${lock ? sql`FOR UPDATE` : sql``}`,
  );
  if (!visit) fail(404, "NOT_FOUND");
  return visit;
}
export function expectVersion(row: Row, v: number) {
  if (row.version !== v)
    fail(409, "VERSION_CONFLICT", "Dữ liệu đã thay đổi. Vui lòng tải lại.");
}
export async function audit(
  c: Conn,
  ctx: Context,
  action: string,
  entityType: string,
  id: string,
  why?: string,
) {
  await c.execute(sql`INSERT INTO audit_logs(actor_user_id,actor_type,action,entity_type,entity_id,reason,request_id,correlation_id,summary)
    VALUES(${ctx.actor?.userId || null},${ctx.actor ? "STAFF" : "PUBLIC"},${action},${entityType},${id}::uuid,${why || null},${ctx.requestId},${ctx.correlationId},${action})`);
}
export async function event(
  c: Conn,
  ctx: Context,
  bookingId: string,
  type: string,
  why?: string,
  after?: unknown,
) {
  const id = randomUUID();
  await c.execute(sql`INSERT INTO booking_events(id,booking_id,type,actor_user_id,actor_type,occurred_at,reason,after_data)
    VALUES(${id},${bookingId},${type},${ctx.actor?.userId || null},${ctx.actor ? "STAFF" : "PUBLIC"},${ctx.now},${why || null},${JSON.stringify(after || {})}::jsonb)`);
  await audit(c, ctx, type, "booking", bookingId, why);
  await c.execute(
    sql`INSERT INTO outbox_jobs(event_key,kind,aggregate_type,aggregate_id,payload) VALUES(${id},'BOOKING_EVENT','booking',${bookingId},${JSON.stringify({ eventId: id, bookingId, type })}::jsonb)`,
  );
  return id;
}
export async function page(
  c: Conn,
  config: Config,
  ctx: Context,
  base: ReturnType<typeof sql>,
  query: Row,
  sort: string,
  descending = false,
) {
  const { cursor, limit, ...filters } = query;
  const binding = mac(
    config.secret,
    canonical({
      filters,
      sort,
      descending,
      station: ctx.station.id,
      user: ctx.actor?.userId,
      auth: ctx.actor?.authVersion,
    }),
  );
  let after = sql``;
  if (cursor) {
    try {
      const [encoded, sig] = cursor.split(".");
      if (!equal(sig || "", mac(config.secret, encoded))) throw Error();
      const token = JSON.parse(Buffer.from(encoded, "base64url").toString());
      if (
        token.binding !== binding ||
        typeof token.key !== "string" ||
        !uuid.safeParse(token.id).success
      )
        throw Error();
      after = descending
        ? sql`WHERE (p.cursor_key,p.id)<(${token.key},${token.id}::uuid)`
        : sql`WHERE (p.cursor_key,p.id)>(${token.key},${token.id}::uuid)`;
    } catch {
      fail(400, "CURSOR_INVALID");
    }
  }
  const order = descending ? sql`DESC` : sql`ASC`;
  const result = await rows(
    c,
    sql`SELECT p.* FROM (${base}) p ${after} ORDER BY p.cursor_key ${order},p.id ${order} LIMIT ${limit + 1}`,
  );
  const hasMore = result.length > limit,
    items = result.slice(0, limit),
    last = items.at(-1);
  let nextCursor: string | null = null;
  if (hasMore && last) {
    const encoded = Buffer.from(
      JSON.stringify({
        binding,
        key:
          last.cursor_key instanceof Date
            ? iso(last.cursor_key)
            : String(last.cursor_key),
        id: last.id,
      }),
    ).toString("base64url");
    nextCursor = encoded + "." + mac(config.secret, encoded);
  }
  return { items, page: { nextCursor, hasMore } };
}
