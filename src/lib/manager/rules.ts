import type { ManagerBooking, ManagerData } from "./mock";
export type BookingChange = "confirm" | "reschedule" | "cancel";
export function validateBookingChange(
  data: ManagerData,
  booking: ManagerBooking,
  action: BookingChange,
  date: string,
  time: string,
  reason: string,
  agreed: boolean,
): string {
  if (!reason.trim()) return "Nhập lý do thao tác.";
  if (action === "confirm" && booking.status !== "pending")
    return "Chỉ xác nhận lịch đang chờ.";
  if (
    action !== "confirm" &&
    !["pending", "confirmed"].includes(booking.status)
  )
    return "Chỉ đổi hoặc hủy lịch chưa tiếp nhận.";
  if (action === "cancel") return "";
  if (!agreed) return "Cần xác nhận đã thống nhất thời gian với khách.";
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ||
    !Number.isFinite(Date.parse(`${date}T${time}:00+07:00`)) ||
    new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date
  )
    return "Chọn ngày và giờ hợp lệ.";
  if (time < data.settings.open || time >= data.settings.close)
    return "Giờ hẹn nằm ngoài giờ hoạt động.";
  if (data.holidays.some((h) => h.date === date))
    return "Ngày đã ngừng nhận lịch; chọn ngày phục vụ khác.";
  if (action === "reschedule") {
    if (date === booking.date && time === booking.time)
      return "Chọn thời gian mới khác lịch hiện tại.";
    const groups = data.services
      .filter((s) => booking.serviceIds.includes(s.id))
      .map((s) => s.group);
    const relevant = data.capacity.filter(
      (s) =>
        s.date === date &&
        groups.includes(s.group) &&
        time >= s.time.slice(0, 5) &&
        time < s.time.slice(-5),
    );
    if (
      !relevant.length ||
      groups.some((group) => !relevant.some((s) => s.group === group))
    )
      return "Ngày / nhóm dịch vụ chưa có cấu hình năng lực. Kiểm tra trang Khung giờ & năng lực.";
    if (
      relevant.some((s) => {
        const needed = data.services
          .filter(
            (service) =>
              booking.serviceIds.includes(service.id) &&
              service.group === s.group,
          )
          .reduce((n, service) => n + service.duration, 0);
        const held = (booking.holds || [])
          .filter((h) => h.slotId === s.id)
          .reduce((n, h) => n + h.minutes, 0);
        return s.locked || s.total - s.reserved + held < needed;
      })
    )
      return "Khung giờ đang khóa hoặc đã hết năng lực.";
  }
  return "";
}

export function applyBookingChange(
  data: ManagerData,
  booking: ManagerBooking,
  action: BookingChange,
  date: string,
  time: string,
): ManagerData {
  const holds =
    action === "reschedule"
      ? data.services
          .filter((s) => booking.serviceIds.includes(s.id))
          .flatMap((service) => {
            const slot = data.capacity.find(
              (s) =>
                s.date === date &&
                s.group === service.group &&
                time >= s.time.slice(0, 5) &&
                time < s.time.slice(-5),
            );
            return slot ? [{ slotId: slot.id, minutes: service.duration }] : [];
          })
      : action === "cancel"
        ? []
        : booking.holds || [];
  return {
    ...data,
    bookings: data.bookings.map((b) =>
      b.id === booking.id
        ? {
            ...b,
            status:
              action === "confirm"
                ? "confirmed"
                : action === "cancel"
                  ? "cancelled"
                  : b.status,
            date: action === "reschedule" ? date : b.date,
            time: action === "reschedule" ? time : b.time,
            changeKind:
              action === "cancel"
                ? "cancelled"
                : action === "reschedule"
                  ? "rescheduled"
                  : b.changeKind,
            holds,
          }
        : b,
    ),
    capacity: data.capacity.map((slot) => {
      const before = (booking.holds || [])
        .filter((h) => h.slotId === slot.id)
        .reduce((n, h) => n + h.minutes, 0);
      const after = holds
        .filter((h) => h.slotId === slot.id)
        .reduce((n, h) => n + h.minutes, 0);
      const reserved = Math.max(0, slot.reserved - before + after);
      return {
        ...slot,
        reserved,
        state:
          reserved >= slot.total
            ? "full"
            : reserved >= slot.total * 0.8
              ? "limited"
              : "available",
      };
    }),
  };
}
