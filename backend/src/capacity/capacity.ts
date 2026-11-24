import { createHash, randomUUID } from "node:crypto";
import type { Config } from "../config";
import { sql, rows, one, json, ids, type Conn, type Row } from "../database";
import {
  fail,
  iso,
  day,
  midnight,
  minutes,
  overlap,
  expectVersion,
  audit,
  range,
  type Context,
} from "../common";

export type ServicePlan = {
  id: string;
  name: string;
  planRevision: number;
  estimatedDurationMinutes?: number;
  requirements: {
    poolId: string;
    units: number;
    offsetMinutes: number;
    durationMinutes: number;
  }[];
};
export function slotId(stationId: string, start: number) {
  const h = createHash("md5")
    .update(stationId + ":" + new Date(start).toISOString())
    .digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-3${h.slice(13, 16)}-${"89ab"[parseInt(h[16], 16) % 4]}${h.slice(17, 20)}-${h.slice(20)}`;
}
export function slotWindows(date: string, hours: Row[], width: number) {
  const origin = +midnight(date),
    weekday = new Date(date + "T12:00:00Z").getUTCDay();
  return hours
    .filter((h) => h.weekday === weekday)
    .flatMap((h) => {
      const result: { start: number; end: number }[] = [];
      const end = origin + minutes(h.closesAt) * 60000;
      for (
        let start = origin + minutes(h.opensAt) * 60000;
        start < end;
        start += width * 60000
      )
        result.push({ start, end: Math.min(end, start + width * 60000) });
      return result;
    })
    .sort((a, b) => a.start - b.start);
}
export class Capacity {
  constructor(readonly config: Config) {}
  async policy(c: Conn, stationId: string, _at: Date) {
    const s = await one(c, sql`SELECT * FROM stations WHERE id=${stationId}`);
    if (!s) fail(404, "NOT_FOUND");
    return {
      id: s.id,
      bucket_minutes: s.booking_slot_minutes,
      start_grid_minutes: s.booking_slot_minutes,
      slot_limit: s.booking_slot_limit,
      hours: s.booking_hours as Row[],
      lead_minutes: 0,
      advance_days: 30,
      no_show_grace_minutes: 15,
      effective_to: null,
    };
  }
  async servicePlans(
    c: Conn,
    ctx: Context,
    serviceIds: string[],
    catalogVersion: number,
  ): Promise<ServicePlan[]> {
    if (catalogVersion !== ctx.station.catalog_version)
      fail(409, "CATALOG_VERSION_CONFLICT");
    const services = await rows(
      c,
      sql`SELECT * FROM services WHERE id=ANY(${ids(serviceIds)})`,
    );
    if (
      services.length !== serviceIds.length ||
      services.some((s) => !s.active || !s.bookable)
    )
      fail(422, "SERVICE_INACTIVE");
    return serviceIds.map((id) => {
      const s = services.find((s) => s.id === id)!;
      return {
        id,
        name: s.name,
        planRevision: s.plan_revision,
        estimatedDurationMinutes: s.estimated_duration_minutes,
        requirements: [],
      };
    });
  }
  async state(c: Conn, ctx: Context, date: string, ignoreReservation?: string) {
    const origin = midnight(date),
      end = new Date(+origin + 86400000),
      policy = await this.policy(c, ctx.station.id, origin);
    const ignored = ignoreReservation
      ? await one(
          c,
          sql`SELECT booking_id FROM capacity_reservations WHERE id=${ignoreReservation} AND status='ACTIVE'`,
        )
      : undefined;
    const [bookings, overrides, blocks] = await Promise.all([
      rows(
        c,
        sql`SELECT id,scheduled_start_at,status FROM bookings WHERE deleted_at IS NULL AND station_id=${ctx.station.id} AND scheduled_start_at>=${origin} AND scheduled_start_at<${end} AND status IN ('PENDING','CONFIRMED','ARRIVED','COMPLETED') ${ignored?.booking_id ? sql`AND id<>${ignored.booking_id}::uuid` : sql``}`,
      ),
      rows(
        c,
        sql`SELECT * FROM booking_slot_overrides WHERE station_id=${ctx.station.id} AND starts_at>=${origin} AND starts_at<${end}`,
      ),
      rows(
        c,
        sql`SELECT * FROM calendar_blocks WHERE station_id=${ctx.station.id} AND pool_id IS NULL AND resource_id IS NULL AND retired_at IS NULL AND starts_at<${end} AND ends_at>${origin}`,
      ),
    ]);
    const buckets = slotWindows(date, policy.hours, policy.bucket_minutes).map(
      (w) => {
        const stored = overrides.find((o) => +o.starts_at === w.start),
          held = bookings.filter(
            (b) =>
              +b.scheduled_start_at >= w.start && +b.scheduled_start_at < w.end,
          );
        return {
          ...w,
          id: slotId(ctx.station.id, w.start),
          limit: stored?.capacity_limit ?? policy.slot_limit,
          held: held.length,
          pending: held.filter((b) => b.status === "PENDING").length,
          confirmed: held.filter((b) => b.status !== "PENDING").length,
          closed:
            !!stored?.closed ||
            blocks.some((b) =>
              overlap(+b.starts_at, +b.ends_at, w.start, w.end),
            ),
          version: stored?.version || 1,
          bookingIds: held.map((b) => b.id),
        };
      },
    );
    return { policy, input: { buckets } };
  }
  // Half-day periods a customer can request; noon splits morning from afternoon.
  async periods(c: Conn, ctx: Context, date: string) {
    const { policy, input } = await this.state(c, ctx, date),
      origin = +midnight(date),
      today = +midnight(day(ctx.now)),
      inWindow =
        origin >= today && origin <= today + policy.advance_days * 86400000;
    const clock = (t: number) => {
      const m = Math.round((t - origin) / 60000);
      return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    };
    return (["MORNING", "AFTERNOON"] as const).map((period) => {
      // Opening hours of this half-day (a lunch break is a gap between two hour ranges).
      const half = input.buckets.filter(
        (b) => b.start - origin < 12 * 3600000 === (period === "MORNING"),
      );
      const opensAt = half.length ? clock(Math.min(...half.map((b) => b.start))) : null;
      const closesAt = half.length ? clock(Math.max(...half.map((b) => b.end))) : null;
      const open = inWindow
        ? input.buckets.find(
            (b) =>
              b.start - origin < 12 * 3600000 === (period === "MORNING") &&
              !b.closed &&
              b.start > +ctx.now,
          )
        : undefined;
      return { period, startAt: open ? open.start : null, opensAt, closesAt };
    });
  }
  // Start of the requested period: orders pending requests until an advisor sets the real time.
  async periodStart(
    c: Conn,
    ctx: Context,
    date: string,
    period: "MORNING" | "AFTERNOON",
  ) {
    const found = (await this.periods(c, ctx, date)).find(
      (p) => p.period === period,
    )!;
    if (found.startAt === null)
      fail(
        422,
        "PERIOD_UNAVAILABLE",
        "Buổi này trạm không nhận lịch. Vui lòng chọn ngày hoặc buổi khác.",
      );
    return new Date(found.startAt);
  }
  // Staff-entered times are never blocked by load; overload and closures come back as warnings.
  async allocate(
    c: Conn,
    ctx: Context,
    services: ServicePlan[],
    at: Date,
    policyVersion: number,
    ignoreReservation?: string,
    reception = false,
  ) {
    if (policyVersion !== ctx.station.configuration_version)
      fail(409, "POLICY_VERSION_CONFLICT");
    const p = await this.policy(c, ctx.station.id, at),
      warnings: string[] = [];
    if (!reception) {
      if (
        +at <= +ctx.now ||
        +midnight(day(at)) > +midnight(day(ctx.now)) + p.advance_days * 86400000
      )
        fail(422, "OUTSIDE_BOOKING_WINDOW");
      const { input } = await this.state(c, ctx, day(at), ignoreReservation),
        b = input.buckets.find((b) => b.start <= +at && +at < b.end);
      if (!b) warnings.push("OUTSIDE_HOURS");
      else if (b.closed) warnings.push("SLOT_CLOSED");
      else if (b.confirmed >= b.limit) warnings.push("SLOT_OVERLOADED");
    }
    const duration = services.reduce(
      (sum, s) =>
        sum +
        (s.estimatedDurationMinutes ||
          Math.max(
            15,
            ...s.requirements.map((r) => r.offsetMinutes + r.durationMinutes),
          )),
      0,
    );
    return {
      policy: p,
      warnings,
      plan: {
        start: +at,
        end: +at + Math.max(15, duration) * 60000,
        allocations: [],
        charges: [],
      },
    };
  }
  async persist(
    c: Conn,
    ctx: Context,
    bookingId: string,
    result: Awaited<ReturnType<Capacity["allocate"]>>,
    previous?: Row,
    visitId?: string,
  ) {
    if (previous) await this.release(c, ctx, previous.id, "REPLAN");
    const generation = await one(
      c,
      sql`SELECT COALESCE(MAX(generation),0)+1 AS next FROM capacity_reservations WHERE ${visitId ? sql`visit_id=${visitId}` : sql`booking_id=${bookingId}`}`,
    );
    return (await one(
      c,
      sql`INSERT INTO capacity_reservations(booking_id,visit_id,status,generation,policy_version,start_at,end_at,held_at) VALUES(${visitId ? null : bookingId},${visitId || null},'ACTIVE',${generation!.next},${ctx.station.configuration_version},${new Date(result.plan.start)},${new Date(result.plan.end)},${ctx.now}) RETURNING *`,
    ))!;
  }
  async release(c: Conn, ctx: Context, reservationId: string, why: string) {
    const hold = await one(
      c,
      sql`SELECT * FROM capacity_reservations WHERE id=${reservationId} AND status='ACTIVE' FOR UPDATE`,
    );
    if (!hold) return;
    await c.execute(
      sql`UPDATE capacity_buckets b SET held_units=b.held_units-ch.units,version=b.version+1,updated_at=${ctx.now} FROM reservation_bucket_charges ch WHERE ch.bucket_id=b.id AND ch.reservation_id=${reservationId} AND ch.released_at IS NULL`,
    );
    await c.execute(
      sql`UPDATE reservation_bucket_charges SET released_at=${ctx.now} WHERE reservation_id=${reservationId} AND released_at IS NULL`,
    );
    await c.execute(
      sql`UPDATE reservation_allocations SET released_at=${ctx.now} WHERE reservation_id=${reservationId} AND released_at IS NULL`,
    );
    await c.execute(
      sql`UPDATE capacity_reservations SET status='RELEASED',released_at=${ctx.now},release_reason=${why} WHERE id=${reservationId}`,
    );
  }
  async policyView(c: Conn, ctx: Context) {
    const p = await this.policy(c, ctx.station.id, ctx.now);
    return {
      stationId: ctx.station.id,
      bookingEnabled: ctx.station.booking_enabled,
      configurationVersion: ctx.station.configuration_version,
      slotMinutes: p.bucket_minutes,
      maxBookingsPerSlot: p.slot_limit,
      hours: p.hours,
      leadMinutes: 0,
      advanceDays: 30,
    };
  }
  async writePolicy(c: Conn, ctx: Context, input: Row) {
    if (input.expectedVersion !== ctx.station.configuration_version)
      fail(409, "VERSION_CONFLICT");
    if (input.slotMinutes !== ctx.station.booking_slot_minutes) {
      // shortcut: changing interval with future bookings is blocked; add explicit rescheduling before allowing it.
      if (
        await one(
          c,
          sql`SELECT id FROM bookings WHERE station_id=${ctx.station.id} AND scheduled_start_at>${ctx.now} AND status IN ('PENDING','CONFIRMED') LIMIT 1`,
        )
      )
        fail(
          409,
          "CAPACITY_IMPACT",
          "Cần xử lý các lịch sắp tới trước khi đổi độ dài khung giờ.",
        );
    }
    const grouped = await rows(
      c,
      sql`SELECT scheduled_start_at FROM bookings WHERE deleted_at IS NULL AND station_id=${ctx.station.id} AND scheduled_start_at>${ctx.now} AND status IN ('PENDING','CONFIRMED','ARRIVED','COMPLETED')`,
    );
    const counts = new Map<number, number>();
    for (const b of grouped) {
      const slot = slotWindows(
        day(b.scheduled_start_at),
        input.hours,
        input.slotMinutes,
      ).find(
        (w) =>
          w.start <= +b.scheduled_start_at && w.end > +b.scheduled_start_at,
      );
      if (slot) counts.set(slot.start, (counts.get(slot.start) || 0) + 1);
    }
    if ([...counts.values()].some((count) => count > input.maxBookingsPerSlot))
      fail(
        409,
        "CAPACITY_IMPACT",
        "Giới hạn mới thấp hơn số lịch đang giữ chỗ.",
      );
    await c.execute(
      sql`UPDATE stations SET booking_slot_minutes=${input.slotMinutes},booking_slot_limit=${input.maxBookingsPerSlot},booking_hours=${json(input.hours)},booking_enabled=${input.bookingEnabled},configuration_version=configuration_version+1,updated_at=${ctx.now} WHERE id=${ctx.station.id}`,
    );
    await audit(
      c,
      ctx,
      "BOOKING_SETTINGS_UPDATED",
      "station",
      ctx.station.id,
      input.reason,
    );
    return {
      configurationVersion: ctx.station.configuration_version + 1,
      eventId: randomUUID(),
    };
  }
  async materialize(c: Conn, ctx: Context, input: Row) {
    if (input.expectedPolicyVersion !== ctx.station.configuration_version)
      fail(409, "POLICY_VERSION_CONFLICT");
    await this.state(c, ctx, input.date);
    return {
      date: input.date,
      policyVersion: ctx.station.configuration_version,
      createdBucketCount: 0,
      alreadyInitialized: true,
    };
  }
  async patchBucket(c: Conn, ctx: Context, id: string, input: Row) {
    const at = new Date(input.startAt),
      state = await this.state(c, ctx, day(at)),
      b = state.input.buckets.find((b) => b.id === id && b.start === +at);
    if (!b) fail(404, "NOT_FOUND");
    expectVersion({ version: b.version }, input.expectedVersion);
    if (+at <= +ctx.now) fail(422, "OUTSIDE_BOOKING_WINDOW");
    if (input.capacityLimit !== undefined && input.capacityLimit < b.confirmed)
      fail(409, "CAPACITY_IMPACT");
    const old = await one(
      c,
      sql`SELECT * FROM booking_slot_overrides WHERE id=${id}`,
    );
    const saved = await one(
      c,
      sql`INSERT INTO booking_slot_overrides(id,station_id,starts_at,capacity_limit,closed,reason,version) VALUES(${id},${ctx.station.id},${at},${input.capacityLimit ?? old?.capacity_limit ?? null},${input.closed ?? old?.closed ?? false},${input.reason},${b.version + 1}) ON CONFLICT(id) DO UPDATE SET capacity_limit=EXCLUDED.capacity_limit,closed=EXCLUDED.closed,reason=EXCLUDED.reason,version=EXCLUDED.version,updated_at=${ctx.now} RETURNING version`,
    );
    await c.execute(
      sql`UPDATE stations SET configuration_version=configuration_version+1 WHERE id=${ctx.station.id}`,
    );
    await audit(
      c,
      ctx,
      "BOOKING_SLOT_UPDATED",
      "booking_slot",
      id,
      input.reason,
    );
    return { id, version: saved!.version, eventId: randomUUID() };
  }
  async createBlock(c: Conn, ctx: Context, input: Row) {
    const b = await one(
      c,
      sql`INSERT INTO calendar_blocks(station_id,kind,starts_at,ends_at,reason,created_by) VALUES(${ctx.station.id},${input.kind},${new Date(input.startsAt)},${new Date(input.endsAt)},${input.reason},${ctx.actor!.userId}) RETURNING *`,
    );
    await c.execute(
      sql`UPDATE stations SET configuration_version=configuration_version+1 WHERE id=${ctx.station.id}`,
    );
    await audit(
      c,
      ctx,
      "BOOKING_DAY_CLOSED",
      "calendar_block",
      b!.id,
      input.reason,
    );
    return {
      id: b!.id,
      version: b!.version,
      eventId: randomUUID(),
      configurationVersion: ctx.station.configuration_version + 1,
    };
  }
  async deleteBlock(c: Conn, ctx: Context, id: string, input: Row) {
    const b = await one(
      c,
      sql`SELECT * FROM calendar_blocks WHERE id=${id} AND station_id=${ctx.station.id} AND pool_id IS NULL AND resource_id IS NULL`,
    );
    if (!b) fail(404, "NOT_FOUND");
    expectVersion(b, input.expectedVersion);
    if (b.retired_at) fail(409, "INVALID_TRANSITION");
    await c.execute(
      sql`UPDATE calendar_blocks SET retired_at=${ctx.now},version=version+1 WHERE id=${id}`,
    );
    await c.execute(
      sql`UPDATE stations SET configuration_version=configuration_version+1 WHERE id=${ctx.station.id}`,
    );
    await audit(
      c,
      ctx,
      "BOOKING_DAY_REOPENED",
      "calendar_block",
      id,
      input.reason,
    );
  }
  async calendar(c: Conn, ctx: Context, q: Row) {
    const dates = range(q.from, q.to, 31),
      buckets = [];
    for (let at = +dates.from; at < +dates.to; at += 86400000) {
      const state = await this.state(c, ctx, day(new Date(at)));
      buckets.push(
        ...state.input.buckets.map((b) => ({
          id: b.id,
          startAt: iso(new Date(b.start)),
          endAt: iso(new Date(b.end)),
          capacityLimit: b.limit,
          heldUnits: b.held,
          pendingCount: b.pending,
          confirmedCount: b.confirmed,
          // Pending requests hold nothing; only confirmed bookings use the slot's warning threshold.
          freeUnits: b.closed ? 0 : Math.max(0, b.limit - b.confirmed),
          closed: b.closed,
          version: b.version,
          holdRefs: b.bookingIds.map((bookingId) => ({ bookingId, units: 1 })),
        })),
      );
    }
    return {
      stationId: ctx.station.id,
      timezone: "Asia/Ho_Chi_Minh",
      from: q.from,
      to: q.to,
      policyVersion: ctx.station.configuration_version,
      asOf: iso(ctx.now),
      buckets,
      resources: [],
    };
  }
}
export const blockView = (b: Row) => ({
  id: b.id,
  kind: b.kind,
  startsAt: iso(b.starts_at),
  endsAt: iso(b.ends_at),
  reason: b.reason,
  retiredAt: b.retired_at ? iso(b.retired_at) : null,
  version: b.version,
});
