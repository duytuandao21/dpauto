import { randomUUID } from "node:crypto";
import { sql, one, rows, type Conn, type Row } from "./database";
import {
  audit,
  expectVersion,
  fail,
  range,
  iso,
  page,
  type Context,
} from "./common";
import type { Config } from "./config";
import { PublicApi, notices } from "./public";
import { blockView } from "./capacity/capacity";

export class System {
  constructor(
    readonly config: Config,
    readonly publicApi: PublicApi,
  ) {}
  settings(ctx: Context) {
    const s = ctx.station;
    return {
      stationId: s.id,
      name: s.name,
      phone: s.phone,
      address: s.address,
      directionsUrl: s.directions_url,
      timezone: s.timezone,
      privacyNoticeVersion: s.privacy_notice_version,
      marketingNoticeVersion: s.marketing_notice_version,
      version: s.version,
      bookingQrUrl:
        this.config.origin +
        "/?channelToken=" +
        encodeURIComponent(this.publicApi.qrToken(ctx)),
    };
  }
  async writeSettings(c: Conn, ctx: Context, input: Row) {
    expectVersion(ctx.station, input.expectedVersion);
    if (
      !(input.privacyNoticeVersion in notices) ||
      input.marketingNoticeVersion
    )
      fail(422, "NOTICE_NOT_PUBLISHED");
    await c.execute(
      sql`UPDATE stations SET name=${input.name},phone=${input.phone},address=${input.address},directions_url=${input.directionsUrl},privacy_notice_version=${input.privacyNoticeVersion},marketing_notice_version=${input.marketingNoticeVersion || null},version=version+1,updated_at=${ctx.now} WHERE id=${ctx.station.id}`,
    );
    await audit(
      c,
      ctx,
      "SITE_SETTINGS_UPDATED",
      "station",
      ctx.station.id,
      input.reason,
    );
    return {
      id: ctx.station.id,
      version: ctx.station.version + 1,
      eventId: randomUUID(),
    };
  }
  async audits(c: Conn, ctx: Context, q: Row) {
    const dates = range(q.from, q.to),
      result = await page(
        c,
        this.config,
        ctx,
        sql`SELECT a.*,s.name AS actor_name,a.occurred_at AS cursor_key FROM audit_logs a LEFT JOIN staff_profiles s ON s.user_id=a.actor_user_id
      WHERE a.occurred_at>=${dates.from} AND a.occurred_at<${dates.to}
      ${q.actorId ? sql`AND a.actor_user_id=${q.actorId}` : sql``} ${q.action ? sql`AND a.action=${q.action}` : sql``} ${q.entityType ? sql`AND a.entity_type=${q.entityType}` : sql``} ${q.entityId ? sql`AND a.entity_id=${q.entityId}` : sql``}`,
        q,
        "occurredAt:desc",
        true,
      );
    return {
      data: result.items.map((a) => ({
        id: a.id,
        actor: a.actor_user_id
          ? { id: a.actor_user_id, name: a.actor_name }
          : "SYSTEM",
        action: a.action,
        entityType: a.entity_type,
        entityId: a.entity_id,
        reason: a.reason,
        occurredAt: iso(a.occurred_at),
        requestId: a.request_id,
        correlationId: a.correlation_id,
        summary: a.summary,
      })),
      page: result.page,
    };
  }
  async blocks(c: Conn, ctx: Context, q: Row) {
    const dates = range(q.from, q.to, 31),
      result = await page(
        c,
        this.config,
        ctx,
        sql`SELECT b.*,b.starts_at AS cursor_key FROM calendar_blocks b WHERE b.station_id=${ctx.station.id} AND b.starts_at<${dates.to} AND b.ends_at>${dates.from} AND b.retired_at IS NULL AND b.pool_id IS NULL AND b.resource_id IS NULL`,
        q,
        "startsAt:asc",
      );
    return { data: result.items.map(blockView), page: result.page };
  }
}
