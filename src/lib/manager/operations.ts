import type { ServiceOrder, ServiceEvent } from "@/lib/advisor/types";
import { quoteTotals } from "@/lib/advisor/seed";
import { createDemoId } from "@/lib/booking/logic";
import type { ManagerData } from "./mock";

export const operationStages = {
  reception: "Đang tiếp nhận",
  quote: "Chờ báo giá",
  work: "Đang thi công",
  acceptance: "Chờ nghiệm thu",
  done: "Hoàn tất",
} as const;
export type OperationStage = keyof typeof operationStages;
export const quoteStatuses = {
  draft: "Bản nháp",
  waiting: "Chờ khách xác nhận",
  confirmed: "Đã xác nhận",
  rejected: "Khách từ chối",
} as const;
export type ManagerOrder = Omit<ServiceOrder, "stage"> & {
  stage: OperationStage;
  stageChangedAt: string;
  priority: boolean;
  holdReason: string;
  quoteUpdatedAt: string;
  quoteCreatedBy: string;
  quoteHistory: {
    id: string;
    at: string;
    actor: string;
    before: number;
    after: number;
    detail: string;
  }[];
};
export type InventoryPart = {
  id: string;
  name: string;
  unit: string;
  stock: number;
  minimum: number;
  supplier: string;
};
export type StockMovement = {
  id: string;
  partId: string;
  kind: "in" | "out";
  quantity: number;
  at: string;
  orderId: string;
  warehouse: string;
};
export type WorkShift = {
  id: string;
  staffId: string;
  date: string;
  start: string;
  end: string;
  state: "present" | "scheduled" | "leave";
  note: string;
};
export type StoreHoliday = { date: string; reason: string };
export type OperationsData = {
  orders: ManagerOrder[];
  parts: InventoryPart[];
  movements: StockMovement[];
  shifts: WorkShift[];
  holidays: StoreHoliday[];
};

