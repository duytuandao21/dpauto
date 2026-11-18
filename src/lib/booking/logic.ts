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
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}
export function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T12:00:00+07:00`);
  d.setUTCDate(d.getUTCDate() + days);
  return localDate(d);
}
export function validDate(date: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !Number.isNaN(new Date(`${date}T12:00:00+07:00`).getTime()) &&
    localDate(new Date(`${date}T12:00:00+07:00`)) === date
  );
}
export const bookingTime = (b: Booking) =>
  b.scheduledAt || b.confirmedAt || b.requestedAt;
export const terminal = (s: BookingStatus) =>
  ["completed", "cancelled", "no_show"].includes(s);
export function allowedActions(b: Booking, now = new Date()): BookingAction[] {
  if (b.allowedActions)
    return b.allowedActions.filter((a): a is BookingAction =>
      ["confirm", "arrive", "cancel", "no_show"].includes(a),
    );
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
  new Intl.DateTimeFormat("vi-VN", {
    ...(options || { day: "2-digit", month: "2-digit", year: "numeric" }),
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(stationDate(value));
const stationDate = (value: string) =>
  new Date(
    value.length === 10
      ? `${value}T12:00:00+07:00`
      : /(?:Z|[+-]\d{2}:\d{2})$/.test(value)
        ? value
        : `${value}+07:00`,
  );
export const timeLabel = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).format(stationDate(value));
export const periodLabels = { morning: "Buổi sáng", afternoon: "Buổi chiều" };
const warningLabels: Record<string, string> = {
  SLOT_OVERLOADED: "khung giờ đã vượt số xe khuyến nghị",
  ADVISOR_TIME_CONFLICT: "cố vấn có lịch khác trong khoảng thời gian dự kiến",
  SLOT_CLOSED: "khung giờ đang tạm đóng",
  OUTSIDE_HOURS: "giờ hẹn ngoài giờ làm việc",
};
/** Capacity warnings are advisory; preview them before committing where possible. */
export const warningText = (codes: string[] = []) =>
  codes.length
    ? " Lưu ý: " + codes.map((c) => warningLabels[c] || c).join("; ") + "."
    : "";
/** "Buổi sáng"/"Buổi chiều" for a pending day+period request, otherwise the exact time. */
export const slotLabel = (b: Booking) =>
  b.period ? periodLabels[b.period] : timeLabel(bookingTime(b));
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
  if (draft.serviceIds.length > 10)
    errors.serviceIds = "Chọn tối đa 10 dịch vụ cho một lịch hẹn.";
  if (!validDate(draft.date) || (!existing && draft.date < today))
    errors.date = "Chọn ngày hợp lệ từ hôm nay.";
  if (
    !(draft.period && !draft.confirmNow) &&
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time)
  )
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
  if (!draft.advisorId && !existing && draft.confirmNow)
    errors.advisorId = "Chọn cố vấn phụ trách.";
  return errors;
}
