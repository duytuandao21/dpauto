import { randomUUID } from "node:crypto";
import type { Config } from "./config";
import { Database, sql, one, rows, type Conn, type Row } from "./database";
import {
  audit,
  expectVersion,
  fail,
  iso,
  page,
  scope,
  type Context,
} from "./common";

export type DeliveryResult = { status: "BLOCKED" | "PROCESSED"; code?: string };
export interface NotificationProvider {
  deliver(event: {
    eventKey: string;
    subjectType: string;
    subjectId: string;
  }): Promise<DeliveryResult>;
}
// No approved OA/template/recipient consent mapping exists yet; this adapter never contacts Zalo.
export class ZaloOaAdapter implements NotificationProvider {
  async deliver(): Promise<DeliveryResult> {
    return { status: "BLOCKED", code: "PROVIDER_NOT_CONFIGURED" };
  }
}
export class Notifications {
  constructor(
    readonly db: Database,
    readonly config: Config,
    readonly provider: NotificationProvider = new ZaloOaAdapter(),
  ) {}
  visible(ctx: Context) {
    return sql`n.recipient_id=${ctx.actor!.userId} AND n.station_id=${ctx.station.id} AND (
      (n.subject_type='booking' AND EXISTS(SELECT 1 FROM bookings b WHERE b.id=n.subject_id AND ${scope(ctx)})) OR
      (n.subject_type='visit' AND EXISTS(SELECT 1 FROM service_visits v WHERE v.id=n.subject_id AND ${scope(ctx, "v")})))`;
  }
  async inbox(c: Conn, ctx: Context, q: Row) {
    const p = await page(
      c,
      this.config,
      ctx,
      // The event behind each notice gives the detail: what happened, why, who, for which customer/vehicle.
      sql`SELECT n.*,n.created_at AS cursor_key,COALESCE(be.type,ve.type) AS event_type,COALESCE(be.reason,ve.reason) AS event_reason,
        COALESCE(be.occurred_at,ve.occurred_at) AS event_at,s.name AS actor_name,COALESCE(b.code,v.code) AS subject_code,
        COALESCE(b.contact_snapshot,v.contact_snapshot)->>'name' AS customer_name,COALESCE(b.vehicle_snapshot,v.vehicle_snapshot)->>'plate' AS vehicle_plate,
        COALESCE(b.vehicle_snapshot,v.vehicle_snapshot)->>'model' AS vehicle_model,b.scheduled_start_at AS booking_start_at,b.status AS booking_status,v.stage AS visit_stage
        FROM notifications n
        LEFT JOIN booking_events be ON n.subject_type='booking' AND be.id::text=n.event_key
        LEFT JOIN visit_events ve ON n.subject_type='visit' AND ve.id::text=n.event_key
        LEFT JOIN staff_profiles s ON s.user_id=COALESCE(be.actor_user_id,ve.actor_user_id)
        LEFT JOIN bookings b ON n.subject_type='booking' AND b.id=n.subject_id
        LEFT JOIN service_visits v ON n.subject_type='visit' AND v.id=n.subject_id
        WHERE ${this.visible(ctx)}`,
      q,
      "inbox",
      true,
    );
    const count = await one(
      c,
      sql`SELECT count(*)::int AS n FROM notifications n WHERE ${this.visible(ctx)} AND read_at IS NULL`,
    );
    return {
      data: p.items.map((n) => ({
        id: n.id,
        title: n.title,
        subjectId: n.subject_id,
        subjectType: n.subject_type,
        createdAt: iso(n.created_at),
        readAt: n.read_at ? iso(n.read_at) : null,
        version: n.version,
        eventType: n.event_type || null,
        reason: n.event_reason || null,
        occurredAt: n.event_at ? iso(n.event_at) : null,
        actorName: n.actor_name || null,
        subject: {
          code: n.subject_code || null,
          customerName: n.customer_name || null,
          plate: n.vehicle_plate || null,
          model: n.vehicle_model || null,
          startAt: n.booking_start_at ? iso(n.booking_start_at) : null,
          status: n.booking_status || n.visit_stage || null,
        },
      })),
      page: p.page,
      extra: { unread: count!.n },
    };
  }
  async read(c: Conn, ctx: Context, id: string, input: Row) {
    const n = await one(
      c,
      sql`SELECT n.* FROM notifications n WHERE n.id=${id} AND ${this.visible(ctx)} FOR UPDATE`,
    );
    if (!n) fail(404, "NOT_FOUND");
    expectVersion(n, input.expectedVersion);
    await c.execute(
      sql`UPDATE notifications SET read_at=COALESCE(read_at,${ctx.now}),version=version+1 WHERE id=${id}`,
    );
    await audit(c, ctx, "NOTIFICATION_READ", "notification", id);
    return { id, version: n.version + 1, eventId: randomUUID() };
  }
  jobScope(ctx: Context) {
    return sql`((j.aggregate_type='booking' AND EXISTS(SELECT 1 FROM bookings b WHERE b.id=j.aggregate_id AND b.station_id=${ctx.station.id})) OR (j.aggregate_type='visit' AND EXISTS(SELECT 1 FROM service_visits v WHERE v.id=j.aggregate_id AND v.station_id=${ctx.station.id})))`;
  }
  async jobs(c: Conn, ctx: Context, q: Row) {
    const p = await page(
      c,
      this.config,
      ctx,
      sql`SELECT j.id,j.status,j.attempts,j.version,j.last_error_code,j.next_attempt_at,j.created_at AS cursor_key FROM outbox_jobs j WHERE j.kind IN ('BOOKING_EVENT','VISIT_EVENT') AND ${this.jobScope(ctx)}`,
      q,
      "notification-jobs",
      true,
    );
    const data = [];
    for (const j of p.items) {
      const logs = await rows(
        c,
        sql`SELECT attempt,channel,status,error_code,occurred_at FROM notification_deliveries WHERE job_id=${j.id} ORDER BY attempt DESC,channel LIMIT 12`,
      );
      data.push({
        id: j.id,
        status: j.status,
        attempts: j.attempts,
        version: j.version,
        errorCode: j.last_error_code,
        nextAttemptAt: j.next_attempt_at ? iso(j.next_attempt_at) : null,
        createdAt: iso(j.cursor_key),
        deliveries: logs.map((l) => ({
          attempt: l.attempt,
          channel: l.channel,
          status: l.status,
          errorCode: l.error_code,
          at: iso(l.occurred_at),
        })),
      });
    }
    return { data, page: p.page };
  }
  async retry(c: Conn, ctx: Context, id: string, input: Row) {
    const j = await one(
      c,
      sql`SELECT j.* FROM outbox_jobs j WHERE j.id=${id} AND ${this.jobScope(ctx)} FOR UPDATE`,
    );
    if (!j) fail(404, "NOT_FOUND");
    expectVersion(j, input.expectedVersion);
    if (j.status !== "FAILED" || j.attempts >= 5)
      fail(409, "JOB_NOT_RETRYABLE");
    await c.execute(
      sql`UPDATE outbox_jobs SET status='PENDING',next_attempt_at=${ctx.now},updated_at=${ctx.now},version=version+1 WHERE id=${id}`,
    );
    await audit(
      c,
      ctx,
      "NOTIFICATION_RETRY_REQUESTED",
      "outbox",
      id,
      input.reason,
    );
    return { id, version: j.version + 1, eventId: randomUUID() };
  }
  async work(limit = 50) {
    let processed = 0,
      failed = 0;
    // Claims are committed before processing, so a crashed worker can be reclaimed after its lease.
    const claimed = await this.db.tx(async (c) => {
      await c.execute(
        sql`UPDATE outbox_jobs SET status='FAILED',lease_token=NULL,lease_until=NULL,last_error_code='LEASE_EXPIRED',version=version+1 WHERE kind IN ('BOOKING_EVENT','VISIT_EVENT') AND status='PROCESSING' AND attempts>=5 AND lease_until<=${this.config.now()}`,
      );
      return rows(
        c,
        sql`UPDATE outbox_jobs SET status='PROCESSING',lease_token=gen_random_uuid(),lease_until=${new Date(+this.config.now() + 30000)},attempts=attempts+1,version=version+1,updated_at=${this.config.now()} WHERE id IN(SELECT id FROM outbox_jobs WHERE kind IN ('BOOKING_EVENT','VISIT_EVENT') AND attempts<5 AND scheduled_at<=${this.config.now()} AND (status IN ('PENDING','FAILED') AND COALESCE(next_attempt_at,scheduled_at)<=${this.config.now()} OR status='PROCESSING' AND lease_until<=${this.config.now()}) ORDER BY scheduled_at,id FOR UPDATE SKIP LOCKED LIMIT ${Math.min(50, Math.max(1, limit))}) RETURNING *`,
      );
    });
    for (const job of claimed) {
      try {
        const owned = await this.db.tx(async (c) => {
          const type = job.aggregate_type === "booking" ? "booking" : "visit";
          const table =
            type === "booking" ? sql`bookings` : sql`service_visits`;
          const subject = await one(
            c,
            sql`SELECT station_id FROM ${table} WHERE id=${job.aggregate_id}`,
          );
          if (!subject) throw Error("SUBJECT_NOT_FOUND");
          await c.execute(
            sql`SELECT id FROM stations WHERE id=${subject.station_id} FOR UPDATE`,
          );
          const live = await one(
            c,
            sql`SELECT * FROM outbox_jobs WHERE id=${job.id} AND lease_token=${job.lease_token} AND status='PROCESSING' FOR UPDATE`,
          );
          if (!live) return false;
          if((await one(c,sql`SELECT frozen FROM station_write_guards WHERE station_id=${subject.station_id}`))?.frozen){
            await c.execute(sql`UPDATE outbox_jobs SET status='PENDING',attempts=attempts-1,lease_until=NULL,lease_token=NULL,version=version+1 WHERE id=${job.id} AND lease_token=${job.lease_token}`);return false;
          }
          const record = (await one(
            c,
            sql`SELECT assigned_advisor_id,code FROM ${table} WHERE id=${job.aggregate_id}`,
          ))!;
          const recipients = await rows(
            c,
            sql`SELECT u.id FROM users u JOIN user_roles r ON r.user_id=u.id JOIN staff_profiles s ON s.user_id=u.id WHERE u.status='ACTIVE' AND s.active AND s.station_id=${subject.station_id} AND (r.role_code='MANAGER' OR (r.role_code='ADVISOR' AND s.id=${record.assigned_advisor_id}))`,
          );
          for (const u of recipients)
            await c.execute(
              sql`INSERT INTO notifications(station_id,recipient_id,event_key,subject_type,subject_id,title,created_at) VALUES(${subject.station_id},${u.id},${job.event_key},${type},${job.aggregate_id},${(type === "booking" ? "Lịch hẹn " : "Phiếu dịch vụ ") + record.code + " vừa cập nhật"},${this.config.now()}) ON CONFLICT(recipient_id,event_key) DO NOTHING`,
            );
          await c.execute(
            sql`INSERT INTO notification_deliveries(job_id,attempt,channel,status,occurred_at) VALUES(${job.id},${job.attempts},'INBOX','PROCESSED',${this.config.now()}) ON CONFLICT DO NOTHING`,
          );
          return true;
        });
        if (!owned) continue;
        // Delivery is outside the business transaction. The configured adapter is disabled until OA approval.
        const result = await this.provider.deliver({
          eventKey: job.event_key,
          subjectType: job.aggregate_type,
          subjectId: job.aggregate_id,
        });
        await this.db.tx(async (c) => {
          const j = await one(
            c,
            sql`UPDATE outbox_jobs SET status='PROCESSED',lease_until=NULL,lease_token=NULL,last_error_code=NULL,version=version+1,updated_at=${this.config.now()} WHERE id=${job.id} AND lease_token=${job.lease_token} RETURNING id`,
          );
          if (j)
            await c.execute(
              sql`INSERT INTO notification_deliveries(job_id,attempt,channel,status,error_code,occurred_at) VALUES(${job.id},${job.attempts},'ZALO',${result.status},${result.code || null},${this.config.now()}) ON CONFLICT DO NOTHING`,
            );
        });
        processed++;
      } catch {
        failed++;
        await this.db.tx(async (c) => {
          // A stale worker cannot overwrite another worker's result.
          const j = await one(
            c,
            sql`UPDATE outbox_jobs SET status='FAILED',lease_until=NULL,lease_token=NULL,last_error_code='DELIVERY_FAILED',next_attempt_at=${new Date(+this.config.now() + Math.min(3600, 30 * 2 ** job.attempts) * 1000)},version=version+1,updated_at=${this.config.now()} WHERE id=${job.id} AND lease_token=${job.lease_token} RETURNING id`,
          );
          if (j)
            await c.execute(
              sql`INSERT INTO notification_deliveries(job_id,attempt,channel,status,error_code,occurred_at) VALUES(${job.id},${job.attempts},'ZALO','FAILED','DELIVERY_FAILED',${this.config.now()}) ON CONFLICT DO NOTHING`,
            );
        });
      }
    }
    return { claimed: claimed.length, processed, failed };
  }
}
