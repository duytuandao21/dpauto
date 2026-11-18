import { randomUUID } from "node:crypto";
import type { Config } from "./config";
import { sql, one, rows, json, type Conn, type Row } from "./database";
import {
  fail,
  scope,
  scopedBooking,
  expectVersion,
  range,
  iso,
  normalize,
  page,
  event,
  permission,
  type Context,
} from "./common";
import { Capacity, type ServicePlan } from "./capacity/capacity";
import { Directory } from "./directory";

export class Bookings {
  constructor(
    readonly config: Config,
    readonly capacity: Capacity,
    readonly directory: Directory,
  ) {}
  async summary(c: Conn, b: Row) {
    const contact = await one(
      c,
      sql`SELECT count(*)::int AS attempts FROM booking_contact_events WHERE booking_id=${b.id}`,
    );
    const callback =
      b.last_contact_outcome === "UNREACHED"
        ? await one(
            c,
            sql`SELECT callback_at FROM booking_contact_events WHERE booking_id=${b.id} ORDER BY contacted_at DESC,id DESC LIMIT 1`,
          )
        : null;
    const services = await rows(
      c,
      sql`SELECT service_id,service_name_snapshot FROM booking_services WHERE booking_id=${b.id} ORDER BY sequence_no`,
    );
    const advisor = b.assigned_advisor_id
      ? await one(
          c,
          sql`SELECT id,name FROM staff_profiles WHERE id=${b.assigned_advisor_id}`,
        )
      : null;
    return {
      id: b.id,
      code: b.code,
      customerId: b.customer_id,
      createdAt: iso(b.created_at),
      status: b.status,
      source: b.source,
      customer: {
        name: b.contact_snapshot.name,
        phone: b.contact_snapshot.phone,
      },
      vehicle: b.vehicle_id
        ? { id: b.vehicle_id, ...b.vehicle_snapshot }
        : null,
      services: services.map((s) => ({
        id: s.service_id,
        name: s.service_name_snapshot,
      })),
      requestedStartAt: iso(b.requested_start_at),
      requestedPeriod: b.requested_period ?? null,
      originalRequestedPeriod: b.original_requested_period ?? null,
      scheduledStartAt: iso(b.scheduled_start_at),
      confirmedStartAt: b.confirmed_start_at ? iso(b.confirmed_start_at) : null,
      assignedAdvisor: advisor ? { id: advisor.id, name: advisor.name } : null,
      serviceVisitId:
        (
          await one(
            c,
            sql`SELECT id FROM service_visits WHERE booking_id=${b.id} AND deleted_at IS NULL`,
          )
        )?.id || null,
      changeKind: b.change_kind,
      version: b.version,
      lastContactOutcome: b.last_contact_outcome,
      contactAttempts: contact!.attempts,
      callbackAt: callback?.callback_at ? iso(callback.callback_at) : null,
    };
  }
  filter(ctx: Context, q: Row) {
    if (
      ctx.actor!.role === "ADVISOR" &&
      q.advisorId &&
      q.advisorId !== ctx.actor!.staffId
    )
      fail(403, "FORBIDDEN");
    const dates = q.from ? range(q.from, q.to) : null;
    return sql`${scope(ctx)} ${dates ? sql`AND b.scheduled_start_at>=${dates.from} AND b.scheduled_start_at<${dates.to}` : sql``}
      ${q.customerId ? sql`AND b.customer_id=${q.customerId}` : sql``} ${q.vehicleId ? sql`AND b.vehicle_id=${q.vehicleId}` : sql``}
      ${q.advisorId === "unassigned" ? sql`AND b.assigned_advisor_id IS NULL` : q.advisorId ? sql`AND b.assigned_advisor_id=${q.advisorId}` : sql``}
      ${
        q.status
          ? sql`AND b.status IN (${sql.join(
              q.status.split(",").map((s: string) => sql`${s}`),
              sql`, `,
            )})`
          : sql``
      }
      ${q.source ? sql`AND b.source=${q.source}` : sql``} ${q.changeKind ? sql`AND b.change_kind=${q.changeKind}` : sql``}
      ${q.serviceId ? sql`AND EXISTS(SELECT 1 FROM booking_services bs WHERE bs.booking_id=b.id AND bs.service_id=${q.serviceId})` : sql``}
      ${q.categoryCode ? sql`AND EXISTS(SELECT 1 FROM booking_services bs JOIN services s ON s.id=bs.service_id JOIN service_categories cat ON cat.id=s.category_id WHERE bs.booking_id=b.id AND cat.code=${q.categoryCode})` : sql``}
      ${q.q ? sql`AND (b.code ILIKE ${"%" + q.q + "%"} OR b.contact_snapshot->>'name' ILIKE ${"%" + q.q + "%"} OR b.contact_snapshot->>'phone' LIKE ${"%" + q.q + "%"} OR b.vehicle_snapshot->>'plate' ILIKE ${"%" + q.q + "%"})` : sql``}`;
  }
  async list(c: Conn, ctx: Context, q: Row) {
    const condition = this.filter(ctx, q),
      sort = !q.from ? "createdAt:desc" : q.sort,
      key =
        sort === "createdAt:desc"
          ? sql`b.created_at`
          : sql`b.scheduled_start_at`;
    const result = await page(
      c,
      this.config,
      ctx,
      sql`SELECT b.*,${key} AS cursor_key FROM bookings b WHERE ${condition}`,
      q,
      sort,
      sort.endsWith("desc"),
    );
    const counts = await this.counts(c, ctx, condition);
    return {
      data: await Promise.all(result.items.map((b) => this.summary(c, b))),
      page: result.page,
      extra: { counts },
    };
  }
  async counts(c: Conn, ctx: Context, condition: ReturnType<typeof sql>) {
    const result = await one(
      c,
      sql`SELECT count(*)::int AS total,count(*) FILTER(WHERE status='PENDING')::int AS pending,
      count(*) FILTER(WHERE status='CONFIRMED')::int AS confirmed,count(*) FILTER(WHERE status='ARRIVED')::int AS arrived,
      count(*) FILTER(WHERE status='COMPLETED')::int AS completed,count(*) FILTER(WHERE status='CANCELLED')::int AS cancelled,
      count(*) FILTER(WHERE status='NO_SHOW')::int AS no_show,count(*) FILTER(WHERE assigned_advisor_id IS NULL AND status IN ('PENDING','CONFIRMED'))::int AS unassigned
      FROM bookings b WHERE ${condition}`,
    );
    return {
      total: result!.total,
      pending: result!.pending,
      confirmed: result!.confirmed,
      arrived: result!.arrived,
      completed: result!.completed,
      cancelled: result!.cancelled,
      noShow: result!.no_show,
      ...(ctx.actor!.role === "MANAGER"
        ? { unassigned: result!.unassigned }
        : {}),
    };
  }
  async detail(c: Conn, ctx: Context, id: string) {
    const b = await scopedBooking(c, ctx, id),
      reservation = await one(
        c,
        sql`SELECT r.* FROM capacity_reservations r LEFT JOIN service_visits v ON v.id=r.visit_id WHERE r.booking_id=${id} OR v.booking_id=${id} ORDER BY r.held_at DESC,r.generation DESC LIMIT 1`,
      );
    const snapshots = await rows(
      c,
      sql`SELECT service_id,service_name_snapshot,plan_revision,plan_snapshot,catalog_version,sequence_no FROM booking_services WHERE booking_id=${id} ORDER BY sequence_no`,
    );
    const actions: string[] = [];
    if (["PENDING", "CONFIRMED"].includes(b.status)) {
      actions.push("reschedule", "cancel", "contact");
      // Unclaimed requests are confirmable too: the advisor claims it, a manager picks one.
      if (b.status === "PENDING") actions.unshift("confirm");
      if (b.status === "CONFIRMED") {
        actions.unshift("arrive");
        const p = await this.capacity.policy(
          c,
          ctx.station.id,
          b.scheduled_start_at,
        );
        if (+ctx.now >= +b.scheduled_start_at + p.no_show_grace_minutes * 60000)
          actions.push("no_show");
      }
      if (ctx.actor!.role === "MANAGER")
        actions.push(b.assigned_advisor_id ? "transfer" : "assign");
    }
    return {
      ...(await this.summary(c, b)),
      customerId: b.customer_id,
      vehicleId: b.vehicle_id,
      customerNote: b.customer_note,
      internalNote: b.internal_note,
      createdAt: iso(b.created_at),
      requestedServiceSnapshots: snapshots.map((s) => ({
        id: s.service_id,
        name: s.service_name_snapshot,
        planRevision: s.plan_revision,
        plan: s.plan_snapshot,
        catalogVersion: s.catalog_version,
      })),
      reservation: reservation ? reservationView(reservation) : null,
      allowedActions: actions,
      lastContactOutcome: b.last_contact_outcome,
    };
  }
  async validAdvisor(c: Conn, ctx: Context, id: string) {
    const advisor = await one(
      c,
      sql`SELECT s.id FROM staff_profiles s JOIN users u ON u.id=s.user_id JOIN user_roles r ON r.user_id=u.id WHERE s.id=${id} AND s.station_id=${ctx.station.id} AND s.active AND u.status='ACTIVE' AND NOT u.must_change_password AND r.role_code='ADVISOR'`,
    );
    if (!advisor) fail(422, "ADVISOR_UNAVAILABLE");
  }
  async snapshotServices(c: Conn, bookingId: string): Promise<ServicePlan[]> {
    const data = await rows(
      c,
      sql`SELECT * FROM booking_services WHERE booking_id=${bookingId} ORDER BY sequence_no`,
    );
    return data.map((s) => ({
      id: s.service_id,
      name: s.service_name_snapshot,
      planRevision: s.plan_revision,
      requirements: s.plan_snapshot.requirements || [],
      estimatedDurationMinutes: s.plan_snapshot.estimatedDurationMinutes,
    }));
  }
  async saveServices(
    c: Conn,
    ctx: Context,
    bookingId: string,
    plans: ServicePlan[],
  ) {
    await c.execute(
      sql`DELETE FROM booking_services WHERE booking_id=${bookingId}`,
    );
    for (const [i, s] of plans.entries())
      await c.execute(
        sql`INSERT INTO booking_services(booking_id,service_id,sequence_no,service_name_snapshot,plan_revision,plan_snapshot,catalog_version) VALUES(${bookingId},${s.id},${i},${s.name},${s.planRevision},${json({ requirements: s.requirements, estimatedDurationMinutes: s.estimatedDurationMinutes })},${ctx.station.catalog_version})`,
      );
  }
  async create(
    c: Conn,
    ctx: Context,
    input: Row,
    publicInput = false,
    publicSource = "WEBSITE",
  ) {
    if (!ctx.station.booking_enabled)
      fail(
        503,
        "BOOKING_NOT_CONFIGURED",
        "Trạm hiện chưa mở nhận lịch trực tuyến.",
      );
    if (
      input.notice.privacyNoticeVersion !== ctx.station.privacy_notice_version
    )
      fail(409, "NOTICE_VERSION_CONFLICT");
    if (input.notice.marketingConsent && !ctx.station.marketing_notice_version)
      fail(422, "MARKETING_NOT_AVAILABLE");
    const plans = await this.capacity.servicePlans(
      c,
      ctx,
      input.serviceIds,
      input.catalogVersion,
    );
    // Public requests carry only day + period: no slot check, no limit; staff entries get warnings.
    const byPeriod = publicInput || !!input.requestedPeriod;
    if (!publicInput && input.confirmNow) permission(ctx, "booking.confirm");
    const requestedAt = byPeriod
      ? await this.capacity.periodStart(
          c,
          ctx,
          input.requestedDate,
          input.requestedPeriod,
        )
      : new Date(input.requestedStartAt);
    const allocated = await this.capacity.allocate(
      c,
      ctx,
      plans,
      requestedAt,
      publicInput ? ctx.station.configuration_version : input.policyVersion,
      undefined,
      byPeriod,
    );
    const advisorId = publicInput
      ? null
      : ctx.actor!.role === "ADVISOR"
        ? ctx.actor!.staffId
        : input.advisorId || null;
    if (
      !publicInput &&
      ctx.actor!.role === "ADVISOR" &&
      input.advisorId !== undefined
    )
      fail(403, "FORBIDDEN");
    if (advisorId) await this.validAdvisor(c, ctx, advisorId);
    if (input.confirmNow && !advisorId) fail(422, "ADVISOR_REQUIRED");
    const customer = await this.directory.contact(
        c,
        ctx,
        input.customer,
        publicInput,
      ),
      vehicle = await this.directory.bookingVehicle(
        c,
        ctx,
        input.vehicle,
        customer.id,
        publicInput,
      );
    const counter = (await one(
      c,
      sql`
      INSERT INTO booking_daily_counters(day,last_value)
      VALUES((${ctx.now}::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,1)
      ON CONFLICT(day) DO UPDATE SET last_value=booking_daily_counters.last_value+1
      RETURNING to_char(day,'DDMMYYYY') AS date_code,last_value
    `,
    ))!;
    const id = randomUUID(),
      code = `DP-DV${counter.date_code}-${String(counter.last_value).padStart(3, "0")}`;
    const b = await one(
      c,
      sql`INSERT INTO bookings(id,station_id,code,customer_id,vehicle_id,contact_snapshot,vehicle_snapshot,requested_start_at,scheduled_start_at,requested_period,original_requested_period,confirmed_start_at,status,source,assigned_advisor_id,customer_note,internal_note,created_by)
      VALUES(${id},${ctx.station.id},${code},${customer.id},${vehicle?.id || null},${json({ name: customer.name, phone: customer.phone_normalized })},${vehicle ? json({ model: vehicle.model, plate: vehicle.plate_normalized, year: vehicle.model_year }) : sql`NULL`},${requestedAt},${requestedAt},${byPeriod ? input.requestedPeriod : null},${byPeriod ? input.requestedPeriod : null},${input.confirmNow ? requestedAt : null},${input.confirmNow ? "CONFIRMED" : "PENDING"},${publicInput ? publicSource : input.source},${advisorId},${input.note || input.customerNote || null},${publicInput ? null : input.internalNote || null},${ctx.actor?.userId || null}) RETURNING *`,
    );
    await this.saveServices(c, ctx, id, plans);
    const reservation = await this.capacity.persist(c, ctx, id, allocated);
    if (advisorId)
      await c.execute(
        sql`INSERT INTO booking_assignments(booking_id,advisor_id,assigned_by,assigned_at,reason) VALUES(${id},${advisorId},${ctx.actor!.userId},${ctx.now},'CREATED')`,
      );
    await c.execute(
      sql`INSERT INTO consents(customer_id,booking_id,type,notice_version,granted,source,recorded_by) VALUES(${customer.id},${id},'SERVICE_NOTICE_ACK',${input.notice.privacyNoticeVersion},true,${publicInput ? "PUBLIC" : "STAFF"},${ctx.actor?.userId || null})`,
    );
    if (ctx.station.marketing_notice_version)
      await c.execute(
        sql`INSERT INTO consents(customer_id,booking_id,type,notice_version,granted,source,recorded_by) VALUES(${customer.id},${id},'MARKETING',${ctx.station.marketing_notice_version},${input.notice.marketingConsent},${publicInput ? "PUBLIC" : "STAFF"},${ctx.actor?.userId || null})`,
      );
    let eventId = await event(c, ctx, id, "BOOKING_CREATED", undefined, {
      status: b!.status,
    });
    if (input.confirmNow) {
      await c.execute(
        sql`INSERT INTO booking_contact_events(booking_id,actor_user_id,channel,outcome,proposed_start_at,customer_accepted,contacted_at) VALUES(${id},${ctx.actor!.userId},'OTHER','AGREED',${requestedAt},true,${ctx.now})`,
      );
      await c.execute(
        sql`UPDATE bookings SET last_contact_outcome='AGREED' WHERE id=${id}`,
      );
      eventId = await event(
        c,
        ctx,
        id,
        "BOOKING_CONFIRM",
        "Tạo và xác nhận giờ hẹn đã thống nhất với khách",
        {
          fromStatus: "PENDING",
          toStatus: "CONFIRMED",
          newStartAt: iso(requestedAt),
        },
      );
    }
    return publicInput
      ? {
          bookingId: id,
          bookingCode: code,
          status: "PENDING",
          requestedDate: input.requestedDate,
          requestedPeriod: input.requestedPeriod,
          version: 1,
        }
      : receipt(b!, reservation, eventId, [
          ...allocated.warnings,
          ...(await this.conflicts(c, ctx, b!)),
        ]);
  }
  async mutate(c: Conn, ctx: Context, id: string, action: string, input: Row) {
    const b = await scopedBooking(c, ctx, id, true);
    expectVersion(b, input.expectedVersion);
    if (!["PENDING", "CONFIRMED"].includes(b.status))
      fail(409, "INVALID_TRANSITION");
    let hold = await one(
      c,
      sql`SELECT * FROM capacity_reservations WHERE booking_id=${id} AND status='ACTIVE'`,
    );
    if (!hold) fail(409, "RESERVATION_MISSING");
    let next = { ...b },
      warnings: string[] = [];
    const advisorActor = ctx.actor!.role === "ADVISOR";
    if (advisorActor && input.advisorId !== undefined) fail(403, "FORBIDDEN");
    // A failed contact stays in the shared queue; confirmation claims it atomically.
    const claimer = b.assigned_advisor_id
      ? null
      : advisorActor && action !== "contact-events"
        ? ctx.actor!.staffId
        : action === "confirm"
          ? input.advisorId
          : null;
    if (claimer && !["assign", "transfer"].includes(action)) {
      await this.validAdvisor(c, ctx, claimer);
      await c.execute(
        sql`INSERT INTO booking_assignments(booking_id,advisor_id,assigned_by,assigned_at,reason) VALUES(${id},${claimer},${ctx.actor!.userId},${ctx.now},'CLAIMED')`,
      );
      next.assigned_advisor_id = claimer;
    }
    if (action === "edit") {
      if (input.customerContact)
        next.contact_snapshot = {
          name: input.customerContact.name,
          phone: input.customerContact.phone,
        };
      if (input.customerNote !== undefined)
        next.customer_note = input.customerNote;
      if (input.internalNote !== undefined)
        next.internal_note = input.internalNote;
      if (input.vehicle !== undefined) {
        const v = await this.directory.bookingVehicle(
          c,
          ctx,
          input.vehicle,
          b.customer_id,
        );
        next.vehicle_id = v?.id || null;
        next.vehicle_snapshot = v
          ? { model: v.model, plate: v.plate_normalized, year: v.model_year }
          : null;
      }
      if (input.serviceIds) {
        if (!input.catalogVersion || !input.policyVersion)
          fail(422, "VALIDATION_FAILED");
        const plans = await this.capacity.servicePlans(
          c,
          ctx,
          input.serviceIds,
          input.catalogVersion,
        );
        const allocated = await this.capacity.allocate(
          c,
          ctx,
          plans,
          b.scheduled_start_at,
          input.policyVersion,
          hold.id,
        );
        hold = await this.capacity.persist(c, ctx, id, allocated, hold);
        warnings = allocated.warnings;
        await this.saveServices(c, ctx, id, plans);
      }
    } else if (action === "confirm" || action === "reschedule") {
      if (action === "confirm" && b.status !== "PENDING")
        fail(409, "INVALID_TRANSITION");
      if (action === "confirm") {
        if (!next.assigned_advisor_id) fail(422, "ADVISOR_REQUIRED");
        if (!claimer) await this.validAdvisor(c, ctx, next.assigned_advisor_id);
      }
      // A pending request may move to another day/period; otherwise an exact time is set.
      const byPeriod = action === "reschedule" && !!input.requestedPeriod;
      if (byPeriod && b.status !== "PENDING") fail(409, "INVALID_TRANSITION");
      const at = byPeriod
        ? await this.capacity.periodStart(
            c,
            ctx,
            input.requestedDate,
            input.requestedPeriod,
          )
        : new Date(
            action === "confirm" ? input.confirmedStartAt : input.newStartAt,
          );
      if (+at <= +ctx.now) fail(422, "OUTSIDE_BOOKING_WINDOW");
      if (
        action === "reschedule" &&
        +at === +b.scheduled_start_at &&
        (!byPeriod || input.requestedPeriod === b.requested_period)
      )
        fail(422, "TIME_UNCHANGED");
      const plans = await this.snapshotServices(c, id),
        allocated = await this.capacity.allocate(
          c,
          ctx,
          plans,
          at,
          input.policyVersion ?? ctx.station.configuration_version,
          hold.id,
          byPeriod,
        );
      if (+at !== +b.scheduled_start_at) {
        hold = await this.capacity.persist(c, ctx, id, allocated, hold);
        next.scheduled_start_at = at;
        next.change_kind = "RESCHEDULED";
      }
      if (action === "reschedule")
        next.requested_period = byPeriod ? input.requestedPeriod : null;
      warnings = allocated.warnings;
      if (action === "confirm") {
        next.status = "CONFIRMED";
        next.confirmed_start_at = at;
        if (input.internalNote)
          next.internal_note = [b.internal_note, input.internalNote]
            .filter(Boolean)
            .join("\n");
      } else if (b.status === "CONFIRMED") next.confirmed_start_at = at;
      await c.execute(
        sql`INSERT INTO booking_contact_events(booking_id,actor_user_id,channel,outcome,proposed_start_at,customer_accepted,note_internal,contacted_at) VALUES(${id},${ctx.actor!.userId},'OTHER','AGREED',${at},true,${input.internalNote || input.reason || null},${ctx.now})`,
      );
      next.last_contact_outcome = "AGREED";
    } else if (action === "cancel" || action === "no-show") {
      if (action === "no-show") {
        if (b.status !== "CONFIRMED") fail(409, "INVALID_TRANSITION");
        const p = await this.capacity.policy(
          c,
          ctx.station.id,
          b.scheduled_start_at,
        );
        if (+ctx.now < +b.scheduled_start_at + p.no_show_grace_minutes * 60000)
          fail(422, "TOO_EARLY");
        next.status = "NO_SHOW";
      } else {
        next.status = "CANCELLED";
        next.cancelled_at = ctx.now;
        next.cancel_reason = input.reason;
        next.change_kind = "CANCELLED";
      }
      await this.capacity.release(c, ctx, hold.id, action.toUpperCase());
      hold = { ...hold, status: "RELEASED" };
    } else if (action === "assign" || action === "transfer") {
      if (ctx.actor!.role !== "MANAGER") fail(403, "FORBIDDEN");
      const to = input.advisorId || input.toAdvisorId;
      await this.validAdvisor(c, ctx, to);
      if (action === "assign" && b.assigned_advisor_id)
        fail(409, "ALREADY_ASSIGNED");
      if (action === "transfer" && !b.assigned_advisor_id)
        fail(409, "INVALID_TRANSITION");
      if (to === b.assigned_advisor_id) fail(409, "SAME_ADVISOR");
      if (b.assigned_advisor_id) {
        const assignment = await one(
          c,
          sql`SELECT * FROM booking_assignments WHERE booking_id=${id} AND ended_at IS NULL`,
        );
        if (!assignment) fail(409, "ASSIGNMENT_MISSING");
        const services = await this.snapshotServices(c, id),
          ended = new Date(Math.max(+ctx.now, +assignment.assigned_at + 1));
        await c.execute(
          sql`UPDATE booking_assignments SET ended_at=${ended},historical_snapshot=${json({ bookingCode: b.code, serviceNames: services.map((s) => s.name), startAt: iso(b.scheduled_start_at), status: b.status })} WHERE id=${assignment.id}`,
        );
      }
      await c.execute(
        sql`INSERT INTO booking_assignments(booking_id,advisor_id,assigned_by,assigned_at,reason) VALUES(${id},${to},${ctx.actor!.userId},${ctx.now},${input.reason})`,
      );
      next.assigned_advisor_id = to;
    } else if (action === "contact-events") {
      if (input.callbackAt && +new Date(input.callbackAt) <= +ctx.now)
        fail(
          422,
          "INVALID_CALLBACK_TIME",
          "Chọn thời điểm gọi lại trong tương lai.",
        );
      const contact = await one(
        c,
        sql`INSERT INTO booking_contact_events(booking_id,actor_user_id,channel,outcome,proposed_start_at,customer_accepted,note_internal,contacted_at,callback_at) VALUES(${id},${ctx.actor!.userId},${input.channel},${input.outcome},${input.proposedStartAt ? new Date(input.proposedStartAt) : null},${input.customerAccepted ?? null},${input.note || null},${ctx.now},${input.callbackAt ? new Date(input.callbackAt) : null}) RETURNING id`,
      );
      next.last_contact_outcome = input.outcome;
      next.contactEventId = contact!.id;
    } else fail(404, "NOT_FOUND");
    next.version = b.version + 1;
    await c.execute(
      sql`UPDATE bookings SET contact_snapshot=${json(next.contact_snapshot)},vehicle_id=${next.vehicle_id},vehicle_snapshot=${next.vehicle_snapshot ? json(next.vehicle_snapshot) : sql`NULL`},scheduled_start_at=${next.scheduled_start_at},requested_period=${next.requested_period},confirmed_start_at=${next.confirmed_start_at},status=${next.status},assigned_advisor_id=${next.assigned_advisor_id},customer_note=${next.customer_note},internal_note=${next.internal_note},change_kind=${next.change_kind},cancelled_at=${next.cancelled_at},cancel_reason=${next.cancel_reason},last_contact_outcome=${next.last_contact_outcome},version=${next.version},updated_at=${ctx.now} WHERE id=${id}`,
    );
    const eventId = await event(
      c,
      ctx,
      id,
      "BOOKING_" + action.toUpperCase().replace(/-/g, "_"),
      input.reason,
      {
        fromStatus: b.status,
        toStatus: next.status,
        oldStartAt: iso(b.scheduled_start_at),
        newStartAt: iso(next.scheduled_start_at),
      },
    );
    if (
      next.status === "CONFIRMED" &&
      ["confirm", "reschedule", "assign", "transfer", "edit"].includes(action)
    )
      warnings.push(...(await this.conflicts(c, ctx, next)));
    return action === "contact-events"
      ? {
          bookingId: id,
          contactEventId: next.contactEventId,
          version: next.version,
          eventId,
        }
      : receipt(next, hold!, eventId, warnings);
  }
  async conflicts(c: Conn, ctx: Context, b: Row, endAt?: Date) {
    if (!b.assigned_advisor_id) return [];
    const hold = endAt
      ? null
      : await one(
          c,
          sql`SELECT end_at FROM capacity_reservations WHERE booking_id=${b.id} AND status='ACTIVE' ORDER BY generation DESC LIMIT 1`,
        );
    const end =
      endAt || hold?.end_at || new Date(+b.scheduled_start_at + 15 * 60000);
    const clash = await one(
      c,
      sql`SELECT 1 FROM bookings other JOIN capacity_reservations r ON r.booking_id=other.id AND r.status='ACTIVE'
      WHERE other.station_id=${ctx.station.id} AND other.assigned_advisor_id=${b.assigned_advisor_id} AND other.status='CONFIRMED'
      AND other.scheduled_start_at<${end} AND r.end_at>${b.scheduled_start_at} AND other.id<>${b.id} LIMIT 1`,
    );
    return clash ? ["ADVISOR_TIME_CONFLICT"] : [];
  }
  async preview(c: Conn, ctx: Context, id: string, input: Row) {
    permission(
      ctx,
      input.action === "confirm" ? "booking.confirm" : "booking.reschedule",
    );
    const b = await scopedBooking(c, ctx, id);
    expectVersion(b, input.expectedVersion);
    if (
      !["PENDING", "CONFIRMED"].includes(b.status) ||
      (input.action === "confirm" && b.status !== "PENDING")
    )
      fail(409, "INVALID_TRANSITION");
    if (ctx.actor!.role === "ADVISOR" && input.advisorId !== undefined)
      fail(403, "FORBIDDEN");
    const advisor =
      b.assigned_advisor_id ||
      (ctx.actor!.role === "ADVISOR" ? ctx.actor!.staffId : input.advisorId);
    if (input.action === "confirm" && !advisor) fail(422, "ADVISOR_REQUIRED");
    if (advisor) await this.validAdvisor(c, ctx, advisor);
    const hold = await one(
      c,
      sql`SELECT id FROM capacity_reservations WHERE booking_id=${id} AND status='ACTIVE'`,
    );
    if (!hold) fail(409, "RESERVATION_MISSING");
    const at = new Date(input.startAt);
    const result = await this.capacity.allocate(
      c,
      ctx,
      await this.snapshotServices(c, id),
      at,
      ctx.station.configuration_version,
      hold.id,
    );
    return {
      warnings: [
        ...result.warnings,
        ...(await this.conflicts(
          c,
          ctx,
          { ...b, assigned_advisor_id: advisor, scheduled_start_at: at },
          new Date(result.plan.end),
        )),
      ],
    };
  }
  async previewCreate(c: Conn, ctx: Context, input: Row) {
    if (ctx.actor!.role === "ADVISOR" && input.advisorId !== undefined)
      fail(403, "FORBIDDEN");
    const advisor =
      ctx.actor!.role === "ADVISOR" ? ctx.actor!.staffId : input.advisorId;
    if (advisor) await this.validAdvisor(c, ctx, advisor);
    const at = new Date(input.startAt);
    const result = await this.capacity.allocate(
      c,
      ctx,
      await this.capacity.servicePlans(
        c,
        ctx,
        input.serviceIds,
        input.catalogVersion,
      ),
      at,
      ctx.station.configuration_version,
    );
    return {
      warnings: [
        ...result.warnings,
        ...(await this.conflicts(
          c,
          ctx,
          {
            id: randomUUID(),
            assigned_advisor_id: advisor,
            scheduled_start_at: at,
          },
          new Date(result.plan.end),
        )),
      ],
    };
  }
  async events(c: Conn, ctx: Context, id: string, q: Row) {
    const current = await one(
      c,
      sql`SELECT id FROM bookings b WHERE b.id=${id} AND ${scope(ctx)}`,
    );
    if (
      !current &&
      !(await one(
        c,
        sql`SELECT id FROM booking_assignments WHERE booking_id=${id} AND advisor_id=${ctx.actor!.staffId} AND ended_at IS NOT NULL LIMIT 1`,
      ))
    )
      fail(404, "NOT_FOUND");
    const result = await page(
      c,
      this.config,
      ctx,
      sql`SELECT e.id,e.type,e.actor_user_id,e.occurred_at,e.reason,e.after_data,s.name AS actor_name,e.occurred_at AS cursor_key FROM booking_events e LEFT JOIN staff_profiles s ON s.user_id=e.actor_user_id WHERE e.booking_id=${id}
      ${current ? sql`` : sql`AND e.actor_user_id=${ctx.actor!.userId} AND EXISTS(SELECT 1 FROM booking_assignments a WHERE a.booking_id=e.booking_id AND a.advisor_id=${ctx.actor!.staffId} AND a.ended_at IS NOT NULL AND e.occurred_at>=a.assigned_at AND e.occurred_at<a.ended_at)`}`,
      q,
      "occurredAt:asc",
    );
    return {
      data: result.items.map((e) => ({
        id: e.id,
        eventType: e.type,
        actor: e.actor_user_id
          ? { id: e.actor_user_id, name: e.actor_name }
          : "SYSTEM",
        occurredAt: iso(e.occurred_at),
        reason: current ? e.reason : null,
        summary: e.type,
        ...(current
          ? {
              fromStatus: e.after_data?.fromStatus,
              toStatus: e.after_data?.toStatus,
              oldStartAt: e.after_data?.oldStartAt,
              newStartAt: e.after_data?.newStartAt,
            }
          : {}),
      })),
      page: result.page,
    };
  }
  async history(c: Conn, ctx: Context, q: Row) {
    if (ctx.actor!.role !== "ADVISOR") fail(403, "FORBIDDEN");
    const dates = range(q.from, q.to);
    const result = await page(
      c,
      this.config,
      ctx,
      sql`SELECT a.*,a.assigned_at AS cursor_key,(SELECT count(*)::int FROM booking_events e WHERE e.booking_id=a.booking_id AND e.actor_user_id=${ctx.actor!.userId} AND e.occurred_at>=a.assigned_at AND e.occurred_at<a.ended_at) AS own_count FROM booking_assignments a WHERE a.advisor_id=${ctx.actor!.staffId} AND a.ended_at IS NOT NULL AND a.assigned_at>=${dates.from} AND a.assigned_at<${dates.to} ${q.q ? sql`AND a.historical_snapshot->>'bookingCode' ILIKE ${"%" + q.q + "%"}` : sql``}`,
      q,
      "assignedAt:desc",
      true,
    );
    return {
      data: result.items.map((a) => ({
        bookingId: a.booking_id,
        bookingCode: a.historical_snapshot.bookingCode,
        assignmentId: a.id,
        assignedAt: iso(a.assigned_at),
        endedAt: iso(a.ended_at),
        serviceNames: a.historical_snapshot.serviceNames,
        startAtSnapshot: a.historical_snapshot.startAt,
        statusAtTransfer: a.historical_snapshot.status,
        ownEventCount: a.own_count,
        ownEventsUrl: "/api/v1/admin/bookings/" + a.booking_id + "/events",
      })),
      page: result.page,
    };
  }
  async dashboard(c: Conn, ctx: Context, q: Row) {
    const condition = this.filter(ctx, { from: q.date, to: q.date }),
      counts = await this.counts(c, ctx, condition);
    const upcoming = await rows(
      c,
      sql`SELECT b.* FROM bookings b WHERE ${condition} AND b.status IN ('PENDING','CONFIRMED') AND b.scheduled_start_at>=${ctx.now} ORDER BY b.scheduled_start_at,b.id LIMIT 5`,
    );
    return {
      date: q.date,
      timezone: "Asia/Ho_Chi_Minh",
      asOf: iso(ctx.now),
      counts,
      upcoming: await Promise.all(upcoming.map((b) => this.summary(c, b))),
      canManageQueue: ctx.actor!.role === "MANAGER",
    };
  }
}
const reservationView = (r: Row) => ({
  id: r.id,
  status: r.status,
  startAt: iso(r.start_at),
  endAt: iso(r.end_at),
  policyVersion: r.policy_version,
});
function receipt(b: Row, r: Row, eventId: string, warnings: string[] = []) {
  return {
    bookingId: b.id,
    bookingCode: b.code,
    status: b.status,
    requestedStartAt: iso(b.requested_start_at),
    requestedPeriod: b.requested_period ?? null,
    scheduledStartAt: iso(b.scheduled_start_at),
    confirmedStartAt: b.confirmed_start_at ? iso(b.confirmed_start_at) : null,
    reservation: {
      status: r.status,
      startAt: iso(r.start_at),
      endAt: iso(r.end_at),
    },
    version: b.version,
    eventId,
    warnings,
  };
}
