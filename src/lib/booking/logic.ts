import type {
  Booking,
  BookingAction,
  BookingDraft,
  BookingStatus,
} from "./types";

export function createDemoId() {
  return (
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
  );
}

export const statuses: Record<BookingStatus, string> = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  arrived: "Đã đến",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
  no_show: "Không đến",
};
export const actionLabels: Record<BookingAction, string> = {
  confirm: "Xác nhận lịch",
  arrive: "Tiếp nhận xe",
  complete: "Hoàn thành",
  cancel: "Hủy lịch",
  no_show: "Không đến",
};
export const actionStatuses: Record<BookingAction, BookingStatus> = {
  confirm: "confirmed",
  arrive: "arrived",
  complete: "completed",
  cancel: "cancelled",
  no_show: "no_show",
};
export const sources = [
  "Điện thoại",
  "Tại trạm",
  "Website",
  "QR",
  "Zalo",
] as const;
export function localDate(value: Date = new Date()) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}
export function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return localDate(d);
}
export function validDate(date: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !Number.isNaN(new Date(`${date}T12:00:00`).getTime()) &&
    localDate(new Date(`${date}T12:00:00`)) === date
  );
}
export const bookingTime = (b: Booking) => b.confirmedAt || b.requestedAt;
export const terminal = (s: BookingStatus) =>
  ["completed", "cancelled", "no_show"].includes(s);
export function allowedActions(b: Booking, now = new Date()): BookingAction[] {
  if (b.status === "pending") return ["confirm", "cancel"];
  if (b.status === "confirmed")
    return new Date(bookingTime(b)) <= now
      ? ["arrive", "cancel", "no_show"]
      : ["arrive", "cancel"];
  if (b.status === "arrived") return ["complete"];
  return [];
}
export function transitionBooking(
  b: Booking,
  action: BookingAction,
  now = new Date(),
): Booking {
  if (!allowedActions(b, now).includes(action))
    throw new Error("Thao tác không còn phù hợp với trạng thái lịch hẹn.");
  return {
    ...b,
    status: actionStatuses[action],
    confirmedAt:
      action === "confirm" ? b.confirmedAt || b.requestedAt : b.confirmedAt,
    events: [
      ...b.events,
      {
        id: createDemoId(),
        at: now.toISOString(),
        label: actionLabels[action],
        detail: "Cố vấn dịch vụ",
      },
    ],
  };
}
export const formatDate = (
  value: string,
  options?: Intl.DateTimeFormatOptions,
) =>
  new Intl.DateTimeFormat(
    "vi-VN",
    options || { day: "2-digit", month: "2-digit", year: "numeric" },
  ).format(new Date(value.length === 10 ? `${value}T12:00:00` : value));
export const timeLabel = (value: string) => value.slice(11, 16);
export function validateDraft(
  draft: BookingDraft,
  today = localDate(),
  existing?: Booking,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (draft.name.trim().length < 2)
    errors.name = "Nhập họ tên khách hàng (ít nhất 2 ký tự).";
  if (!/^(0\d{9}|\+84\d{9})$/.test(draft.phone.replace(/[\s.-]/g, "")))
    errors.phone = "Nhập số điện thoại Việt Nam hợp lệ (10 số hoặc +84).";
  if (!draft.model.trim()) errors.model = "Nhập dòng xe.";
  if (!draft.serviceIds.length) errors.serviceIds = "Chọn ít nhất một dịch vụ.";
  if (!validDate(draft.date) || (!existing && draft.date < today))
    errors.date = "Chọn ngày hợp lệ từ hôm nay.";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time))
    errors.time = "Chọn giờ hẹn hợp lệ.";
  if (Boolean(draft.confirmedDate) !== Boolean(draft.confirmedTime))
    errors.confirmedTime =
      "Nhập đủ ngày và giờ xác nhận, hoặc để trống cả hai.";
  if (
    draft.confirmedDate &&
    (!validDate(draft.confirmedDate) ||
      (!existing && draft.confirmedDate < today))
  )
    errors.confirmedDate = "Ngày xác nhận không hợp lệ.";
  if (
    draft.confirmedTime &&
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.confirmedTime)
  )
    errors.confirmedTime = "Giờ xác nhận không hợp lệ.";
  if (!draft.advisorId) errors.advisorId = "Chọn cố vấn phụ trách.";
  return errors;
}
