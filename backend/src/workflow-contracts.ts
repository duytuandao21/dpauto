import { z } from "zod";
import { text, uuid, version, reason, instant, pagination } from "./common";
import { calculationPolicy } from "./quote-money";
const percent = z
  .string()
  .regex(/^\d{1,3}(\.\d{1,2})?$/)
  .refine((s) => Number(s) <= 100);
export const evidence = z.strictObject({
  customerName: text(100),
  channel: z.enum(["PHONE", "ZALO", "IN_PERSON", "OTHER"]),
  note: text(2000),
  mediaId: uuid.optional(),
});
const command = { expectedVersion: version, reason };
export const quoteCreate = z.strictObject({
  ...command,
  baseRevisionId: uuid.optional(),
});
export const quoteDraft = z.strictObject({
  ...command,
  calculationPolicy: z.literal(calculationPolicy),
  discountPercent: percent,
  note: z.string().trim().max(2000),
  lines: z
    .array(
      z.strictObject({
        kind: z.enum(["SERVICE", "PART"]),
        serviceId: uuid.optional(),
        name: text(160),
        code: z.string().trim().max(60),
        unit: text(30),
        quantity: z
          .string()
          .regex(/^\d{1,7}(\.\d{1,3})?$/)
          .refine((s) => Number(s) > 0),
        unitPrice: z.string().regex(/^\d{1,15}$/),
        discountPercent: percent,
        vatPercent: percent,
      }),
    )
    .min(1)
    .max(100),
});
export const reasonCommand = z.strictObject(command);
export const quoteDecision = z.strictObject({
  ...command,
  decision: z.enum(["APPROVED", "REJECTED"]),
  evidence,
});
export const quoteQuery = z.strictObject({
  ...pagination,
  q: text(100).optional(),
  status: z.enum(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"]).optional(),
});
export const exemption = z.strictObject({
  ...command,
  mode: z.enum(["NO_QUOTE_FREE", "FREE_TASKS"]),
  scope: text(2000),
  evidence,
});
const technicians = z
  .array(uuid)
  .min(1)
  .max(8)
  .refine((a) => new Set(a).size === a.length);
export const itemCreate = z
  .strictObject({
    ...command,
    label: text(200),
    quoteLineId: uuid.optional(),
    exemptionId: uuid.optional(),
    technicianIds: technicians,
    dueAt: instant,
  })
  .refine((v) => !v.quoteLineId || !v.exemptionId);
export const itemPatch = z
  .strictObject({
    ...command,
    label: text(200).optional(),
    quoteLineId: uuid.nullable().optional(),
    exemptionId: uuid.nullable().optional(),
    technicianIds: technicians.optional(),
    dueAt: instant.optional(),
  })
  .refine((v) =>
    Object.keys(v).some((k) => !["expectedVersion", "reason"].includes(k)),
  );
export const itemProgress = z.strictObject({
  ...command,
  status: z.enum(["IN_PROGRESS", "DONE", "SKIPPED"]),
});
export const workLog = z.strictObject({
  ...command,
  note: text(2000),
  workItemId: uuid.optional(),
});
export const acceptance = z.strictObject({
  ...command,
  inspectorId: uuid,
  result: z.enum(["PASSED", "NEEDS_WORK"]),
  note: text(2000),
  checks: z
    .array(
      z.strictObject({
        workItemId: uuid,
        passed: z.boolean(),
        note: z.string().trim().max(500),
      }),
    )
    .min(1)
    .max(200),
});
export const handover = z.strictObject({
  ...command,
  recipientName: text(100),
  evidenceNote: text(2000),
  vehicleMoved: z.literal(true),
  paymentBasis: z.enum(["NO_CHARGE", "SETTLED"]),
});
export const abort = z.strictObject({
  ...command,
  evidenceNote: text(2000),
  vehicleMoved: z.literal(true),
});
export const release = z.strictObject({
  ...command,
  vehicleMoved: z.literal(true),
});
export const extend = z.strictObject({ ...command, expectedEndAt: instant });
