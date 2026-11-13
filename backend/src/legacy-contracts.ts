import { z } from "zod";
import { instant, phone, text, uuid, pagination } from "./common";

const amount = z.string().regex(/^\d{1,18}$/);
const qty = z.string().regex(/^\d{1,13}(\.\d{1,3})?$/);
const key = text(200),
  code = text(100);
export const recordTypes = [
  "CUSTOMER",
  "VEHICLE",
  "LINK",
  "HISTORY",
  "STOCK",
  "FINANCE",
  "ACTIVE_ORDER",
  "MEDIA",
] as const;
export type LegacyType = (typeof recordTypes)[number];
export const payloads = {
  CUSTOMER: z.strictObject({ name: text(100), phone }),
  VEHICLE: z
    .strictObject({
      model: text(100).optional(),
      plate: text(20).optional(),
      year: z.number().int().min(1900).max(2100).optional(),
    })
    .refine((v) => !!(v.model || v.plate)),
  LINK: z
    .strictObject({
      customerKey: key,
      vehicleKey: key,
      validFrom: instant,
      validTo: instant.nullable().default(null),
    })
    .refine((v) => !v.validTo || +new Date(v.validTo) > +new Date(v.validFrom)),
  HISTORY: z.strictObject({
    customerKey: key,
    vehicleKey: key.optional(),
    code,
    occurredAt: instant,
    status: z.enum(["CLOSED", "CANCELLED"]),
    summary: text(4000),
    quoteTotal: amount,
    received: amount,
    refunded: amount,
    outstanding: amount,
    currency: z.literal("VND"),
  }),
  STOCK: z.strictObject({
    mode: z.enum(["HISTORY", "OPENING"]),
    code,
    asOf: instant,
    warehouseCode: code,
    partCode: code,
    unit: text(30),
    quantity: qty,
    value: amount,
  }),
  FINANCE: z.strictObject({
    mode: z.enum(["HISTORY", "OPENING"]),
    code,
    asOf: instant,
    customerKey: key,
    kind: z.enum(["DEBT", "DEPOSIT", "COLLECT", "REFUND"]),
    amount,
    currency: z.literal("VND"),
  }),
  ACTIVE_ORDER: z.strictObject({
    customerKey: key,
    vehicleKey: key,
    code,
    asOf: instant,
    status: text(80),
    summary: text(4000),
  }),
  MEDIA: z.strictObject({
    historyKey: key,
    name: text(120),
    relativePath: text(300),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    bytes: z.number().int().min(4).max(10485760),
    contentType: z.enum([
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ]),
  }),
};
export const expectedTotals = z.strictObject({
  quoteTotal: amount,
  received: amount,
  refunded: amount,
  outstanding: amount,
  openingDebt: amount,
  deposits: amount,
  cashCollected: amount,
  cashRefunded: amount,
  stockValue: amount,
  stockQuantities: z.record(z.string().max(350), qty),
  activeOrders: z.number().int().min(0),
  mediaBytes: z.number().int().min(0),
});
export const exportFile = z
  .strictObject({
    format: z.literal("DPAUTO_LEGACY_V1"),
    stationCode: text(50),
    sourceSystem: text(80),
    scopeMode: z.enum(["REFERENCE_ONLY", "CUTOVER"]).default("REFERENCE_ONLY"),
    exportedAt: instant,
    cutoffAt: instant,
    expected: z.strictObject({
      counts: z.record(z.enum(recordTypes), z.number().int().min(0)),
      totals: expectedTotals,
    }),
    records: z.array(z.unknown()).max(20000),
  })
  .refine((v) => +new Date(v.exportedAt) >= +new Date(v.cutoffAt));
export const rowEnvelope = z.strictObject({
  type: z.enum(recordTypes),
  key,
  sourceVersion: text(100),
  data: z.unknown(),
});
export const reviewInput = z.strictObject({
  expectedVersion: z.number().int().min(1),
  decision: z.enum(["CREATE", "LINK", "ARCHIVE", "KEEP_LEGACY"]),
  targetId: uuid.optional(),
  liveType: z.enum(["STOCK_LINE", "CASH", "VISIT"]).optional(),
  liveId: uuid.optional(),
  allowDuplicate: z.boolean().default(false),
  ackSourceChange: z.boolean().default(false),
  reason: text(400),
});
export const historyQuery = z.strictObject({
  ...pagination,
  kind: z.enum(["ALL", "HISTORY", "ACTIVE_ORDER", "FINANCE"]).default("ALL"),
});
