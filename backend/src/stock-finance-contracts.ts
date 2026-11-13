import { z } from "zod";
import {
  text,
  uuid,
  version,
  reason,
  pagination,
  date,
  boolQuery,
  phone,
} from "./common";
export const permissions = [
  "staff.manage",
  "roles.manage",
  "inventory.manage",
  "inventory.adjust",
  "inventory.cost.read",
  "finance.read",
  "payments.collect",
  "payments.refund",
  "reports.export",
  "cms.read",
  "cms.write",
  "cms.publish",
  "notifications.manage",
] as const;
const amount = z
  .string()
  .regex(/^\d{1,18}$/)
  .refine((s) => BigInt(s) > 0n);
const qty = z
  .string()
  .regex(/^\d{1,13}(\.\d{1,3})?$/)
  .refine((s) => Number(s) > 0);
const code = z.string().regex(/^[A-Z0-9_-]{2,50}$/);
export const partCreate = z.strictObject({
  code,
  name: text(160),
  unit: text(30),
});
export const warehouseCreate = z.strictObject({ code, name: text(120) });
export const catalogPatch = z
  .strictObject({
    expectedVersion: version,
    reason,
    name: text(160).optional(),
    active: z.boolean().optional(),
  })
  .refine((v) => v.name !== undefined || v.active !== undefined);
export const stockQuery = z.strictObject({
  ...pagination,
  q: text(100).optional(),
  warehouseId: uuid.optional(),
  partId: uuid.optional(),
  kind: z
    .enum(["RECEIPT", "ISSUE", "RETURN", "ADJUSTMENT", "STOCKTAKE"])
    .optional(),
});
export const stockDraft = z.strictObject({
  commandId: uuid,
  warehouseId: uuid,
  kind: z.enum(["RECEIPT", "ISSUE", "RETURN", "ADJUSTMENT", "STOCKTAKE"]),
  counterparty: z.string().trim().max(200).default(""),
  reason,
  lines: z
    .array(
      z.strictObject({
        partId: uuid,
        quantity: z.string().regex(/^-?\d{1,13}(\.\d{1,3})?$/),
        unitCost: z
          .string()
          .regex(/^\d{1,15}$/)
          .optional(),
        requestId: uuid.optional(),
        originalLineId: uuid.optional(),
        returnCondition: z.enum(["RESTOCK", "SCRAP"]).optional(),
        expectedBalanceVersion: version.optional(),
      }),
    )
    .min(1)
    .max(100),
});
export const stockSave = stockDraft
  .omit({ commandId: true })
  .extend({ expectedVersion: version });
export const post = z.strictObject({ expectedVersion: version, reason });
export const stockRequest = z.strictObject({
  expectedVersion: version,
  quoteLineId: uuid,
  partId: uuid,
  warehouseId: uuid,
  reason,
});
export const reserve = z.strictObject({
  expectedVersion: version,
  quantity: qty,
  action: z.enum(["RESERVE", "RELEASE"]),
  reason,
});
export const cashCreate = z
  .strictObject({
    commandId: uuid,
    expectedVersion: version,
    bookingId: uuid.optional(),
    visitId: uuid.optional(),
    customerId: uuid.optional(),
    customer: z.strictObject({ name: text(100), phone }).optional(),
    kind: z.enum(["DEPOSIT", "COLLECT"]),
    amount,
    method: z.enum(["CASH", "BANK_TRANSFER", "CARD", "OTHER"]),
    reference: text(160),
    payerName: text(100),
    reason,
  })
  .refine(
    (v) =>
      [v.bookingId, v.visitId, v.customerId, v.customer].filter(Boolean)
        .length === 1,
  );
export const cashAllocate = z.strictObject({
  commandId: uuid,
  expectedVersion: version,
  visitId: uuid,
  amount,
  expectedAvailable: z.string().regex(/^\d{1,18}$/),
  reason,
});
export const cashRefund = z.strictObject({
  commandId: uuid,
  kind: z.enum(["REFUND", "REVERSAL"]),
  amount,
  expectedRefundable: z.string().regex(/^\d{1,18}$/),
  allocationId: uuid.optional(),
  method: z.enum(["CASH", "BANK_TRANSFER", "CARD", "OTHER"]),
  reference: text(160),
  reason,
});
export const obligationCredit = z.strictObject({
  commandId: uuid,
  expectedVersion: version,
  amount,
  reason,
  evidence: text(2000),
});
export const financeQuery = z.strictObject({
  ...pagination,
  visitId: uuid.optional(),
  bookingId: uuid.optional(),
  customerId: uuid.optional(),
  q: text(100).optional(),
  outstandingOnly: boolQuery,
});
export const reportQuery = z.strictObject({ from: date, to: date });
