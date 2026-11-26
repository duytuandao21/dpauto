export type Part = {
  id: string;
  code: string;
  name: string;
  unit: string;
  active: boolean;
  deletedAt?: string | null;
  version: number;
};
export type Warehouse = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  deletedAt?: string | null;
  version: number;
};
export type StockBalance = {
  partId: string;
  warehouseId: string;
  name: string;
  code: string;
  unit: string;
  warehouseName: string;
  onHand: string;
  reserved: string;
  available: string;
  version: number;
  carryingValue?: string;
};
export type StockLine = {
  id?: string;
  partId: string;
  quantity: string;
  unitCost?: string | null;
  requestId?: string | null;
  originalLineId?: string | null;
  returnCondition?: string | null;
  expectedBalanceVersion?: number | null;
  part?: { name: string; unit: string };
  quantityDelta?: string | null;
  valueDelta?: string | null;
};
export type StockDocument = {
  id: string;
  warehouseId: string;
  warehouseName?: string;
  kind: string;
  status: string;
  version: number;
  reason: string;
  counterparty: string;
  createdAt: string;
  postedAt?: string | null;
  lines: StockLine[];
};
export type StockRequirement = {
  quoteLineId: string;
  name: string;
  quantity: string;
  unit: string;
  request: {
    id: string;
    partId: string;
    code: string;
    warehouseId: string;
    warehouseName: string;
    reserved: string;
    issued: string;
    outstanding: string;
    version: number;
  } | null;
};
export type Settlement = {
  assessed: boolean;
  total: string | null;
  netReceived: string;
  outstanding: string | null;
  credit: string | null;
  paymentStatus: "UNASSESSED" | "UNPAID" | "PARTIAL" | "SETTLED" | "CREDIT";
};
export type CashPayment = {
  id: string;
  kind: string;
  amount: string;
  method: string;
  reference: string;
  payerName: string;
  reason: string;
  occurredAt: string;
  visitId: string | null;
  bookingId: string | null;
  customerId: string | null;
  originalId: string | null;
  available: string | null;
  refundable: string | null;
  allocations: {
    id: string;
    visitId: string;
    visitCode: string;
    amount: string;
    refundable: string;
  }[];
  snapshot: {
    station: { name: string; phone: string; address: string };
    customer: { name: string; phone: string };
    vehicle?: { model?: string; plate?: string } | null;
    visitCode?: string | null;
  };
};
export const stockKinds = {
  RECEIPT: "Nhập kho",
  ISSUE: "Xuất cho phiếu",
  RETURN: "Trả từ phiếu",
  ADJUSTMENT: "Điều chỉnh tồn",
  STOCKTAKE: "Kiểm kê",
};
export const cashKinds = {
  DEPOSIT: "Thu cọc",
  COLLECT: "Thu tiền",
  REFUND: "Hoàn tiền",
  REVERSAL: "Đảo khoản thu",
};
export const methods = {
  CASH: "Tiền mặt",
  BANK_TRANSFER: "Chuyển khoản",
  CARD: "Thẻ",
  OTHER: "Khác",
};
export const paymentLabels = {
  UNASSESSED: "Chưa xác định",
  UNPAID: "Chưa thu",
  PARTIAL: "Thu một phần",
  SETTLED: "Đã đủ",
  CREDIT: "Thu dư",
};
export const financePermissions = {
  "inventory.manage": "Nhập/xuất và giữ hàng",
  "inventory.adjust": "Điều chỉnh tồn, kiểm kê",
  "inventory.cost.read": "Xem và nhập giá vốn",
  "finance.read": "Xem sổ tiền và công nợ",
  "payments.collect": "Thu tiền, cọc và phân bổ",
  "payments.refund": "Hoàn/đảo tiền, giảm nghĩa vụ",
  "reports.export": "Xuất báo cáo CSV",
  "cms.read": "Xem nội dung và bản nháp website",
  "cms.write": "Biên tập nội dung và tải ảnh website",
  "cms.publish": "Xuất bản / gỡ nội dung website",
  "notifications.manage": "Theo dõi và thử lại thông báo",
};
export function stockDraftBody(value: {
  warehouseId: string;
  kind: string;
  counterparty: string;
  reason: string;
  lines: StockLine[];
}) {
  return {
    ...value,
    lines: value.lines.map((l) => ({
      partId: l.partId,
      quantity: l.quantity,
      unitCost: l.unitCost ?? undefined,
      requestId: l.requestId || undefined,
      originalLineId: l.originalLineId || undefined,
      returnCondition: l.returnCondition || undefined,
      expectedBalanceVersion: l.expectedBalanceVersion || undefined,
    })),
  };
}
