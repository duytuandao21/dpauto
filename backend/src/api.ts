import { randomUUID } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { Database, sql, one, json, type Conn, type Row } from "./database";
import type { Config } from "./config";
import { Auth } from "./auth";
import { Capacity } from "./capacity/capacity";
import { Bookings } from "./bookings";
import { Catalog } from "./catalog";
import { Directory } from "./directory";
import { Staff } from "./staff";
import { PublicApi } from "./public";
import { System } from "./system";
import { Visits } from "./visits";
import * as visits from "./visit-contracts";
import { Workflow } from "./workflow";
import * as workflow from "./workflow-contracts";
import * as sf from "./stock-finance-contracts";
import { Finance } from "./finance";
import { Inventory } from "./inventory";
import { Operations } from "./operations";
import { Cms } from "./cms";
import { Notifications } from "./notifications";
import { Legacy } from './legacy';
import { historyQuery } from './legacy-contracts';
import { assertStationWritable } from './ops-control';
import * as ops from "./operations-contracts";
import {
  fail,
  parse,
  uuid,
  hash,
  mac,
  canonical,
  permission,
  scopedBooking,
  scopedVisit,
  iso,
  type Context,
} from "./common";
import * as v from "./contracts";

type Endpoint = {
  schema?: z.ZodType;
  permission?: string;
  manager?: boolean;
  public?: boolean;
  write?: boolean;
  status?: number;
};
const routes: Record<string, Endpoint> = {
  legacyCustomer:{schema:historyQuery,permission:'customers.read'},
  legacyVehicle:{schema:historyQuery,permission:'customers.read'},
  legacyMedia:{permission:'customers.read'},
  opsSummary: { schema: ops.period, permission: "visits.read" },
  opsAlerts: { schema: ops.alertQuery, permission: "visits.read" },
  opsExport: {
    schema: ops.exportQuery,
    permission: "reports.export",
    manager: true,
  },
  shifts: { schema: ops.shiftQuery, permission: "visits.read" },
  shiftCreate: {
    schema: ops.shiftCreate,
    permission: "staff.manage",
    manager: true,
    write: true,
    status: 201,
  },
  shiftCancel: {
    schema: ops.command,
    permission: "staff.manage",
    manager: true,
    write: true,
  },
  inbox: { schema: ops.jobsQuery, permission: "visits.read" },
  inboxRead: { schema: ops.readNotice, permission: "visits.read", write: true },
  notificationJobs: {
    schema: ops.jobsQuery,
    permission: "notifications.manage",
    manager: true,
  },
  notificationRetry: {
    schema: ops.retryJob,
    permission: "notifications.manage",
    manager: true,
    write: true,
  },
  cmsDocuments: { schema: ops.cmsQuery, permission: "cms.read" },
  cmsDocument: { permission: "cms.read" },
  cmsCreate: {
    schema: ops.cmsCreate,
    permission: "cms.write",
    write: true,
    status: 201,
  },
  cmsSave: { schema: ops.cmsSave, permission: "cms.write", write: true },
  cmsPublish: {
    schema: ops.cmsPublish,
    permission: "cms.publish",
    write: true,
  },
  cmsWithdraw: { schema: ops.command, permission: "cms.publish", write: true },
  cmsAssets: { schema: ops.jobsQuery, permission: "cms.read" },
  cmsUpload: {
    schema: ops.mediaCreate,
    permission: "cms.write",
    write: true,
    status: 201,
  },
  cmsAsset: { permission: "cms.read" },
  publicContent: { public: true },
  publicCmsAsset: { public: true },
  stockReconcile: {
    schema: visits.timelineQuery,
    permission: "inventory.read",
    manager: true,
  },
  parts: { schema: sf.stockQuery, permission: "catalog.read" },
  partCreate: {
    schema: sf.partCreate,
    permission: "inventory.manage",
    write: true,
    manager: true,
    status: 201,
  },
  partPatch: {
    schema: sf.catalogPatch,
    permission: "inventory.manage",
    write: true,
    manager: true,
  },
  warehouses: {
    schema: sf.stockQuery,
    permission: "inventory.read",
    manager: true,
  },
  warehouseCreate: {
    schema: sf.warehouseCreate,
    permission: "inventory.manage",
    write: true,
    manager: true,
    status: 201,
  },
  warehousePatch: {
    schema: sf.catalogPatch,
    permission: "inventory.manage",
    write: true,
    manager: true,
  },
  stockBalances: {
    schema: sf.stockQuery,
    permission: "inventory.read",
    manager: true,
  },
  stockDocs: {
    schema: sf.stockQuery,
    permission: "inventory.read",
    manager: true,
  },
  stockCreate: {
    schema: sf.stockDraft,
    permission: "inventory.manage",
    write: true,
    manager: true,
    status: 201,
  },
  stockDoc: { permission: "inventory.read", manager: true },
  stockSave: {
    schema: sf.stockSave,
    permission: "inventory.manage",
    write: true,
    manager: true,
  },
  stockPost: {
    schema: sf.post,
    permission: "inventory.manage",
    write: true,
    manager: true,
  },
  stockLedger: {
    schema: sf.stockQuery,
    permission: "inventory.read",
    manager: true,
  },
  stockRequest: {
    schema: sf.stockRequest,
    permission: "inventory.manage",
    write: true,
    manager: true,
  },
  stockReserve: {
    schema: sf.reserve,
    permission: "inventory.manage",
    write: true,
    manager: true,
  },
  cashList: {
    schema: sf.financeQuery,
    permission: "finance.read",
    manager: true,
  },
  cashCreate: {
    schema: sf.cashCreate,
    permission: "payments.collect",
    write: true,
    manager: true,
    status: 201,
  },
  cashRead: { permission: "finance.read", manager: true },
  cashAllocate: {
    schema: sf.cashAllocate,
    permission: "payments.collect",
    write: true,
    manager: true,
  },
  cashRefund: {
    schema: sf.cashRefund,
    permission: "payments.refund",
    write: true,
    manager: true,
  },
  obligationCredit: {
    schema: sf.obligationCredit,
    permission: "payments.refund",
    write: true,
    manager: true,
    status: 201,
  },
  financeAccounts: {
    schema: sf.financeQuery,
    permission: "finance.read",
    manager: true,
  },
  financeReport: {
    schema: sf.reportQuery,
    permission: "finance.read",
    manager: true,
  },
  workflow: { permission: "visits.read" },
  resourceConflicts: {
    schema: visits.timelineQuery,
    permission: "capacity.read",
  },
  quotes: { schema: workflow.quoteQuery, permission: "quotes.read" },
  quoteCreate: {
    schema: workflow.quoteCreate,
    permission: "quotes.write",
    write: true,
    status: 201,
  },
  quoteSave: {
    schema: workflow.quoteDraft,
    permission: "quotes.write",
    write: true,
  },
  quoteSubmit: {
    schema: workflow.reasonCommand,
    permission: "quotes.write",
    write: true,
  },
  quoteDecision: {
    schema: workflow.quoteDecision,
    permission: "quotes.decide",
    write: true,
  },
  quoteClose: { schema: workflow.quoteClose, permission: "quotes.decide", write: true },
  quoteVoid: { schema: workflow.quoteVoid, permission: "quotes.write", write: true },
  quotePrint: { permission: "quotes.read" },
  acceptancePrint: { permission: "visits.read" },
  workExempt: {
    schema: workflow.exemption,
    permission: "work.exempt",
    write: true,
    status: 201,
  },
  workItemCreate: {
    schema: workflow.itemCreate,
    permission: "work.write",
    write: true,
    status: 201,
  },
  workItemPatch: {
    schema: workflow.itemPatch,
    permission: "work.write",
    write: true,
  },
  workItemProgress: {
    schema: workflow.itemProgress,
    permission: "work.write",
    write: true,
  },
  workStart: {
    schema: workflow.reasonCommand,
    permission: "work.write",
    write: true,
  },
  workPause: {
    schema: workflow.reasonCommand,
    permission: "work.write",
    write: true,
  },
  workResume: {
    schema: workflow.reasonCommand,
    permission: "work.write",
    write: true,
  },
  workFinish: {
    schema: workflow.finishCommand,
    permission: "work.write",
    write: true,
  },
  workLog: {
    schema: workflow.workLog,
    permission: "work.write",
    write: true,
    status: 201,
  },
  acceptance: {
    schema: workflow.acceptance,
    permission: "acceptance.record",
    write: true,
    status: 201,
  },
  visitReady: {
    schema: workflow.reasonCommand,
    permission: "visits.handover",
    write: true,
  },
  visitHandover: {
    schema: workflow.handover,
    permission: "visits.handover",
    write: true,
  },
  visitAbort: {
    schema: workflow.abort,
    permission: "visits.abort",
    write: true,
  },
  visitDelete: {
    schema: visits.visitDelete,
    permission: "visits.update",
    write: true,
  },
  resourceExtend: {
    schema: workflow.extend,
    permission: "work.write",
    write: true,
  },
  resourceRelease: {
    schema: workflow.release,
    permission: "visits.handover",
    write: true,
  },
  visits: { schema: visits.visitQuery, permission: "visits.read" },
  visit: { permission: "visits.read" },
  walkIn: {
    schema: visits.walkInInput,
    permission: "visits.receive",
    write: true,
    status: 201,
  },
  receive: {
    schema: visits.receiveInput,
    permission: "visits.receive",
    write: true,
    status: 201,
  },
  intake: {
    schema: visits.intakeInput,
    permission: "visits.update",
    write: true,
  },
  visitInspect: {
    schema: visits.inspectInput,
    permission: "visits.update",
    write: true,
  },
  visitTransfer: {
    schema: visits.visitTransfer,
    permission: "visits.assign",
    write: true,
  },
  visitContact: {
    schema: visits.visitContact,
    permission: "visits.contact",
    write: true,
    status: 201,
  },
  visitEvents: { schema: visits.timelineQuery, permission: "visits.read" },
  visitHistory: { schema: visits.timelineQuery, permission: "visits.read" },
  visitMedia: { permission: "visits.read" },
  visitMediaDelete: {
    schema: v.reasonInput,
    permission: "visits.update",
    write: true,
  },
  staff: { schema: v.staffQuery },
  staffCreate: {
    schema: v.staffCreate,
    permission: "staff.manage",
    write: true,
    status: 201,
  },
  staffPatch: { schema: v.staffPatch, permission: "staff.manage", write: true },
  staffReset: { schema: v.resetInput, permission: "roles.manage", write: true },
  services: { schema: v.serviceQuery, permission: "catalog.read" },
  serviceCreate: {
    schema: v.serviceCreate,
    permission: "catalog.manage",
    write: true,
    status: 201,
  },
  servicePatch: {
    schema: v.servicePatch,
    permission: "catalog.manage",
    write: true,
  },
  customers: { schema: v.customerQuery, permission: "customers.read" },
  customer: { schema: v.relatedQuery, permission: "customers.read" },
  vehicles: { schema: v.vehicleQuery, permission: "customers.read" },
  vehicle: { schema: v.relatedQuery, permission: "customers.read" },
  bookings: { schema: v.bookingQuery },
  booking: {},
  bookingPreview: { schema: v.bookingPreviewInput },
  bookingCreatePreview: { schema: v.bookingCreatePreviewInput, permission: "booking.create" },
  bookingCreate: {
    schema: v.bookingCreate,
    permission: "booking.create",
    write: true,
    status: 201,
  },
  bookingPatch: {
    schema: v.bookingPatch,
    permission: "booking.update",
    write: true,
  },
  confirm: {
    schema: v.confirmInput,
    permission: "booking.confirm",
    write: true,
  },
  reschedule: {
    schema: v.rescheduleInput,
    permission: "booking.reschedule",
    write: true,
  },
  cancel: { schema: v.reasonInput, permission: "booking.cancel", write: true },
  noShow: { schema: v.noShowInput, permission: "booking.no_show", write: true },
  assign: { schema: v.assignInput, permission: "booking.assign", write: true },
  transfer: {
    schema: v.transferInput,
    permission: "booking.assign",
    write: true,
  },
  events: { schema: v.eventsQuery },
  history: { schema: v.historyQuery },
  contact: {
    schema: v.contactInput,
    permission: "booking.contact",
    write: true,
    status: 201,
  },
  calendar: { schema: v.capacityQuery, permission: "capacity.read" },
  policy: { permission: "capacity.read" },
  policyWrite: {
    schema: v.policyInput,
    permission: "capacity.manage",
    write: true,
  },
  days: {
    schema: v.materializeInput,
    permission: "capacity.manage",
    write: true,
    status: 201,
  },
  bucket: { schema: v.bucketInput, permission: "capacity.manage", write: true },
  blocks: { schema: v.blocksQuery, permission: "capacity.read" },
  blockCreate: {
    schema: v.blockInput,
    permission: "capacity.manage",
    write: true,
    status: 201,
  },
  blockDelete: {
    schema: v.reasonInput,
    permission: "capacity.manage",
    write: true,
    status: 204,
  },
  dashboard: { schema: v.dashboardQuery },
  audits: { schema: v.auditQuery, permission: "audit.read" },
  settings: { permission: "station.read" },
  settingsWrite: {
    schema: v.settingsInput,
    permission: "station.manage",
    write: true,
  },
  publicServices: { schema: v.publicServicesQuery, public: true },
  availability: { schema: v.availabilityQuery, public: true },
  publicCreate: {
    schema: v.publicCreate,
    public: true,
    write: true,
    status: 201,
  },
};
export class Api {
  readonly auth: Auth;
  readonly capacity: Capacity;
  readonly directory: Directory;
  readonly bookings: Bookings;
  readonly catalog: Catalog;
  readonly staff: Staff;
  readonly publicApi: PublicApi;
  readonly system: System;
  readonly visits: Visits;
  readonly workflow: Workflow;
  readonly finance: Finance;
  readonly inventory: Inventory;
  readonly operations: Operations;
  readonly cms: Cms;
  readonly notifications: Notifications;
  readonly legacy: Legacy;
  constructor(
    readonly db: Database,
    readonly config: Config,
  ) {
    this.auth = new Auth(db, config);
    this.capacity = new Capacity(config);
    this.directory = new Directory(config);
    this.bookings = new Bookings(config, this.capacity, this.directory);
    this.catalog = new Catalog(config);
    this.staff = new Staff(config);
    this.publicApi = new PublicApi(config, this.capacity);
    this.system = new System(config, this.publicApi);
    this.visits = new Visits(
      config,
      this.bookings,
      this.directory,
      this.capacity,
    );
    this.finance = new Finance(config, this.visits);
    this.inventory = new Inventory(config, this.visits);
    this.operations = new Operations(config, this.capacity, this.finance);
    this.cms = new Cms(config, this.visits);
    this.notifications = new Notifications(db, config);
    this.legacy = new Legacy(config,this.directory,this.finance);
    this.workflow = new Workflow(
      config,
      this.visits,
      this.capacity,
      this.finance,
      this.inventory,
    );
  }
  async context(c: Conn, req: FastifyRequest): Promise<Context> {
    const station = await one(
      c,
      sql`SELECT * FROM stations WHERE code=${this.config.stationCode}`,
    );
    if (!station) fail(503, "STATION_NOT_CONFIGURED");
    const incoming = req.headers["x-correlation-id"];
    return {
      station,
      now: this.config.now(),
      ip: req.ip,
      requestId: String(req.id),
      correlationId:
        typeof incoming === "string" && /^[a-zA-Z0-9_-]{8,80}$/.test(incoming)
          ? incoming
          : String(req.id),
    };
  }
  async run(key: string, req: FastifyRequest, reply: FastifyReply) {
    reply
      .header("Cache-Control", "no-store")
      .header("X-Content-Type-Options", "nosniff");
    const ctx = await this.context(this.db.db, req);
    const session = await this.auth.session(this.db.db, req);
    if (key === "csrf")
      return {
        data: await this.auth.csrfContext(req, reply),
        meta: this.meta(ctx),
      };
    if (key === "login")
      return {
        data: await this.auth.login(
          req,
          reply,
          parse(v.loginInput, req.body),
          ctx,
        ),
        meta: this.meta(ctx),
      };
    if (key === "logout") {
      await this.auth.logout(req, reply);
      return reply.status(204).send();
    }
    const endpoint = routes[key];
    if (!endpoint && key !== "me" && key !== "password") fail(404, "NOT_FOUND");
    if (!endpoint?.public) {
      if (!session) fail(401, "UNAUTHENTICATED");
      ctx.actor = await this.auth.actor(this.db.db, session);
      if (ctx.actor.stationId !== ctx.station.id) fail(403, "FORBIDDEN");
      if (
        ctx.actor.role === "CMS_ADMIN" &&
        !key.startsWith("cms") &&
        !["me", "password"].includes(key)
      )
        fail(403, "FORBIDDEN");
      if (endpoint?.manager && ctx.actor.role !== "MANAGER")
        fail(403, "FORBIDDEN");
      if (ctx.actor.mustChange && !["me", "password"].includes(key))
        fail(403, "PASSWORD_CHANGE_REQUIRED");
      if (req.method !== "GET") this.auth.csrf(req, session);
      else this.auth.origin(req);
      if (endpoint?.permission) permission(ctx, endpoint.permission);
    } else this.auth.origin(req);
    if (
      req.method !== "GET" &&
      !req.headers["content-type"]?.startsWith("application/json")
    )
      fail(415, "JSON_REQUIRED");
    if (key === "me")
      return {
        data: await this.auth.view(this.db.db, session!),
        meta: this.meta(ctx),
      };
    if (key === "password")
      return {
        data: await this.auth.change(
          req,
          reply,
          parse(v.passwordInput, req.body),
          ctx,
          session!,
        ),
        meta: this.meta(ctx),
      };
    const input = parse(
      endpoint.schema || z.strictObject({}),
      endpoint.write ? req.body || {} : req.query || {},
    ) as Row;
    const id = (req.params as Row).id;
    if (id) parse(uuid, id);
    if (endpoint.public) {
      await this.auth.rate(
        key === "availability"
          ? "availability"
          : key === "publicCreate"
            ? "public-create"
            : "catalog",
        req.ip,
        key === "availability" ? 60 : key === "publicCreate" ? 5 : 120,
        key === "publicCreate" ? 600 : 60,
      );
      if (key === "publicCreate")
        await this.auth.rate("public-contact", input.customer.phone, 3, 1800);
    } else if (endpoint.write)
      await this.auth.rate("staff-mutation", ctx.actor!.userId, 120, 60);
    const prepared =
      endpoint.write && key.startsWith("staff")
        ? await this.staff.prepare(input)
        : undefined;
    let status = endpoint.status || 200,
      replayed = false;
    const result = await this.db.tx(
      async (c) => {
        let cached: Row | undefined;
        if (endpoint.write) {
          const keyHeader = parse(z.uuidv4(), req.headers["idempotency-key"]);
          const scopeKey = [
            ctx.station.id,
            ctx.actor?.userId || "PUBLIC",
            req.method,
            req.routeOptions.url,
            id || "",
          ].join(":");
          const fingerprint = mac(this.config.secret, canonical(input));
          await c.execute(
            sql`INSERT INTO idempotency_keys(scope,key_hash,request_fingerprint,state,expires_at) VALUES(${scopeKey},${hash(keyHeader)},${fingerprint},'IN_PROGRESS',${new Date(+ctx.now + 7 * 86400000)}) ON CONFLICT(scope,key_hash) DO NOTHING`,
          );
          cached = await one(
            c,
            sql`SELECT * FROM idempotency_keys WHERE scope=${scopeKey} AND key_hash=${hash(keyHeader)} FOR UPDATE`,
          );
          if (cached!.request_fingerprint !== fingerprint)
            fail(409, "IDEMPOTENCY_CONFLICT");
          ctx.station = (await one(
            c,
            sql`SELECT * FROM stations WHERE id=${ctx.station.id} FOR UPDATE`,
          ))!;
        } else
          ctx.station = (await one(
            c,
            sql`SELECT * FROM stations WHERE id=${ctx.station.id}`,
          ))!;
        if (ctx.actor) {
          ctx.actor = await this.auth.actor(c, session!, !!endpoint.write);
          if (ctx.actor.mustChange) fail(403, "PASSWORD_CHANGE_REQUIRED");
          if (ctx.actor.role === "CMS_ADMIN" && !key.startsWith("cms"))
            fail(403, "FORBIDDEN");
          if (endpoint.manager && ctx.actor.role !== "MANAGER")
            fail(403, "FORBIDDEN");
          if (endpoint.permission) permission(ctx, endpoint.permission);
          await c.execute(endpoint.write ? sql`SELECT 1` : sql`SELECT 1`);
        }
        if (cached?.state === "COMPLETED") {
          if (cached.resource_type === "visit" && ctx.actor)
            await scopedVisit(
              c,
              ctx,
              cached.resource_id,
              false,
              key === "visitDelete" ||
                !!(
                  endpoint.manager &&
                  ["cashCreate", "cashAllocate", "cashRefund", "obligationCredit"].includes(key)
                ),
            );
          if (cached.resource_type === "booking" && ctx.actor)
            await scopedBooking(c, ctx, cached.resource_id);
          replayed = true;
          status = cached.response_status;
          return cached.response_receipt;
        }
        if(endpoint.write)await assertStationWritable(c,ctx.station.id);
        const value = await this.handle(c, ctx, key, id, input, prepared);
        if (endpoint.write) {
          if (key === "days" && value.alreadyInitialized) status = 200;
          // Receipts reference the audit event actually committed by this request.
          if (value.eventId && !value.bookingId && !value.visitId) {
            const logged = await one(
              c,
              sql`SELECT id FROM audit_logs WHERE request_id=${ctx.requestId} ORDER BY occurred_at DESC,id DESC LIMIT 1`,
            );
            if (logged) value.eventId = logged.id;
          }
          if (!value.bookingId && !value.visitId)
            await c.execute(
              sql`INSERT INTO outbox_jobs(event_key,kind,aggregate_type,aggregate_id,payload) VALUES(${String(value.eventId || cached!.id)},'CORE_MUTATION',${key},${value.id || ctx.station.id},${json({ action: key, id: value.id || ctx.station.id })})`,
            );
          await c.execute(
            sql`UPDATE idempotency_keys SET state='COMPLETED',resource_type=${value.visitId ? "visit" : value.bookingId ? "booking" : key},resource_id=${value.visitId || value.bookingId || value.id || null},response_status=${status},response_receipt=${json(value)} WHERE id=${cached!.id}`,
          );
        }
        return value;
      },
      !endpoint.write && key !== "opsExport",
    );
    if (ctx.actor)
      await this.db.db.execute(
        sql`UPDATE sessions SET last_seen_at=${ctx.now} WHERE id=${session!.id} AND revoked_at IS NULL`,
      );
    if (status === 204) return reply.status(204).send();
    reply.status(status);
    if(key==='legacyMedia')return reply.type(result.contentType).header('Content-Disposition',`attachment; filename="legacy-${(req.params as Row).id}.${({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','application/pdf':'pdf'} as Record<string,string>)[result.contentType]||'bin'}"`).send(result.bytes);
    if (key === "cmsAsset" || key === "publicCmsAsset")
      return reply.type("image/jpeg").send(result.bytes);
    if (result && Array.isArray(result.data))
      return {
        data: result.data,
        page: result.page,
        meta: { ...this.meta(ctx), asOf: iso(ctx.now), ...result.extra },
      };
    return {
      data: result,
      meta: { ...this.meta(ctx), ...(replayed ? { replayed: true } : {}) },
    };
  }
  meta(ctx: Context) {
    return { requestId: ctx.requestId, correlationId: ctx.correlationId };
  }
  async handle(
    c: Conn,
    ctx: Context,
    key: string,
    id: string,
    input: Row,
    prepared?: { hash: string; salt: string },
  ): Promise<Row> {
    switch (key) {
      case 'legacyCustomer':return this.legacy.history(c,ctx,id,input);
      case 'legacyVehicle':return this.legacy.history(c,ctx,id,input,true);
      case 'legacyMedia':return this.legacy.media(c,ctx,id);
      case "opsSummary":
        return this.operations.summary(c, ctx, input);
      case "opsAlerts":
        return this.operations.alerts(c, ctx, input);
      case "opsExport":
        return this.operations.export(c, ctx, input);
      case "shifts":
        return this.operations.shifts(c, ctx, input);
      case "shiftCreate":
        return this.operations.shift(c, ctx, input);
      case "shiftCancel":
        return this.operations.shift(c, ctx, input, id);
      case "inbox":
        return this.notifications.inbox(c, ctx, input);
      case "inboxRead":
        return this.notifications.read(c, ctx, id, input);
      case "notificationJobs":
        return this.notifications.jobs(c, ctx, input);
      case "notificationRetry":
        return this.notifications.retry(c, ctx, id, input);
      case "cmsDocuments":
        return this.cms.documents(c, ctx, input);
      case "cmsDocument":
        return this.cms.detail(c, ctx, id);
      case "cmsCreate":
        return this.cms.save(c, ctx, input);
      case "cmsSave":
        return this.cms.save(c, ctx, input, id);
      case "cmsPublish":
        return this.cms.publish(c, ctx, id, input);
      case "cmsWithdraw":
        return this.cms.publish(c, ctx, id, input, true);
      case "cmsAssets":
        return this.cms.assets(c, ctx, input);
      case "cmsUpload":
        return this.cms.upload(c, ctx, input);
      case "cmsAsset":
        return this.cms.asset(c, ctx, id);
      case "publicCmsAsset":
        return this.cms.asset(c, ctx, id, true);
      case "publicContent":
        return this.cms.published(c, ctx);
      case "stockReconcile":
        return this.inventory.reconcile(c, ctx, input);
      case "parts":
        return this.inventory.catalog(c, ctx, input);
      case "partCreate":
        return this.inventory.catalogWrite(c, ctx, input);
      case "partPatch":
        return this.inventory.catalogWrite(c, ctx, input, id);
      case "warehouses":
        return this.inventory.catalog(c, ctx, input, true);
      case "warehouseCreate":
        return this.inventory.catalogWrite(c, ctx, input, undefined, true);
      case "warehousePatch":
        return this.inventory.catalogWrite(c, ctx, input, id, true);
      case "stockBalances":
        return this.inventory.balances(c, ctx, input);
      case "stockDocs":
        return this.inventory.documents(c, ctx, input);
      case "stockCreate":
        return this.inventory.save(c, ctx, input);
      case "stockDoc":
        return this.inventory.read(c, ctx, id);
      case "stockSave":
        return this.inventory.save(c, ctx, input, id);
      case "stockPost":
        return this.inventory.post(c, ctx, id, input);
      case "stockLedger":
        return this.inventory.ledger(c, ctx, input);
      case "stockRequest":
        return this.inventory.request(c, ctx, id, input);
      case "stockReserve":
        return this.inventory.reserve(c, ctx, id, input);
      case "cashList":
        return this.finance.list(c, ctx, input);
      case "cashCreate":
        return this.finance.collect(c, ctx, input);
      case "cashRead":
        return this.finance.read(c, ctx, id);
      case "cashAllocate":
        return this.finance.allocate(c, ctx, id, input);
      case "cashRefund":
        return this.finance.refund(c, ctx, id, input);
      case "obligationCredit":
        return this.finance.credit(c, ctx, id, input);
      case "financeAccounts":
        return this.finance.accounts(c, ctx, input);
      case "financeReport":
        return this.finance.report(c, ctx, input);
      case "workflow":
        return this.workflow.read(c, ctx, id);
      case "resourceConflicts":
        return this.workflow.conflicts(c, ctx, input);
      case "quotes":
        return this.workflow.listQuotes(c, ctx, input);
      case "quoteCreate":
        return this.workflow.createQuote(c, ctx, id, input);
      case "quoteSave":
        return this.workflow.saveQuote(c, ctx, id, input);
      case "quoteSubmit":
        return this.workflow.submit(c, ctx, id, input);
      case "quoteClose":
        return this.workflow.closeQuote(c, ctx, id, input);
      case "quoteVoid":
        return this.workflow.voidQuote(c, ctx, id, input);
      case "quoteDecision":
        return this.workflow.decide(c, ctx, id, input);
      case "quotePrint":
        return this.workflow.print(c, ctx, id, "quote");
      case "acceptancePrint":
        return this.workflow.print(c, ctx, id, "acceptance");
      case "workExempt":
        return this.workflow.exempt(c, ctx, id, input);
      case "workItemCreate":
        return this.workflow.addItem(c, ctx, id, input);
      case "workItemPatch":
        return this.workflow.item(c, ctx, id, input);
      case "workItemProgress":
        return this.workflow.item(c, ctx, id, input, true);
      case "workStart":
        return this.workflow.work(c, ctx, id, "start", input);
      case "workPause":
        return this.workflow.work(c, ctx, id, "pause", input);
      case "workResume":
        return this.workflow.work(c, ctx, id, "resume", input);
      case "workFinish":
        return this.workflow.work(c, ctx, id, "finish", input);
      case "workLog":
        return this.workflow.work(c, ctx, id, "log", input);
      case "acceptance":
        return this.workflow.accept(c, ctx, id, input);
      case "visitReady":
        return this.workflow.ready(c, ctx, id, input);
      case "visitHandover":
        return this.workflow.handover(c, ctx, id, input);
      case "visitAbort":
        return this.workflow.abort(c, ctx, id, input);
      case "visitDelete":
        return this.workflow.remove(c, ctx, id, input);
      case "resourceExtend":
        return this.workflow.extend(c, ctx, id, input);
      case "resourceRelease":
        return this.workflow.releaseReady(c, ctx, id, input);
      case "visits":
        return this.visits.list(c, ctx, input);
      case "visit":
        return this.visits.detail(c, ctx, id);
      case "walkIn":
        return this.visits.create(c, ctx, input);
      case "receive": {
        const receipt = await this.visits.create(c, ctx, input, id);
        await this.finance.attachDeposits(c, ctx, receipt.visitId);
        return receipt;
      }
      case "intake":
        return this.visits.mutate(c, ctx, id, "intake", input);
      case "visitInspect":
        return this.visits.mutate(c, ctx, id, "inspect", input);
      case "visitTransfer":
        return this.visits.mutate(c, ctx, id, "transfer", input);
      case "visitContact":
        return this.visits.mutate(c, ctx, id, "contact", input);
      case "visitEvents":
        return this.visits.timeline(c, ctx, id, input);
      case "visitHistory":
        return this.visits.history(c, ctx, input);
      case "visitMedia":
        return this.visits.media(c, ctx, id);
      case "visitMediaDelete":
        return this.visits.removeMedia(c, ctx, id, input);
      case "staff":
        return this.staff.list(c, ctx, input);
      case "staffCreate":
        return this.staff.create(c, ctx, input, prepared);
      case "staffPatch":
        return this.staff.patch(c, ctx, id, input, prepared);
      case "staffReset":
        return this.staff.reset(c, ctx, id, input, prepared!);
      case "services":
        return this.catalog.list(c, ctx, input);
      case "serviceCreate":
        return this.catalog.write(c, ctx, input);
      case "servicePatch":
        return this.catalog.write(c, ctx, input, id);
      case "customers":
        return this.directory.customers(c, ctx, input);
      case "vehicles":
        return this.directory.vehicles(c, ctx, input);
      case "customer": {
        const value = await this.directory.customer(
            c,
            ctx,
            id,
            input.relatedLimit,
          ),
          bookings = await this.bookings.list(c, ctx, {
            customerId: id,
            limit: input.relatedLimit,
            sort: "createdAt:desc",
          });
        return {
          ...value,
          bookings: bookings.data,
          serviceVisitsUrl: "/api/v1/admin/service-visits?customerId=" + id,
          related: { ...value.related, bookingsHasMore: bookings.page.hasMore },
        };
      }
      case "vehicle": {
        const value = await this.directory.vehicle(c, ctx, id),
          bookings = await this.bookings.list(c, ctx, {
            vehicleId: id,
            limit: input.relatedLimit,
            sort: "createdAt:desc",
          });
        return {
          ...value,
          bookings: bookings.data,
          serviceVisitsUrl: "/api/v1/admin/service-visits?vehicleId=" + id,
          bookingsHasMore: bookings.page.hasMore,
        };
      }
      case "bookings":
        return this.bookings.list(c, ctx, input);
      case "booking":
        return this.bookings.detail(c, ctx, id);
      case "bookingPreview":
        return this.bookings.preview(c, ctx, id, input);
      case "bookingCreatePreview":
        return this.bookings.previewCreate(c, ctx, input);
      case "bookingCreate":
        return this.bookings.create(c, ctx, input);
      case "bookingPatch":
        return this.bookings.mutate(c, ctx, id, "edit", input);
      case "confirm":
      case "reschedule":
      case "cancel":
      case "assign":
      case "transfer":
        return this.bookings.mutate(c, ctx, id, key, input);
      case "noShow":
        return this.bookings.mutate(c, ctx, id, "no-show", input);
      case "contact":
        return this.bookings.mutate(c, ctx, id, "contact-events", input);
      case "events":
        return this.bookings.events(c, ctx, id, input);
      case "history":
        return this.bookings.history(c, ctx, input);
      case "dashboard":
        return this.bookings.dashboard(c, ctx, input);
      case "policy":
        return this.capacity.policyView(c, ctx);
      case "policyWrite":
        return this.capacity.writePolicy(c, ctx, input);
      case "calendar":
        return this.capacity.calendar(c, ctx, input);
      case "days":
        return this.capacity.materialize(c, ctx, input);
      case "bucket":
        return this.capacity.patchBucket(c, ctx, id, input);
      case "blocks":
        return this.system.blocks(c, ctx, input);
      case "blockCreate":
        return this.capacity.createBlock(c, ctx, input);
      case "blockDelete":
        await this.capacity.deleteBlock(c, ctx, id, input);
        return {};
      case "settings":
        return this.system.settings(ctx);
      case "settingsWrite":
        return this.system.writeSettings(c, ctx, input);
      case "audits":
        return this.system.audits(c, ctx, input);
      case "publicServices":
        return this.publicApi.catalog(c, ctx);
      case "availability":
        return this.publicApi.availability(c, ctx, input);
      case "publicCreate":
        return this.bookings.create(
          c,
          ctx,
          input,
          true,
          this.publicApi.source(ctx, input.channelToken),
        );
      default:
        fail(404, "NOT_FOUND");
    }
  }
}
