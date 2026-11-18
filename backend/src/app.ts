import "reflect-metadata";
import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Req,
  Res,
  Inject,
  HttpCode,
  Module,
  HttpException,
  type ExceptionFilter,
  type ArgumentsHost,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import cookie from "@fastify/cookie";
import type { FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { Api } from "./api";
import { schemaCompatible } from './schema-check';
import { ApiError } from "./common";
import { Database, sql, one } from "./database";
import type { Config } from "./config";

@Controller("api/v1")
class ApiController {
  @Get('admin/customers/:id/legacy-records')
  legacyCustomer(@Req() req:FastifyRequest,@Res({passthrough:true}) reply:FastifyReply){return this.api.run('legacyCustomer',req,reply);}
  @Get('admin/vehicles/:id/legacy-records')
  legacyVehicle(@Req() req:FastifyRequest,@Res({passthrough:true}) reply:FastifyReply){return this.api.run('legacyVehicle',req,reply);}
  @Get('admin/legacy-media/:id')
  legacyMedia(@Req() req:FastifyRequest,@Res({passthrough:true}) reply:FastifyReply){return this.api.run('legacyMedia',req,reply);}
  @Get("admin/operations/summary")
  opsSummary(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("opsSummary", req, reply);
  }
  @Get("admin/operations/alerts")
  opsAlerts(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("opsAlerts", req, reply);
  }
  @Get("admin/operations/export")
  opsExport(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("opsExport", req, reply);
  }
  @Get("admin/staff-shifts")
  shifts(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("shifts", req, reply);
  }
  @Post("admin/staff-shifts")
  shiftCreate(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("shiftCreate", req, reply);
  }
  @Post("admin/staff-shifts/:id/cancel")
  shiftCancel(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("shiftCancel", req, reply);
  }
  @Get("admin/notifications")
  inbox(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("inbox", req, reply);
  }
  @Post("admin/notifications/:id/read")
  inboxRead(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("inboxRead", req, reply);
  }
  @Get("admin/notification-jobs")
  notificationJobs(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("notificationJobs", req, reply);
  }
  @Post("admin/notification-jobs/:id/retry")
  notificationRetry(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("notificationRetry", req, reply);
  }
  @Get("admin/cms/documents")
  cmsDocuments(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("cmsDocuments", req, reply);
  }
  @Post("admin/cms/documents")
  cmsCreate(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("cmsCreate", req, reply);
  }
  @Get("admin/cms/documents/:id")
  cmsDocument(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("cmsDocument", req, reply);
  }
  @Patch("admin/cms/documents/:id")
  cmsSave(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("cmsSave", req, reply);
  }
  @Post("admin/cms/documents/:id/publish")
  cmsPublish(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("cmsPublish", req, reply);
  }
  @Post("admin/cms/documents/:id/withdraw")
  cmsWithdraw(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("cmsWithdraw", req, reply);
  }
  @Get("admin/cms/assets")
  cmsAssets(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("cmsAssets", req, reply);
  }
  @Post("admin/cms/assets")
  cmsUpload(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("cmsUpload", req, reply);
  }
  @Get("admin/cms/assets/:id")
  cmsAsset(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("cmsAsset", req, reply);
  }
  @Get("public/content")
  publicContent(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("publicContent", req, reply);
  }
  @Get("public/cms/assets/:id")
  publicCmsAsset(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("publicCmsAsset", req, reply);
  }
  @Get("admin/stock/reconciliation")
  stockReconcile(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("stockReconcile", req, reply);
  }
  @Get("admin/stock/parts")
  parts(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("parts", req, reply);
  }
  @Post("admin/stock/parts")
  partCreate(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("partCreate", req, reply);
  }
  @Patch("admin/stock/parts/:id")
  partPatch(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("partPatch", req, reply);
  }
  @Get("admin/stock/warehouses")
  warehouses(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("warehouses", req, reply);
  }
  @Post("admin/stock/warehouses")
  warehouseCreate(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("warehouseCreate", req, reply);
  }
  @Patch("admin/stock/warehouses/:id")
  warehousePatch(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("warehousePatch", req, reply);
  }
  @Get("admin/stock/balances")
  stockBalances(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("stockBalances", req, reply);
  }
  @Get("admin/stock/documents")
  stockDocs(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("stockDocs", req, reply);
  }
  @Post("admin/stock/documents")
  stockCreate(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("stockCreate", req, reply);
  }
  @Get("admin/stock/documents/:id")
  stockDoc(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("stockDoc", req, reply);
  }
  @Patch("admin/stock/documents/:id")
  stockSave(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("stockSave", req, reply);
  }
  @Post("admin/stock/documents/:id/post")
  stockPost(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("stockPost", req, reply);
  }
  @Get("admin/stock/ledger")
  stockLedger(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("stockLedger", req, reply);
  }
  @Post("admin/service-visits/:id/stock-requests")
  stockRequest(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("stockRequest", req, reply);
  }
  @Post("admin/stock/requests/:id/reservation")
  stockReserve(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("stockReserve", req, reply);
  }
  @Get("admin/finance/payments")
  cashList(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("cashList", req, reply);
  }
  @Post("admin/finance/payments")
  cashCreate(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("cashCreate", req, reply);
  }
  @Get("admin/finance/payments/:id")
  cashRead(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("cashRead", req, reply);
  }
  @Post("admin/finance/payments/:id/allocate")
  cashAllocate(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("cashAllocate", req, reply);
  }
  @Post("admin/finance/payments/:id/refund")
  cashRefund(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("cashRefund", req, reply);
  }
  @Post("admin/service-visits/:id/credits")
  obligationCredit(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("obligationCredit", req, reply);
  }
  @Get("admin/finance/accounts")
  financeAccounts(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("financeAccounts", req, reply);
  }
  @Get("admin/finance/summary")
  financeReport(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("financeReport", req, reply);
  }
  constructor(@Inject("API") readonly api: Api) {}
  @Get("admin/resource-conflicts")
  resourceConflicts(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("resourceConflicts", req, reply);
  }
  @Get("admin/service-visits/:id/workflow")
  workflow(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("workflow", req, reply);
  }
  @Get("admin/quotes")
  quotes(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("quotes", req, reply);
  }
  @Post("admin/service-visits/:id/quotes")
  quoteCreate(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("quoteCreate", req, reply);
  }
  @Patch("admin/quote-revisions/:id")
  quoteSave(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("quoteSave", req, reply);
  }
  @Post("admin/quote-revisions/:id/submit")
  quoteSubmit(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("quoteSubmit", req, reply);
  }
  @Post("admin/quote-revisions/:id/decision")
  quoteDecision(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("quoteDecision", req, reply);
  }
  @Get("admin/quote-revisions/:id/print")
  quotePrint(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("quotePrint", req, reply);
  }
  @Post("admin/quote-revisions/:id/close")
  quoteClose(@Req() req: FastifyRequest, @Res({passthrough:true}) reply: FastifyReply) {
    return this.api.run("quoteClose", req, reply);
  }
  @Post("admin/quote-revisions/:id/void")
  quoteVoid(@Req() req: FastifyRequest, @Res({passthrough:true}) reply: FastifyReply) {
    return this.api.run("quoteVoid", req, reply);
  }
  @Get("admin/acceptances/:id/print")
  acceptancePrint(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("acceptancePrint", req, reply);
  }
  @Post("admin/service-visits/:id/work-exemptions")
  workExempt(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("workExempt", req, reply);
  }
  @Post("admin/service-visits/:id/work-items")
  workItemCreate(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("workItemCreate", req, reply);
  }
  @Patch("admin/work-items/:id")
  workItemPatch(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("workItemPatch", req, reply);
  }
  @Post("admin/work-items/:id/progress")
  workItemProgress(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("workItemProgress", req, reply);
  }
  @Post("admin/service-visits/:id/work/start")
  workStart(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("workStart", req, reply);
  }
  @Post("admin/service-visits/:id/work/pause")
  workPause(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("workPause", req, reply);
  }
  @Post("admin/service-visits/:id/work/resume")
  workResume(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("workResume", req, reply);
  }
  @Post("admin/service-visits/:id/work/finish")
  workFinish(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("workFinish", req, reply);
  }
  @Post("admin/service-visits/:id/work/log")
  workLog(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("workLog", req, reply);
  }
  @Post("admin/service-visits/:id/acceptances")
  acceptance(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("acceptance", req, reply);
  }
  @Post("admin/service-visits/:id/ready")
  visitReady(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("visitReady", req, reply);
  }
  @Post("admin/service-visits/:id/handover")
  visitHandover(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("visitHandover", req, reply);
  }
  @Post("admin/service-visits/:id/abort")
  visitAbort(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("visitAbort", req, reply);
  }
  @Delete("admin/service-visits/:id")
  visitDelete(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("visitDelete", req, reply);
  }
  @Post("admin/service-visits/:id/resources/extend")
  resourceExtend(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("resourceExtend", req, reply);
  }
  @Post("admin/service-visits/:id/resources/release")
  resourceRelease(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("resourceRelease", req, reply);
  }
  @Get("admin/service-visits")
  visits(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("visits", req, reply);
  }
  @Get("admin/service-visits/:id")
  visit(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("visit", req, reply);
  }
  @Post("admin/service-visits")
  walkIn(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("walkIn", req, reply);
  }
  @Post("admin/bookings/:id/receive")
  receive(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("receive", req, reply);
  }
  @Patch("admin/service-visits/:id/intake")
  intake(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("intake", req, reply);
  }
  @Post("admin/service-visits/:id/inspection")
  visitInspect(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("visitInspect", req, reply);
  }
  @Post("admin/service-visits/:id/transfer")
  visitTransfer(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("visitTransfer", req, reply);
  }
  @Post("admin/service-visits/:id/contact-events")
  visitContact(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("visitContact", req, reply);
  }
  @Get("admin/service-visits/:id/events")
  visitEvents(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("visitEvents", req, reply);
  }
  @Get("admin/my-visit-history")
  visitHistory(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("visitHistory", req, reply);
  }
  @Get("admin/visit-media/:id")
  visitMedia(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("visitMedia", req, reply);
  }
  @Delete("admin/visit-media/:id")
  visitMediaDelete(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("visitMediaDelete", req, reply);
  }
  @Get("admin/auth/csrf")
  @HttpCode(200)
  csrf(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("csrf", req, reply);
  }
  @Post("admin/auth/login")
  @HttpCode(200)
  login(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("login", req, reply);
  }
  @Post("admin/auth/logout")
  @HttpCode(200)
  logout(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("logout", req, reply);
  }
  @Get("admin/auth/me")
  @HttpCode(200)
  me(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("me", req, reply);
  }
  @Post("admin/auth/change-password")
  @HttpCode(200)
  password(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("password", req, reply);
  }
  @Get("admin/staff")
  @HttpCode(200)
  staff(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("staff", req, reply);
  }
  @Post("admin/staff")
  @HttpCode(200)
  staffCreate(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("staffCreate", req, reply);
  }
  @Patch("admin/staff/:id")
  @HttpCode(200)
  staffPatch(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("staffPatch", req, reply);
  }
  @Post("admin/staff/:id/reset-password")
  @HttpCode(200)
  staffReset(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("staffReset", req, reply);
  }
  @Get("admin/services")
  @HttpCode(200)
  services(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("services", req, reply);
  }
  @Post("admin/services")
  @HttpCode(200)
  serviceCreate(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("serviceCreate", req, reply);
  }
  @Patch("admin/services/:id")
  @HttpCode(200)
  servicePatch(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("servicePatch", req, reply);
  }
  @Get("admin/customers")
  @HttpCode(200)
  customers(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("customers", req, reply);
  }
  @Get("admin/customers/:id")
  @HttpCode(200)
  customer(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("customer", req, reply);
  }
  @Get("admin/vehicles")
  @HttpCode(200)
  vehicles(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("vehicles", req, reply);
  }
  @Get("admin/vehicles/:id")
  @HttpCode(200)
  vehicle(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("vehicle", req, reply);
  }
  @Get("admin/bookings")
  @HttpCode(200)
  bookings(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("bookings", req, reply);
  }
  @Get("admin/bookings/:id")
  @HttpCode(200)
  booking(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("booking", req, reply);
  }
  @Get("admin/bookings/create-preview")
  @HttpCode(200)
  bookingCreatePreview(@Req() req: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.api.run("bookingCreatePreview", req, reply);
  }
  @Post("admin/bookings")
  @HttpCode(200)
  bookingCreate(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("bookingCreate", req, reply);
  }
  @Patch("admin/bookings/:id")
  @HttpCode(200)
  bookingPatch(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("bookingPatch", req, reply);
  }
  @Post("admin/bookings/:id/confirm")
  @HttpCode(200)
  confirm(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("confirm", req, reply);
  }
  @Get("admin/bookings/:id/preview")
  @HttpCode(200)
  bookingPreview(@Req() req: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.api.run("bookingPreview", req, reply);
  }
  @Post("admin/bookings/:id/reschedule")
  @HttpCode(200)
  reschedule(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("reschedule", req, reply);
  }
  @Post("admin/bookings/:id/cancel")
  @HttpCode(200)
  cancel(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("cancel", req, reply);
  }
  @Post("admin/bookings/:id/no-show")
  @HttpCode(200)
  noShow(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("noShow", req, reply);
  }
  @Post("admin/bookings/:id/assign")
  @HttpCode(200)
  assign(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("assign", req, reply);
  }
  @Post("admin/bookings/:id/transfer")
  @HttpCode(200)
  transfer(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("transfer", req, reply);
  }
  @Get("admin/bookings/:id/events")
  @HttpCode(200)
  events(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("events", req, reply);
  }
  @Get("admin/my-history")
  @HttpCode(200)
  history(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("history", req, reply);
  }
  @Post("admin/bookings/:id/contact-events")
  @HttpCode(200)
  contact(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("contact", req, reply);
  }
  @Get("admin/capacity/calendar")
  @HttpCode(200)
  calendar(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("calendar", req, reply);
  }
  @Get("admin/capacity/policy")
  @HttpCode(200)
  policy(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("policy", req, reply);
  }
  @Put("admin/capacity/policy")
  @HttpCode(200)
  policyWrite(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("policyWrite", req, reply);
  }
  @Post("admin/capacity/days")
  @HttpCode(200)
  days(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("days", req, reply);
  }
  @Patch("admin/capacity/buckets/:id")
  @HttpCode(200)
  bucket(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("bucket", req, reply);
  }
  @Get("admin/capacity/blocks")
  @HttpCode(200)
  blocks(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("blocks", req, reply);
  }
  @Post("admin/capacity/blocks")
  @HttpCode(200)
  blockCreate(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("blockCreate", req, reply);
  }
  @Delete("admin/capacity/blocks/:id")
  @HttpCode(200)
  blockDelete(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("blockDelete", req, reply);
  }
  @Get("admin/dashboard")
  @HttpCode(200)
  dashboard(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("dashboard", req, reply);
  }
  @Get("admin/audit-logs")
  @HttpCode(200)
  audits(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("audits", req, reply);
  }
  @Get("admin/site-settings")
  @HttpCode(200)
  settings(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("settings", req, reply);
  }
  @Put("admin/site-settings")
  @HttpCode(200)
  settingsWrite(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("settingsWrite", req, reply);
  }
  @Get("public/services")
  @HttpCode(200)
  publicServices(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("publicServices", req, reply);
  }
  @Get("public/availability")
  @HttpCode(200)
  availability(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("availability", req, reply);
  }
  @Post("public/bookings")
  @HttpCode(200)
  publicCreate(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.api.run("publicCreate", req, reply);
  }
  @Get("internal/health/live")
  live() {
    return { data: { status: "ok" }, meta: {} };
  }
  @Get("internal/health/ready")
  async ready(@Res({ passthrough: true }) reply: FastifyReply) {
    reply.header("Cache-Control", "no-store");
    try {
      const row = await one(
        this.api.db.db,
        sql`SELECT to_regclass('public.booking_events') IS NOT NULL AND to_regclass('public.visit_media') IS NOT NULL AND to_regclass('public.resource_occupancies') IS NOT NULL AND to_regclass('public.cash_reductions') IS NOT NULL AS ready`,
      );
      if (!row?.ready||!await schemaCompatible(this.api.db.db)) throw Error();
      return { data: { status: "ready" }, meta: {} };
    } catch {
      reply.status(503);
      return {
        error: {
          code: "NOT_READY",
          message: "Dịch vụ chưa sẵn sàng.",
          fields: [],
        },
        meta: {},
      };
    }
  }
}
class ErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const req = host.switchToHttp().getRequest<FastifyRequest>(),
      reply = host.switchToHttp().getResponse<FastifyReply>();
    let status =
      error instanceof ApiError
        ? error.status
        : error instanceof HttpException
          ? error.getStatus()
          : error &&
              typeof error === "object" &&
              "statusCode" in error &&
              [400, 413, 415].includes(Number(error.statusCode))
            ? Number(error.statusCode)
            : 500;
    let code =
      error instanceof ApiError
        ? error.code
        : status === 413
          ? "PAYLOAD_TOO_LARGE"
          : status === 404
            ? "NOT_FOUND"
            : status < 500
              ? "INVALID_REQUEST"
              : "INTERNAL_ERROR";
    let cause = error as {
      code?: string;
      cause?: unknown;
      constraint?: string;
    };
    for (let i = 0; i < 4 && cause; i++, cause = cause.cause as typeof cause) {
      if (cause.code === "23P01") {
        status = 409;
        code = "CAPACITY_FULL";
        break;
      }
      if (cause.code === "23505") {
        status = 409;
        code = cause.constraint?.includes("email")
          ? "EMAIL_CONFLICT"
          : "CODE_CONFLICT";
        break;
      }
      if (["55P03", "40P01", "40001"].includes(cause.code || "")) {
        status = 409;
        code = "REQUEST_IN_PROGRESS";
        break;
      }
      if (cause.code === "ECONNREFUSED" || cause.code === "57P01") {
        status = 503;
        code = "SERVICE_UNAVAILABLE";
        break;
      }
    }
    if (status === 500)
      console.error(
        JSON.stringify({
          level: "error",
          requestId: req.id,
          code: "INTERNAL_ERROR",
        }),
      );
    if (status === 429 || code === "REQUEST_IN_PROGRESS")
      reply.header("Retry-After", "3");
    reply
      .header("Cache-Control", "no-store")
      .status(status)
      .send({
        error: {
          code,
          message:
            error instanceof ApiError
              ? error.message
              : "Không thể thực hiện yêu cầu.",
          fields: error instanceof ApiError ? error.fields : [],
        },
        meta: { requestId: req.id, correlationId: req.id },
      });
  }
}
export async function createApp(config: Config) {
  const db = new Database(config.databaseUrl),
    api = new Api(db, config);
  @Module({
    controllers: [ApiController],
    providers: [{ provide: "API", useValue: api }],
  })
  class AppModule {}
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: false,
      bodyLimit: 2 * 1024 * 1024,
      trustProxy: false,
      genReqId: () => randomUUID(),
    }),
    { logger: ["error"] },
  );
  await app.register(cookie);
  app.useGlobalFilters(new ErrorFilter());
  app.enableShutdownHooks();
  app
    .getHttpAdapter()
    .getInstance()
    .addHook("onClose", async () => {
      await db.close();
    });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return { app, api };
}