export function orderAmounts(order: ManagerOrder) {
  const quote = quoteTotals(order.quote.lines, order.quote.discount);
  const received = order.finance.deposit + order.finance.collected;
  return {
    ...quote,
    received,
    debt:
      order.quote.status === "confirmed"
        ? Math.max(0, quote.total - received)
        : null,
  };
}
export function paymentLabel(order: ManagerOrder) {
  const a = orderAmounts(order);
  return a.debt === null
    ? "Chưa chốt giá"
    : a.debt === 0
      ? "Đã thu đủ"
      : a.received > 0
        ? "Thu một phần"
        : "Chưa thanh toán";
}
export function orderEvent(label: string, detail: string): ServiceEvent {
  return {
    id: createDemoId(),
    at: new Date().toISOString(),
    label,
    detail,
  };
}
export function staffWorkload(data: ManagerData, staffId: string, now: number) {
  const orders = data.orders.filter(
    (o) =>
      o.stage !== "done" &&
      (o.advisorId === staffId || o.work.technician === staffId),
  );
  return {
    orders,
    tasks: orders.reduce(
      (s, o) => s + o.work.checklist.filter((t) => !t.done).length,
      0,
    ),
    overdue: orders.filter(
      (o) => o.work.dueAt && Date.parse(o.work.dueAt) < now,
    ).length,
    bookings: data.bookings.filter(
      (b) =>
        b.advisorId === staffId &&
        !["cancelled", "completed", "no_show"].includes(b.status),
    ).length,
  };
}
export type OperationsAlert = {
  id: string;
  type: string;
  priority: "danger" | "warning" | "blue";
  title: string;
  detail: string;
  at: string;
  target: string;
  href: string;
};
export function operationAlerts(
  data: ManagerData,
  now: number,
): OperationsAlert[] {
  const alerts: OperationsAlert[] = [];
  const push = (a: OperationsAlert) => alerts.push(a);
  for (const b of data.bookings) {
    const at = `${b.date}T${b.time}:00+07:00`;
    if (b.changeKind === "rescheduled" || b.changeKind === "cancelled")
      push({
        id: `change-${b.id}`,
        type: "booking",
        priority: "blue",
        title:
          b.changeKind === "cancelled"
            ? "Lịch đã hủy cần đối chiếu"
            : "Lịch đã đổi thời gian",
        detail: "Xem lý do và thời gian cũ / mới trong nhật ký.",
        at,
        target: b.id,
        href: `/dieu-hanh/lich-hen?selected=${b.id}&date=${b.date}`,
      });
    if (b.status === "pending")
      push({
        id: `pending-${b.id}`,
        type: "booking",
        priority: "warning",
        title: "Lịch chờ xác nhận",
        detail: !b.advisorId
          ? "Chưa phân công cố vấn"
          : "Cần liên hệ khách hàng",
        at,
        target: b.id,
        href: `/dieu-hanh/lich-hen?selected=${b.id}&date=${b.date}`,
      });
    if (b.status === "confirmed" && Date.parse(at) < now)
      push({
        id: `late-${b.id}`,
        type: "booking",
        priority: "warning",
        title: "Quá giờ hẹn, chưa check-in",
        detail: "Kiểm tra và liên hệ khách; chưa tự đánh dấu không đến.",
        at,
        target: b.id,
        href: `/dieu-hanh/lich-hen?selected=${b.id}&date=${b.date}`,
      });
  }
  for (const s of data.capacity.filter(
    (s) => s.reserved >= s.total * 0.8 && !s.locked,
  ))
    push({
      id: `capacity-${s.id}`,
      type: "capacity",
      priority: s.reserved >= s.total ? "danger" : "warning",
      title:
        s.reserved >= s.total ? "Khung giờ hết năng lực" : "Khung giờ gần đầy",
      detail: `${s.group} · ${s.reserved}/${s.total} ${s.unit}`,
      at: `${s.date}T${s.time.slice(0, 5)}:00+07:00`,
      target: s.time,
      href: `/dieu-hanh/nang-luc?date=${s.date}`,
    });
  for (const o of data.orders.filter((o) => o.stage !== "done")) {
    const href = `/dieu-hanh/phieu-dich-vu?selected=${o.id}`;
    const base = { at: o.work.dueAt || o.openedAt, target: o.id, href };
    if (
      o.work.dueAt &&
      Date.parse(o.work.dueAt) >= now &&
      Date.parse(o.work.dueAt) - now <= 3600000
    )
      push({
        ...base,
        id: `soon-${o.id}`,
        type: "deadline",
        priority: "warning",
        title: "Sắp đến thời gian dự kiến (trong 60 phút)",
        detail: "Kiểm tra tiến độ và khả năng hoàn thành",
      });
    if (
      o.quote.status === "confirmed" &&
      !o.work.startedAt &&
      o.stage !== "reception"
    )
      push({
        ...base,
        id: `not-started-${o.id}`,
        type: "work",
        priority: "warning",
        title: "Đã chốt báo giá, chưa bắt đầu thi công",
        detail: "Kiểm tra phân công và lịch làm việc",
      });
    if (o.work.dueAt && Date.parse(o.work.dueAt) < now)
      push({
        ...base,
        id: `deadline-${o.id}`,
        type: "deadline",
        priority: "danger",
        title: "Xe quá thời gian dự kiến",
        detail:
          data.customers.find((c) => c.id === o.customerId)?.plate || o.id,
      });
    if (!o.advisorId || !o.work.technician)
      push({
        ...base,
        id: `assignment-${o.id}`,
        type: "assignment",
        priority: "warning",
        title: "Phiếu chưa đủ người phụ trách",
        detail: !o.advisorId ? "Chưa có CVDV" : "Chưa phân công KTV",
      });
    if (o.holdReason)
      push({
        ...base,
        id: `hold-${o.id}`,
        type: "work",
        priority: "danger",
        title: "Công việc đang đình trệ",
        detail: o.holdReason,
      });
    if (
      o.quote.status === "waiting" &&
      now - Date.parse(o.quoteUpdatedAt) > 2 * 3600000
    )
      push({
        ...base,
        at: o.quoteUpdatedAt,
        id: `quote-${o.id}`,
        type: "quote",
        priority: "warning",
        title: "Báo giá chờ khách quá 2 giờ",
        detail: o.quote.id,
        href: `/dieu-hanh/bao-gia?selected=${o.id}`,
      });
    if (o.stage === "acceptance")
      push({
        ...base,
        id: `acceptance-${o.id}`,
        type: "acceptance",
        priority:
          now - Date.parse(o.stageChangedAt) > 2 * 3600000 ? "warning" : "blue",
        title:
          now - Date.parse(o.stageChangedAt) > 2 * 3600000
            ? "Xe chờ nghiệm thu quá 2 giờ"
            : "Xe chờ nghiệm thu",
        at: o.stageChangedAt,
        detail: "Kiểm tra checklist và kết quả nghiệm thu",
      });
  }
  for (const p of data.parts.filter((p) => p.stock < p.minimum))
    push({
      id: `stock-${p.id}`,
      type: "stock",
      priority: "warning",
      title: "Phụ tùng dưới định mức",
      detail: `${p.name}: ${p.stock}/${p.minimum} ${p.unit}`,
      at: "",
      target: p.id,
      href: "/dieu-hanh/kho",
    });
  for (const s of data.staff) {
    const w = staffWorkload(data, s.id, now);
    if (w.orders.length > 3)
      push({
        id: `load-${s.id}`,
        type: "assignment",
        priority: "warning",
        title: "Nhân viên có nhiều xe đang xử lý",
        detail: `${s.name}: ${w.orders.length} xe`,
        at: "",
        target: s.id,
        href: "/dieu-hanh/nhan-su",
      });
  }
  return alerts.sort(
    (a, b) =>
      ({ danger: 0, warning: 1, blue: 2 })[a.priority] -
      { danger: 0, warning: 1, blue: 2 }[b.priority],
  );
}
