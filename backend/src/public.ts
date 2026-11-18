import { sql, rows, type Conn, type Row } from "./database";
import {
  ApiError,
  fail,
  mac,
  equal,
  canonical,
  iso,
  type Context,
} from "./common";
import { Capacity } from "./capacity/capacity";
import type { Config } from "./config";

export const notices = {
  BOOKING_V1: {
    url: "/chinh-sach-dat-lich",
    title:
      "Thông tin đặt lịch được dùng để liên hệ, xác nhận và chuẩn bị dịch vụ tại trạm.",
  },
};
export class PublicApi {
  constructor(
    readonly config: Config,
    readonly capacity: Capacity,
  ) {}
  qrToken(ctx: Context) {
    const payload = Buffer.from(
      canonical({
        stationId: ctx.station.id,
        version: ctx.station.qr_channel_version,
        channel: "QR",
      }),
    ).toString("base64url");
    return payload + "." + mac(mac(this.config.secret, "qr-channel"), payload);
  }
  source(ctx: Context, token?: string) {
    if (!token) return "WEBSITE";
    if (!equal(token, this.qrToken(ctx))) fail(400, "CHANNEL_INVALID");
    return "QR";
  }
  async catalog(c: Conn, ctx: Context) {
    const p = await this.capacity.policy(c, ctx.station.id, ctx.now);
    const services = await rows(
      c,
      sql`SELECT s.* FROM services s WHERE s.active AND s.bookable ORDER BY s.sort_order,s.id`,
    );
    const eligible = ctx.station.booking_enabled ? services : [];
    return {
      services: eligible.map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        description: s.description,
        estimatedDurationLabel: s.estimated_duration_minutes + " phút",
      })),
      catalogVersion: ctx.station.catalog_version,
      policyVersion: ctx.station.configuration_version,
      timezone: "Asia/Ho_Chi_Minh",
      bookingPolicy: {
        leadMinutes: p.lead_minutes,
        advanceDays: p.advance_days,
        startGridMinutes: p.start_grid_minutes,
        privacyNoticeVersion: ctx.station.privacy_notice_version,
        privacyNoticeUrl: notices.BOOKING_V1.url,
        marketingNoticeVersion: ctx.station.marketing_notice_version,
      },
      asOf: iso(ctx.now),
    };
  }
  async availability(c: Conn, ctx: Context, q: Row) {
    if (!ctx.station.booking_enabled)
      fail(
        503,
        "BOOKING_NOT_CONFIGURED",
        "Trạm hiện chưa mở nhận lịch trực tuyến.",
      );
    // Only says whether the station takes requests that half-day; no counts, no limits.
    const periods = (await this.capacity.periods(c, ctx, q.date)).map((p) => ({
      period: p.period,
      status: p.startAt === null ? "UNAVAILABLE" : "AVAILABLE",
    }));
    return {
      date: q.date,
      timezone: "Asia/Ho_Chi_Minh",
      periods,
      asOf: iso(ctx.now),
    };
  }
}
