import { randomUUID } from "node:crypto";
import type { Config } from "./config";
import { createHash } from "node:crypto";
import { sql, one, rows, json, type Conn, type Row } from "./database";
import {
  fail,
  scope,
  scopedVisit,
  scopedBooking,
  expectVersion,
  audit,
  event,
  iso,
  day,
  midnight,
  range,
  page,
  manager,
  phone as phoneSchema,
  type Context,
} from "./common";
import { Bookings } from "./bookings";
import { Directory } from "./directory";
const ticketStageSql = sql`CASE
  WHEN v.workflow_version=2 THEN v.stage
  WHEN v.stage IN ('HANDED_OVER','COMPLETED','ABORTED','READY','QUALITY_CHECK') THEN v.stage
  WHEN v.stage='IN_PROGRESS' AND tw.status='PAUSED' AND
    (SELECT a.result FROM acceptances a WHERE a.visit_id=v.id ORDER BY a.checked_at DESC,a.id DESC LIMIT 1)='NEEDS_WORK' THEN 'REWORK'
  WHEN v.stage='IN_PROGRESS' AND tw.status='PAUSED' THEN 'PAUSED'
  WHEN v.stage='IN_PROGRESS' THEN 'IN_PROGRESS'
  WHEN v.stage='INSPECTED' AND tw.status='NOT_STARTED'
    AND (EXISTS(SELECT 1 FROM quote_revisions r WHERE r.visit_id=v.id AND r.status='APPROVED')
      OR EXISTS(SELECT 1 FROM work_exemptions e WHERE e.visit_id=v.id AND e.mode='NO_QUOTE_FREE'))
    AND NOT EXISTS(SELECT 1 FROM quote_revisions r WHERE r.visit_id=v.id AND r.status IN ('DRAFT','SUBMITTED')) THEN 'WAITING_WORK'
  ELSE 'QUOTE' END`;
const serviceStageSql=sql`CASE (${ticketStageSql}) WHEN 'QUOTE' THEN 'QUOTING' WHEN 'WAITING_WORK' THEN 'WAITING_FOR_WORK' WHEN 'QUALITY_CHECK' THEN 'IN_PROGRESS' WHEN 'PAUSED' THEN 'IN_PROGRESS' WHEN 'REWORK' THEN 'IN_PROGRESS' WHEN 'READY' THEN 'HANDOVER' WHEN 'HANDED_OVER' THEN 'COMPLETED' ELSE (${ticketStageSql}) END`;
import { Capacity, type ServicePlan } from "./capacity/capacity";

export class Visits {
  constructor(
    readonly config: Config,
    readonly bookings: Bookings,
    readonly directory: Directory,
    readonly capacity: Capacity,
  ) {}

