import { z } from "zod";
import {
  uuid,
  version,
  text,
  reason,
  date,
  pagination,
  boolQuery,
} from "./common";
import { contact, vehicle, serviceIds, notice } from "./contracts";

const note = z.string().trim().max(1000).default("");
export const photo = z.strictObject({
  name: text(120),
  dataUrl: z
    .string()
    .max(273100)
    .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/),
});
export const intake = z.strictObject({
  request: text(2000),
  odometer: z.number().int().min(0).max(9999999).nullable(),
  odometerMissingReason: text(400).optional(),
  plateMissingReason: text(400).optional(),
  conditions: z.strictObject({
    exterior: note,
    interior: note,
    engine: note,
    dashboard: note,
    tires: note,
    operation: z
      .array(text(100))
      .max(20)
      .refine((a) => new Set(a).size === a.length),
  }),
  receptionNote: note,
  photos: z.array(photo).max(6).default([]),
});
export const receiveInput = z
  .strictObject({
    expectedVersion: version,
    vehicle: vehicle.unwrap().unwrap(),
    vehicleVerified: z.literal(true),
    vehicleChangeReason: text(400).optional(),
    serviceIds: serviceIds.optional(),
    catalogVersion: version.optional(),
    policyVersion: version,
    intake,
  })
  .refine(
    (value) =>
      (value.serviceIds === undefined) === (value.catalogVersion === undefined),
    {
      path: ["catalogVersion"],
      message: "Gửi danh sách dịch vụ cùng phiên bản danh mục.",
    },
  );
export const walkInInput = z.strictObject({
  customer: contact,
  vehicle: vehicle.unwrap().unwrap(),
  vehicleVerified: z.literal(true),
  advisorId: uuid.optional(),
  serviceIds,
  catalogVersion: version,
  policyVersion: version,
  notice,
  intake,
  followUpOfVisitId: uuid.optional(),
  followUpReason: text(400).optional(),
});
export const intakeInput = z.strictObject({
  expectedVersion: version,
  reason,
  intake,
});
export const visitTransfer = z.strictObject({
  expectedVersion: version,
  reason,
  toAdvisorId: uuid,
});
export const inspectInput = z.strictObject({
  expectedVersion: version,
  reason,
});
export const visitDelete = z.strictObject({
  expectedVersion: version,
  reason: reason.default("Xóa phiếu dịch vụ"),
});
export const visitContact = z.strictObject({
  expectedVersion: version,
  channel: z.enum(["PHONE", "ZALO", "IN_PERSON", "OTHER"]),
  outcome: z.enum(["UNREACHED", "AGREED", "DECLINED", "OTHER"]),
  note,
});
export const visitQuery = z
  .strictObject({
    ...pagination,
    q: text(100).optional(),
    activeOnly: boolQuery.optional(),
    ticketStage: z
      .enum([
        "QUOTING",
        "WAITING_FOR_WORK",
        "HANDOVER",
        "COMPLETED",
        "QUOTE",
        "WAITING_WORK",
        "IN_PROGRESS",
        "PAUSED",
        "REWORK",
        "QUALITY_CHECK",
        "READY",
        "HANDED_OVER",
        "ABORTED",
      ])
      .optional(),
    from: date.optional(),
    to: date.optional(),
    stage: z
      .enum([
        "QUOTING",
        "WAITING_FOR_WORK",
        "HANDOVER",
        "COMPLETED",
        "RECEIVED",
        "INSPECTED",
        "IN_PROGRESS",
        "QUALITY_CHECK",
        "READY",
        "HANDED_OVER",
        "ABORTED",
      ])
      .optional(),
    advisorId: uuid.optional(),
    bookingId: uuid.optional(),
    customerId: uuid.optional(),
    vehicleId: uuid.optional(),
  })
  .refine((v) => !!v.from === !!v.to);
export const timelineQuery = z.strictObject({ ...pagination });
