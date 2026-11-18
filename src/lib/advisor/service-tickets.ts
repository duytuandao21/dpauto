import type { Visit, TicketStage } from "@/lib/api/visits";
import type { ServiceOrder } from "./types";

export const ticketLabels: Record<TicketStage, string> = {
  QUOTING: "Báo giá",
  WAITING_FOR_WORK: "Chờ thi công",
  HANDOVER: "Bàn giao",
  COMPLETED: "Hoàn thành",
  QUOTE: "Báo giá",
  WAITING_WORK: "Chờ thi công",
  IN_PROGRESS: "Đang thi công",
  QUALITY_CHECK: "Chờ nghiệm thu",
  READY: "Sẵn sàng bàn giao",
  HANDED_OVER: "Đã bàn giao",
  PAUSED: "Tạm dừng thi công",
  REWORK: "Cần làm lại",
  ABORTED: "Đã dừng",
};
export const ticketTones: Record<TicketStage, string> = {
  QUOTING: "pending",
  WAITING_FOR_WORK: "confirmed",
  HANDOVER: "arrived",
  COMPLETED: "completed",
  QUOTE: "pending",
  WAITING_WORK: "confirmed",
  IN_PROGRESS: "confirmed",
  QUALITY_CHECK: "arrived",
  READY: "completed",
  HANDED_OVER: "completed",
  PAUSED: "pending",
  REWORK: "cancelled",
  ABORTED: "cancelled",
};
export const ticketTabs = [
  ["active", "Đang xử lý"],
  ["all", "Tất cả"],
  ["QUOTING", "Báo giá"],
  ["WAITING_FOR_WORK", "Chờ thi công"],
  ["IN_PROGRESS", "Đang thi công"],
  ["HANDOVER", "Bàn giao"],
  ["COMPLETED", "Hoàn thành"],
] as const;

export function ticketStage(visit: Visit): TicketStage {
  if (visit.ticketStage) return visit.ticketStage;
  if (visit.stage === "RECEIVED") return "QUOTE";
  if (visit.stage === "INSPECTED") {
    return visit.work?.status === "NOT_STARTED" &&
      !visit.pricing?.hasOpenQuote &&
      (visit.pricing?.approvedTotal != null || visit.pricing?.hasExemption)
      ? "WAITING_WORK"
      : "QUOTE";
  }
  if (visit.stage === "IN_PROGRESS" && visit.work?.status === "PAUSED")
    return "PAUSED";
  return visit.stage;
}

export function localTicketStage(order: ServiceOrder): TicketStage {
  if (order.stage === "done") return "READY";
  if (order.acceptance.result === "needs_work") return "REWORK";
  if (order.stage === "acceptance") return "QUALITY_CHECK";
  if (order.stage === "work")
    return order.work.startedAt ? "IN_PROGRESS" : "WAITING_WORK";
  return "QUOTE";
}

export function ticketAmount(visit: Visit) {
  const pricing = visit.pricing;
  if (!pricing) return { value: null, label: "Chưa có báo giá" };
  if (
    ["READY", "HANDED_OVER", "HANDOVER", "COMPLETED"].includes(visit.stage) &&
    pricing.payableTotal !== null
  )
    return { value: pricing.payableTotal, label: "Phải thanh toán" };
  if (pricing.approvedTotal !== null)
    return { value: pricing.approvedTotal, label: "Báo giá đã duyệt" };
  if (pricing.hasExemption)
    return { value: pricing.payableTotal, label: "Miễn phí đã duyệt" };
  return {
    value: pricing.estimateTotal,
    label: pricing.estimateTotal === null ? "Chưa có báo giá" : "Dự kiến",
  };
}

export function ticketAction(
  stage: TicketStage,
  permissions: string[],
  inspectionRequired = false,
  hasQuote = false,
) {
  const fallback = { label: "Xem phiếu", tab: "tong-quan" };
  if (inspectionRequired)
    return permissions.includes("visits.update")
      ? { label: "Tiếp tục xử lý", tab: "tong-quan" }
      : fallback;
  const action = {
    QUOTING: {
      label: "Chốt báo giá",
      tab: "bao-gia",
      permission: "quotes.decide",
    },
    WAITING_FOR_WORK: {
      label: "Bắt đầu thi công",
      tab: "thi-cong",
      permission: "work.write",
    },
    HANDOVER: {
      label: "Hoàn thành phiếu",
      tab: "doi-soat",
      permission: "visits.handover",
    },
    COMPLETED: null,
    QUOTE: {
      label: hasQuote ? "Xử lý báo giá" : "Lập báo giá",
      tab: "bao-gia",
      permission: "quotes.write",
    },
    WAITING_WORK: {
      label: "Bắt đầu thi công",
      tab: "thi-cong",
      permission: "work.write",
    },
    IN_PROGRESS: {
      label: "Hoàn tất thi công",
      tab: "thi-cong",
      permission: "work.write",
    },
    PAUSED: {
      label: "Tiếp tục thi công",
      tab: "thi-cong",
      permission: "work.write",
    },
    REWORK: {
      label: "Xử lý làm lại",
      tab: "thi-cong",
      permission: "work.write",
    },
    QUALITY_CHECK: {
      label: "Nghiệm thu",
      tab: "nghiem-thu",
      permission: "acceptance.record",
    },
    READY: {
      label: "Bàn giao xe",
      tab: "nghiem-thu",
      permission: "visits.handover",
    },
    HANDED_OVER: null,
    ABORTED: null,
  }[stage];
  return action && permissions.includes(action.permission)
    ? { label: action.label, tab: action.tab }
    : fallback;
}

export type ServiceTicketRow = {
  id: string;
  version?: number;
  bookingId?: string | null;
  canDelete?: boolean;
  deleteBlockedReason?: string | null;
  code: string;
  plate: string;
  model: string;
  customer: string;
  phone: string;
  stage: TicketStage;
  label: string;
  tone?: string;
  amount: { value: string | null; label: string };
  pendingChange?: boolean;
  action: { label: string; tab: string };
};
export const searchTicket = (value: string) =>
  value
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