  async log(
    c: Conn,
    ctx: Context,
    id: string,
    type: string,
    reason?: string,
    data: Row = {},
  ) {
    const e = await one(
      c,
      sql`INSERT INTO visit_events(visit_id,actor_user_id,type,occurred_at,reason,data) VALUES(${id},${ctx.actor!.userId},${type},${ctx.now},${reason || null},${json(data)}) RETURNING id`,
    );
    await audit(c, ctx, type, "visit", id, reason);
    await c.execute(
      sql`INSERT INTO outbox_jobs(event_key,kind,aggregate_type,aggregate_id,payload) VALUES(${e!.id},'VISIT_EVENT','visit',${id},${json({ visitId: id, type })})`,
    );
    return e!.id as string;
  }
  receipt(v: Row, eventId?: string) {
    return {
      visitId: v.id,
      code: v.code,
      bookingId: v.booking_id,
      stage: v.stage,
      version: v.version,
      ...(eventId ? { eventId } : {}),
    };
  }
  async summary(c: Conn, v: Row) {
    const advisor = await one(
      c,
      sql`SELECT id,name FROM staff_profiles WHERE id=${v.assigned_advisor_id}`,
    );
    const services = await rows(
      c,
      sql`SELECT service_id AS id,service_name_snapshot AS name FROM visit_services WHERE visit_id=${v.id} ORDER BY sequence_no`,
    );
    const work = await one(
      c,
      sql`SELECT w.status,w.due_at,(SELECT count(*)::int FROM work_items i WHERE i.work_order_id=w.id AND i.status<>'SKIPPED') AS total,(SELECT count(*)::int FROM work_items i WHERE i.work_order_id=w.id AND i.status='DONE') AS done,ARRAY(SELECT DISTINCT s.name FROM work_item_assignments a JOIN work_items i ON i.id=a.work_item_id JOIN staff_profiles s ON s.id=a.technician_id WHERE i.work_order_id=w.id AND a.ended_at IS NULL ORDER BY s.name) AS technicians FROM work_orders w WHERE w.visit_id=${v.id}`,
    );
    const pricing = await one(
      c,
      sql`SELECT
      (SELECT sum(COALESCE(r.approved_total,r.total))::text FROM quote_revisions r WHERE r.visit_id=${v.id} AND r.status='APPROVED') AS approved_total,
      (SELECT r.total::text FROM quote_revisions r WHERE r.visit_id=${v.id} AND r.status IN ('DRAFT','SUBMITTED','PENDING_APPROVAL') AND EXISTS(SELECT 1 FROM quote_lines l WHERE l.revision_id=r.id) ORDER BY r.revision_no DESC LIMIT 1) AS estimate_total,
      EXISTS(SELECT 1 FROM quote_revisions r WHERE r.visit_id=${v.id} AND r.status IN ('DRAFT','SUBMITTED','PENDING_APPROVAL')) AS has_open_quote,
      EXISTS(SELECT 1 FROM work_exemptions e WHERE e.visit_id=${v.id} AND e.mode='NO_QUOTE_FREE') AS has_exemption,
      COALESCE((SELECT sum(amount) FROM obligation_credits WHERE visit_id=${v.id}),0)::text AS credits`,
    );
    return {
      id: v.id,
      code: v.code,
      bookingId: v.booking_id,
      customerId: v.customer_id,
      vehicleId: v.vehicle_id,
      origin: v.origin,
      workflowVersion: v.workflow_version,
      isPaused: v.is_paused,
      pauseReason: v.pause_reason,
      pausedAt: v.paused_at ? iso(v.paused_at) : null,
      stage: v.stage,
      canDelete: !v.deleted_at,
      deleteBlockedReason: null,
      ...(v.ticket_stage ? { ticketStage: v.ticket_stage } : {}),
      pricing: {
        approvedTotal: pricing!.approved_total,
        estimateTotal: pricing!.estimate_total,
        payableTotal:
          pricing!.approved_total !== null
            ? (
                BigInt(pricing!.approved_total) - BigInt(pricing!.credits)
              ).toString()
            : pricing!.has_exemption
              ? "0"
              : null,
        hasOpenQuote: pricing!.has_open_quote,
        hasExemption: pricing!.has_exemption,
      },
      receivedAt: iso(v.received_at),
      version: v.version,
      customer: v.contact_snapshot,
      vehicle: { id: v.vehicle_id, ...v.vehicle_snapshot },
      assignedAdvisor: advisor,
      services,
      work: work
        ? {
            status: work.status,
            dueAt: work.due_at ? iso(work.due_at) : null,
            total: work.total,
            done: work.done,
            technicians: work.technicians,
          }
        : null,
    };
  }
  async list(c: Conn, ctx: Context, q: Row) {
    if (
      ctx.actor!.role === "ADVISOR" &&
      q.advisorId &&
      q.advisorId !== ctx.actor!.staffId
    )
      fail(403, "FORBIDDEN");
    const dates = q.from ? range(q.from, q.to) : null;
    const searchedPhone = phoneSchema.safeParse(q.q);
    const result = await page(
      c,
      this.config,
      ctx,
      sql`SELECT v.*,${ticketStageSql} AS ticket_stage,v.received_at AS cursor_key FROM service_visits v LEFT JOIN work_orders tw ON tw.visit_id=v.id WHERE ${scope(ctx, "v")}
      ${dates ? sql`AND v.received_at>=${dates.from} AND v.received_at<${dates.to}` : sql``}
      ${q.stage ? ["QUOTING","WAITING_FOR_WORK","HANDOVER","COMPLETED","IN_PROGRESS"].includes(q.stage) ? sql`AND ${serviceStageSql}=${q.stage}` : sql`AND v.stage=${q.stage}` : sql``} ${q.advisorId ? sql`AND v.assigned_advisor_id=${q.advisorId}` : sql``}
      ${q.activeOnly ? sql`AND v.stage NOT IN ('HANDED_OVER','COMPLETED','ABORTED')` : sql``}
      ${q.ticketStage ? ["QUOTING","WAITING_FOR_WORK","HANDOVER","COMPLETED","IN_PROGRESS"].includes(q.ticketStage) ? sql`AND ${serviceStageSql}=${q.ticketStage}` : q.ticketStage==="PAUSED" ? sql`AND (v.is_paused OR ${ticketStageSql}='PAUSED')` : sql`AND ${ticketStageSql}=${q.ticketStage}` : sql``}
      ${q.bookingId ? sql`AND v.booking_id=${q.bookingId}` : sql``} ${q.customerId ? sql`AND v.customer_id=${q.customerId}` : sql``}
      ${q.vehicleId ? sql`AND v.vehicle_id=${q.vehicleId}` : sql``}
      ${q.q ? sql`AND (v.code ILIKE ${"%" + q.q + "%"} OR v.contact_snapshot->>'name' ILIKE ${"%" + q.q + "%"} OR v.contact_snapshot->>'phone' LIKE ${"%" + (searchedPhone.success ? searchedPhone.data : q.q.replace(/[\s().-]/g, "")) + "%"} OR v.vehicle_snapshot->>'plate' ILIKE ${"%" + q.q + "%"} OR v.vehicle_snapshot->>'model' ILIKE ${"%" + q.q + "%"})` : sql``}`,
      q,
      "receivedAt:desc",
      true,
    );
    const data = [];
    for (const v of result.items) data.push(await this.summary(c, v));
    return { data, page: result.page };
  }
  async detail(c: Conn, ctx: Context, id: string) {
    const v = await scopedVisit(c, ctx, id);
    const media = await rows(
      c,
      sql`SELECT id,name,uploaded_at FROM visit_media WHERE visit_id=${id} AND deleted_at IS NULL ORDER BY uploaded_at,id`,
    );
    const hold = await one(
      c,
      sql`SELECT id,start_at,end_at,status FROM capacity_reservations WHERE visit_id=${id} AND status='ACTIVE'`,
    );
    const inspection = await one(
      c,
      sql`SELECT occurred_at FROM visit_events WHERE visit_id=${id} AND type='VISIT_INSPECT' ORDER BY occurred_at,id LIMIT 1`,
    );
    return {
      ...(await this.summary(c, v)),
      intake: {
        request: v.request,
        odometer: v.odometer,
        odometerMissingReason: v.odometer_missing_reason,
        plateMissingReason: v.plate_missing_reason,
        conditions: v.conditions,
        receptionNote: v.reception_note,
      },
      followUpOfVisitId: v.follow_up_of_visit_id,
      followUpReason: v.follow_up_reason,
      media: media.map((m) => ({
        id: m.id,
        name: m.name,
        uploadedAt: iso(m.uploaded_at),
      })),
      reservation: hold
        ? {
            id: hold.id,
            startAt: iso(hold.start_at),
            endAt: iso(hold.end_at),
            status: hold.status,
          }
        : null,
      progress: {
        receivedAt: iso(v.received_at),
        inspectionCompleted: !!inspection,
      },
      allowedActions: !["HANDED_OVER", "COMPLETED", "ABORTED"].includes(v.stage)
        ? [
            "edit_intake",
            "contact",
            ...(v.stage === "RECEIVED" ? ["inspect"] : []),
            ...(ctx.actor!.role === "MANAGER" ? ["transfer"] : []),
          ]
        : [],
    };
  }
  async photoBytes(dataUrl: string) {
    const encoded = dataUrl.slice("data:image/jpeg;base64,".length),
      bytes = Buffer.from(encoded, "base64");
    if (
      bytes.length > 204800 ||
      bytes.length < 4 ||
      bytes.toString("base64") !== encoded ||
      bytes.readUInt16BE(0) !== 0xffd8 ||
      bytes.readUInt16BE(bytes.length - 2) !== 0xffd9
    )
      fail(422, "INVALID_IMAGE", "Ảnh phải là JPEG, tối đa 200 KB.");
    let offset = 2,
      sized = false;
    // Inspect JPEG marker lengths and dimensions before storing an opaque private image.
    while (offset < bytes.length - 2) {
      if (bytes[offset++] !== 0xff) fail(422, "INVALID_IMAGE");
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xda) break;
      if (
        marker === 0xd8 ||
        marker === 0xd9 ||
        marker === 0x00 ||
        offset + 2 > bytes.length
      )
        fail(422, "INVALID_IMAGE");
      const length = bytes.readUInt16BE(offset);
      if (length < 2 || offset + length > bytes.length)
        fail(422, "INVALID_IMAGE");
      if ([0xc0, 0xc1, 0xc2].includes(marker)) {
        if (length < 8) fail(422, "INVALID_IMAGE");
        const h = bytes.readUInt16BE(offset + 3),
          w = bytes.readUInt16BE(offset + 5);
        if (!w || !h || w > 4096 || h > 4096 || w * h > 12000000)
          fail(422, "INVALID_IMAGE");
        sized = true;
      }
      offset += length;
    }
    if (!sized) fail(422, "INVALID_IMAGE");
    return bytes;
  }
  async addPhotos(c: Conn, ctx: Context, id: string, photos: Row[]) {
    const count = await one(
      c,
      sql`SELECT count(*)::int AS n FROM visit_media WHERE visit_id=${id} AND deleted_at IS NULL`,
    );
    if (count!.n + photos.length > 6)
      fail(422, "MEDIA_LIMIT", "Mỗi phiếu tối đa 6 ảnh.");
    for (const p of photos) {
      const bytes = await this.photoBytes(p.dataUrl);
      await c.execute(
        sql`INSERT INTO visit_media(visit_id,uploaded_by,uploaded_at,name,content_type,content,sha256) VALUES(${id},${ctx.actor!.userId},${ctx.now},${p.name},'image/jpeg',${bytes},${createHash("sha256").update(bytes).digest("hex")})`,
      );
    }
  }
  async media(c: Conn, ctx: Context, id: string) {
    const m = await one(
      c,
      sql`SELECT m.* FROM visit_media m JOIN service_visits v ON v.id=m.visit_id WHERE m.id=${id} AND m.deleted_at IS NULL AND ${scope(ctx, "v")}`,
    );
    if (!m) fail(404, "NOT_FOUND");
    return {
      id: m.id,
      name: m.name,
      dataUrl:
        "data:image/jpeg;base64," + Buffer.from(m.content).toString("base64"),
    };
  }
  async removeMedia(c: Conn, ctx: Context, id: string, input: Row) {
    const m = await one(
      c,
      sql`SELECT m.id,m.visit_id FROM visit_media m JOIN service_visits v ON v.id=m.visit_id WHERE m.id=${id} AND ${scope(ctx, "v")}`,
    );
    if (!m) fail(404, "NOT_FOUND");
    const v = await scopedVisit(c, ctx, m.visit_id, true);
    expectVersion(v, input.expectedVersion);
    if (["HANDED_OVER", "COMPLETED", "ABORTED"].includes(v.stage))
      fail(409, "INVALID_TRANSITION");
    const removed = await one(
      c,
      sql`UPDATE visit_media SET deleted_at=${ctx.now},deleted_by=${ctx.actor!.userId},delete_reason=${input.reason} WHERE id=${id} AND deleted_at IS NULL RETURNING id`,
    );
    if (!removed) fail(404, "NOT_FOUND");
    await this.bump(c, ctx, v);
    return this.receipt(
      v,
      await this.log(c, ctx, v.id, "INTAKE_PHOTO_REMOVED", input.reason, {
        mediaId: id,
      }),
    );
  }
  async create(c: Conn, ctx: Context, input: Row, bookingId?: string) {
    let booking: Row | undefined,
      plans: ServicePlan[],
      customer: Row,
      vehicle: Row,
      advisorId: string,
      previous: Row | undefined;
    if (bookingId) {
      booking = await scopedBooking(c, ctx, bookingId, true);
      const existing = await one(
        c,
        sql`SELECT v.* FROM service_visits v WHERE booking_id=${bookingId} AND ${scope(ctx, "v")}`,
      );
      if (existing) return this.receipt(existing);
      expectVersion(booking, input.expectedVersion);
      if (booking.status !== "CONFIRMED" || !booking.assigned_advisor_id)
        fail(409, "INVALID_TRANSITION");
      advisorId = booking.assigned_advisor_id;
      await this.bookings.validAdvisor(c, ctx, advisorId);
      customer = (await one(
        c,
        sql`SELECT * FROM customers WHERE id=${booking.customer_id}`,
      ))!;
      vehicle = (await this.directory.bookingVehicle(
        c,
        ctx,
        input.vehicle,
        customer.id,
      ))!;
      plans = await this.bookings.snapshotServices(c, bookingId);
      if (input.serviceIds) {
        const selected: string[] = input.serviceIds;
        const added = await this.capacity.servicePlans(
          c,
          ctx,
          selected.filter((id) => !plans.some((plan) => plan.id === id)),
          input.catalogVersion,
        );
        // Keep booked snapshots, including services retired after the appointment was made.
        plans = selected.map(
          (id) => plans.find((plan) => plan.id === id) || added.find((plan) => plan.id === id)!,
        );
      }
      previous = await one(
        c,
        sql`SELECT * FROM capacity_reservations WHERE booking_id=${bookingId} AND status='ACTIVE' FOR UPDATE`,
      );
      if (!previous) fail(409, "RESERVATION_MISSING");
    } else {
      advisorId = input.advisorId || ctx.actor!.staffId;
      if (ctx.actor!.role === "ADVISOR" && advisorId !== ctx.actor!.staffId)
        fail(403, "FORBIDDEN");
      await this.bookings.validAdvisor(c, ctx, advisorId);
      if (
        input.notice.privacyNoticeVersion !== ctx.station.privacy_notice_version
      )
        fail(409, "NOTICE_VERSION_CONFLICT");
      customer = await this.directory.contact(c, ctx, input.customer);
      vehicle = (await this.directory.bookingVehicle(
        c,
        ctx,
        input.vehicle,
        customer.id,
      ))!;
      plans = await this.capacity.servicePlans(
        c,
        ctx,
        input.serviceIds,
        input.catalogVersion,
      );
    }
    if (
      await one(
        c,
        sql`SELECT id FROM service_visits WHERE station_id=${ctx.station.id} AND vehicle_id=${vehicle.id} AND deleted_at IS NULL AND stage NOT IN ('HANDED_OVER','COMPLETED','ABORTED') LIMIT 1`,
      )
    )
      fail(
        409,
        "VEHICLE_ALREADY_IN_SERVICE",
        "Xe đang có phiếu dịch vụ chưa đóng.",
      );
    if (input.followUpOfVisitId) {
      const parent = await scopedVisit(c, ctx, input.followUpOfVisitId);
      if (
        parent.vehicle_id !== vehicle.id ||
        !["HANDED_OVER", "COMPLETED", "ABORTED"].includes(parent.stage)
      )
        fail(422, "FOLLOW_UP_INVALID");
    }
    const at = ctx.now;
    const allocated = await this.capacity.allocate(
      c,
      ctx,
      plans,
      at,
      input.policyVersion,
      previous?.id,
      true,
    );
    const id = randomUUID(),
      intake = input.intake;
    const snapshot = booking?.contact_snapshot || {
      name: customer.name,
      phone: customer.phone_normalized,
    };
    const v = (await one(
      c,
      sql`INSERT INTO service_visits(workflow_version,stage,id,code,station_id,booking_id,customer_id,vehicle_id,assigned_advisor_id,origin,received_at,received_by,contact_snapshot,vehicle_snapshot,request,odometer,odometer_missing_reason,plate_missing_reason,conditions,reception_note,follow_up_of_visit_id,follow_up_reason)
      VALUES(2,'QUOTING',${id},${"DV-" + id.replaceAll("-", "").slice(0, 16).toUpperCase()},${ctx.station.id},${bookingId || null},${customer.id},${vehicle.id},${advisorId},${bookingId ? "BOOKING" : "WALK_IN"},${ctx.now},${ctx.actor!.userId},${json(snapshot)},${json({ model: vehicle.model, plate: vehicle.plate_normalized, year: vehicle.model_year })},${intake.request},${intake.odometer},${intake.odometerMissingReason || null},${intake.plateMissingReason || null},${json(intake.conditions)},${intake.receptionNote},${input.followUpOfVisitId || null},${input.followUpReason || null}) RETURNING *`,
    ))!;
    for (const [i, s] of plans.entries())
      await c.execute(
        sql`INSERT INTO visit_services(visit_id,service_id,sequence_no,service_name_snapshot,plan_revision,plan_snapshot) VALUES(${id},${s.id},${i},${s.name},${s.planRevision},${json(s.requirements)})`,
      );
    await c.execute(
      sql`INSERT INTO visit_assignments(visit_id,advisor_id,assigned_by,assigned_at,reason) VALUES(${id},${advisorId},${ctx.actor!.userId},${ctx.now},'Tiếp nhận xe')`,
    );
    if (
      previous &&
      +previous.start_at === +at &&
      +previous.end_at === allocated.plan.end
    ) {
      await c.execute(
        sql`UPDATE capacity_reservations SET booking_id=NULL,visit_id=${id} WHERE id=${previous.id}`,
      );
    } else
      await this.capacity.persist(
        c,
        ctx,
        bookingId || id,
        allocated,
        previous,
        id,
      );
    await this.addPhotos(c, ctx, id, intake.photos);
    if (booking) {
      await c.execute(
        sql`UPDATE bookings SET status='ARRIVED',arrived_at=${ctx.now},version=version+1,updated_at=${ctx.now} WHERE id=${bookingId}`,
      );
      await event(
        c,
        ctx,
        bookingId!,
        "BOOKING_RECEIVED",
        input.vehicleChangeReason,
        { visitId: id },
      );
    } else {
      await c.execute(
        sql`INSERT INTO consents(customer_id,visit_id,type,notice_version,granted,source,recorded_by,recorded_at) VALUES(${customer.id},${id},'SERVICE_NOTICE_ACK',${input.notice.privacyNoticeVersion},true,'STAFF_RECEPTION',${ctx.actor!.userId},${ctx.now})`,
      );
      if (input.notice.marketingConsent) fail(422, "MARKETING_NOT_SUPPORTED");
    }
    return this.receipt(
      v,
      await this.log(c, ctx, id, "VISIT_RECEIVED", input.vehicleChangeReason, {
        origin: v.origin,
      workflowVersion: v.workflow_version,
      isPaused: v.is_paused,
      pauseReason: v.pause_reason,
      pausedAt: v.paused_at ? iso(v.paused_at) : null,
      }),
    );
  }
  async bump(c: Conn, ctx: Context, v: Row) {
    v.version++;
    await c.execute(
      sql`UPDATE service_visits SET version=${v.version},updated_at=${ctx.now} WHERE id=${v.id}`,
    );
  }
  async mutate(c: Conn, ctx: Context, id: string, action: string, input: Row) {
    const v = await scopedVisit(c, ctx, id, true);
    expectVersion(v, input.expectedVersion);
    if (["HANDED_OVER", "COMPLETED", "ABORTED"].includes(v.stage))
      fail(409, "INVALID_TRANSITION");
    let data: Row = {};
    if (action === "intake") {
      const i = input.intake;
      await c.execute(
        sql`UPDATE service_visits SET request=${i.request},odometer=${i.odometer},odometer_missing_reason=${i.odometerMissingReason || null},plate_missing_reason=${i.plateMissingReason || null},conditions=${json(i.conditions)},reception_note=${i.receptionNote} WHERE id=${id}`,
      );
      await this.addPhotos(c, ctx, id, i.photos);
      data = {
        before: {
          request: v.request,
          odometer: v.odometer,
          conditions: v.conditions,
          receptionNote: v.reception_note,
        },
        after: {
          request: i.request,
          odometer: i.odometer,
          conditions: i.conditions,
          receptionNote: i.receptionNote,
        },
        addedPhotos: i.photos.length,
      };
    } else if (action === "inspect") {
      if (v.stage !== "RECEIVED") fail(409, "INVALID_TRANSITION");
      if (
        !Object.values(v.conditions).some((x) =>
          Array.isArray(x) ? x.length : !!x,
        )
      )
        fail(
          422,
          "INSPECTION_EMPTY",
          "Ghi nhận tình trạng xe trước khi hoàn tất kiểm tra.",
        );
      v.stage = "INSPECTED";
      await c.execute(
        sql`UPDATE service_visits SET stage='INSPECTED' WHERE id=${id}`,
      );
    } else if (action === "contact") {
      const contact = await one(
        c,
        sql`INSERT INTO visit_contact_events(visit_id,actor_user_id,contacted_at,channel,outcome,note_internal) VALUES(${id},${ctx.actor!.userId},${ctx.now},${input.channel},${input.outcome},${input.note}) RETURNING id`,
      );
      data = {
        contactId: contact!.id,
        channel: input.channel,
        outcome: input.outcome,
        note: input.note,
      };
    } else if (action === "transfer") {
      manager(ctx);
      if (input.toAdvisorId === v.assigned_advisor_id)
        fail(409, "SAME_ADVISOR");
      await this.bookings.validAdvisor(c, ctx, input.toAdvisorId);
      const current = await one(
        c,
        sql`SELECT * FROM visit_assignments WHERE visit_id=${id} AND ended_at IS NULL`,
      );
      if (!current) fail(409, "ASSIGNMENT_MISSING");
      const ended = new Date(Math.max(+ctx.now, +current.assigned_at + 1));
      await c.execute(
        sql`UPDATE visit_assignments SET ended_at=${ended},historical_snapshot=${json({ visitCode: v.code, receivedAt: iso(v.received_at), stage: v.stage })} WHERE id=${current.id}`,
      );
      await c.execute(
        sql`INSERT INTO visit_assignments(visit_id,advisor_id,assigned_by,assigned_at,reason) VALUES(${id},${input.toAdvisorId},${ctx.actor!.userId},${ended},${input.reason})`,
      );
      await c.execute(
        sql`UPDATE service_visits SET assigned_advisor_id=${input.toAdvisorId} WHERE id=${id}`,
      );
      if (v.booking_id) {
        const booking = (await one(
          c,
          sql`SELECT * FROM bookings WHERE id=${v.booking_id} FOR UPDATE`,
        ))!;
        const ba = await one(
          c,
          sql`SELECT * FROM booking_assignments WHERE booking_id=${v.booking_id} AND ended_at IS NULL`,
        );
        if (!ba) fail(409, "ASSIGNMENT_MISSING");
        const t = new Date(Math.max(+ended, +ba.assigned_at + 1));
        await c.execute(
          sql`UPDATE booking_assignments SET ended_at=${t},historical_snapshot=${json({ bookingCode: booking.code, status: booking.status, startAt: iso(booking.scheduled_start_at), serviceNames: (await this.bookings.snapshotServices(c, v.booking_id)).map((s) => s.name) })} WHERE id=${ba.id}`,
        );
        await c.execute(
          sql`INSERT INTO booking_assignments(booking_id,advisor_id,assigned_by,assigned_at,reason) VALUES(${v.booking_id},${input.toAdvisorId},${ctx.actor!.userId},${t},${input.reason})`,
        );
        await c.execute(
          sql`UPDATE bookings SET assigned_advisor_id=${input.toAdvisorId},version=version+1,updated_at=${ctx.now} WHERE id=${v.booking_id}`,
        );
        await event(c, ctx, v.booking_id, "BOOKING_TRANSFER", input.reason, {
          visitId: id,
        });
      }
      data = {
        fromAdvisorId: v.assigned_advisor_id,
        toAdvisorId: input.toAdvisorId,
      };
    } else fail(404, "NOT_FOUND");
    await this.bump(c, ctx, v);
    return this.receipt(
      v,
      await this.log(
        c,
        ctx,
        id,
        "VISIT_" + action.toUpperCase(),
        input.reason,
        data,
      ),
    );
  }
  async timeline(c: Conn, ctx: Context, id: string, q: Row) {
    await scopedVisit(c, ctx, id);
    const result = await page(
      c,
      this.config,
      ctx,
      sql`SELECT e.*,e.occurred_at AS cursor_key FROM visit_events e WHERE e.visit_id=${id}`,
      { ...q, visitId: id },
      "occurredAt:desc",
      true,
    );
    return {
      data: result.items.map((e) => ({
        id: e.id,
        type: e.type,
        occurredAt: iso(e.occurred_at),
        reason: e.reason,
        data: e.data,
      })),
      page: result.page,
    };
  }
  async history(c: Conn, ctx: Context, q: Row) {
    const result = await page(
      c,
      this.config,
      ctx,
      sql`SELECT a.*,a.assigned_at AS cursor_key FROM visit_assignments a JOIN service_visits v ON v.id=a.visit_id WHERE a.advisor_id=${ctx.actor!.staffId} AND v.station_id=${ctx.station.id} AND v.deleted_at IS NULL`,
      q,
      "assignedAt:desc",
      true,
    );
    return {
      data: result.items.map((a) => ({
        id: a.id,
        visitId: a.visit_id,
        assignedAt: iso(a.assigned_at),
        endedAt: a.ended_at ? iso(a.ended_at) : null,
        historicalSnapshot: a.historical_snapshot,
      })),
      page: result.page,
    };
  }
}
