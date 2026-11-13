import { stationTime } from "./types";
import type { Settlement, StockRequirement } from "./stock-finance";
export type QuoteLine = {
  id: string;
  kind: "SERVICE" | "PART";
  serviceId?: string | null;
  name: string;
  code: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  discountPercent: string;
  vatPercent: string;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  total: string;
};
export type QuoteRevision = {
  id: string;
  revisionNo: number;
  kind: "INITIAL" | "CHANGE_ORDER";
  baseRevisionId: string | null;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
  currency: string;
  calculationPolicy: string;
  discountPercent: string;
  note: string;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  total: string;
  createdAt: string;
  submittedAt: string | null;
  lines: QuoteLine[];
  decision: {
    decision: string;
    customerName: string;
    channel: string;
    evidenceNote: string;
    recordedAt: string;
    mediaId: string | null;
  } | null;
};
export type WorkItem = {
  id: string;
  label: string;
  status: "PENDING" | "IN_PROGRESS" | "DONE" | "SKIPPED";
  quoteLineId: string | null;
  exemptionId: string | null;
  dueAt: string;
  technicians: { id: string; name: string }[];
};
export type Acceptance = {
  id: string;
  result: "PASSED" | "NEEDS_WORK";
  scopeVersion: number;
  checkedAt: string;
  inspector: { id: string; name: string };
  note: string;
  checks: {
    workItemId: string;
    label: string;
    passed: boolean;
    note: string;
  }[];
};
export type Workflow = {
  visitId: string;
  version: number;
  stage: string;
  calculationPolicy: string;
  quotes: QuoteRevision[];
  obligation: { assessed: boolean; total: string | null };
  paymentStatus: Settlement["paymentStatus"];
  settlement: Settlement;
  stock: { fulfilled: boolean; lines: StockRequirement[] };
  financialCredits: {
    id: string;
    amount: string;
    reason: string;
    evidence: string;
    occurredAt: string;
  }[];
  exemptions: {
    id: string;
    mode: "NO_QUOTE_FREE" | "FREE_TASKS";
    scope: string;
    reason: string;
    evidence: Evidence;
    approvedAt: string;
  }[];
  work: {
    id: string;
    status: "NOT_STARTED" | "IN_PROGRESS" | "PAUSED" | "FINISHED" | "ABORTED";
    scopeVersion: number;
    startedAt: string | null;
    finishedAt: string | null;
    dueAt: string | null;
    items: WorkItem[];
    logs: { id: string; type: string; note: string; occurredAt: string }[];
  } | null;
  acceptances: Acceptance[];
  occupancies: {
    id: string;
    resourceId: string;
    name: string;
    startedAt: string;
    expectedReleaseAt: string;
    endedAt: string | null;
    overdue: boolean;
  }[];
  handover: {
    id: string;
    handedOverAt: string;
    recipientName: string;
    paymentBasis: string;
    approvedObligation: string;
    evidenceNote: string;
  } | null;
  allowedActions: string[];
};
export type Evidence = {
  customerName: string;
  channel: string;
  note: string;
  mediaId?: string;
};
export type WorkflowReceipt = {
  visitId: string;
  version: number;
  revisionId?: string;
};
export type RunWorkflow = (
  path: string,
  body?: Record<string, unknown>,
  method?: string,
) => Promise<boolean>;
export const quoteLabels = {
  DRAFT: "Bản nháp",
  SUBMITTED: "Chờ khách xác nhận",
  APPROVED: "Đã duyệt",
  REJECTED: "Từ chối",
};
export const itemLabels = {
  PENDING: "Chưa bắt đầu",
  IN_PROGRESS: "Đang thực hiện",
  DONE: "Đã xong",
  SKIPPED: "Đã bỏ qua",
};
export const workLabels = {
  NOT_STARTED: "Chưa thi công",
  IN_PROGRESS: "Đang thi công",
  PAUSED: "Tạm dừng",
  FINISHED: "Chờ nghiệm thu",
  ABORTED: "Đã dừng",
};
export function vnd(value: string) {
  return BigInt(value).toLocaleString("vi-VN") + " ₫";
}
export const workflowTime = (s: string) =>
  stationTime(s).slice(0, 16).replace("T", " ");
export const stationInstant = (value: string) =>
  value.length === 16 ? value + ":00+07:00" : value;
export function quoteDraftBody(q: {
  discountPercent: string;
  note: string;
  lines: Omit<
    QuoteLine,
    "id" | "subtotal" | "discountTotal" | "taxTotal" | "total"
  >[];
}) {
  return {
    calculationPolicy: "VND_LINE_HALF_UP_V1",
    discountPercent: q.discountPercent,
    note: q.note,
    lines: q.lines.map((l) => ({
      kind: l.kind,
      serviceId: l.kind === "SERVICE" ? l.serviceId || undefined : undefined,
      name: l.name,
      code: l.code,
      unit: l.unit,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      discountPercent: l.discountPercent,
      vatPercent: l.vatPercent,
    })),
  };
}
