"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  actionLabels,
  allowedActions,
  bookingTime,
  formatDate,
  localDate,
  terminal,
  timeLabel,
  validDate,
  statuses,
} from "@/lib/booking/logic";
import type { Booking, BookingAction } from "@/lib/booking/types";
import { useBookings } from "./booking-provider";
import { AdminIcon } from "./admin-icon";
import { StatusSymbol } from "./primitives";
import { useAdvisor } from "@/components/advisor/advisor-provider";

export function BookingActions({
  booking,
  compact = false,
}: {
  booking: Booking;
  compact?: boolean;
}) {
  const { data, act, ask } = useBookings(),
    actions = allowedActions(booking);
  const { orders } = useAdvisor();
  const order = orders.find((item) => item.bookingId === booking.id);
  const customer = data.customers.find((c) => c.id === booking.customerId);
  const primary = actions[0];
  function request(action: BookingAction) {
    ask({
      title: actionLabels[action] + "?",
      message: `${customer?.name} · ${booking.id} · ${formatDate(bookingTime(booking))} lúc ${timeLabel(bookingTime(booking))}.`,
      label: actionLabels[action],
      danger: ["cancel", "no_show"].includes(action),
      buttonTone:
        action === "confirm" || action === "arrive" || action === "complete"
          ? action
          : undefined,
      onConfirm: () => act(booking.id, action),
    });
  }
  if (terminal(booking.status))
    return (
      <span
        className={`adm-ended adm-ended-${booking.status} ${booking.status === "completed" ? "is-success" : ""}`}
      >
        <StatusSymbol status={booking.status} />
        {booking.status === "completed"
          ? "Đã hoàn thành"
          : statuses[booking.status]}
      </span>
    );
  return (
    <div className={`adm-booking-actions ${compact ? "is-compact" : ""}`}>
      {primary &&
        (primary === "complete" && order?.stage !== "done" ? (
          <Link
            className="adm-btn adm-primary adm-booking-action adm-action-arrive"
            href={
              order
                ? `/co-van/phieu-dich-vu/${order.id}`
                : `/co-van/tiep-nhan/${booking.id}`
            }
          >
            {order ? "Xử lý phiếu" : "Lập phiếu dịch vụ"}
          </Link>
        ) : primary === "arrive" ? (
          <Link
            className="adm-btn adm-primary adm-booking-action adm-action-arrive"
            href={`/co-van/tiep-nhan/${booking.id}`}
          >
            Tiếp nhận xe
          </Link>
        ) : (
          <button
            className={`adm-btn adm-primary adm-booking-action adm-action-${primary}`}
            onClick={() => request(primary)}
          >
            {primary === "complete" && <AdminIcon name="check" />}
            {actionLabels[primary]}
          </button>
        ))}
      {!compact &&
        actions.slice(1).map((a) => (
          <button
            key={a}
            className={`adm-btn ${a === "cancel" ? "adm-danger" : "adm-subtle-danger"}`}
            onClick={() => request(a)}
          >
            {actionLabels[a]}
          </button>
        ))}
    </div>
  );
}
export function RescheduleButton({ booking }: { booking: Booking }) {
  const { reschedule, ask, notify } = useBookings(),
    router = useRouter(),
    dialog = useRef<HTMLDialogElement>(null);
  const [date, setDate] = useState(bookingTime(booking).slice(0, 10)),
    [time, setTime] = useState(timeLabel(bookingTime(booking))),
    [error, setError] = useState("");
  if (!["pending", "confirmed"].includes(booking.status)) return null;
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (
      !validDate(date) ||
      date < localDate() ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
    ) {
      setError("Chọn ngày từ hôm nay và giờ hẹn hợp lệ.");
      return;
    }
    if (`${date}T${time}:00` === bookingTime(booking)) {
      setError("Bạn chưa thay đổi ngày hoặc giờ hẹn.");
      return;
    }
    dialog.current?.close();
    ask({
      title: "Xác nhận đổi lịch?",
      message: `${formatDate(bookingTime(booking))} ${timeLabel(bookingTime(booking))} → ${formatDate(date)} ${time}. Thời gian cũ và mới sẽ được ghi vào lịch sử thao tác.`,
      label: "Đổi lịch",
      onConfirm: () => {
        try {
          reschedule(booking.id, date, time);
          router.replace(`/co-van/lich-hen/${booking.id}?date=${date}`);
        } catch (e) {
          notify(e instanceof Error ? e.message : "Không đổi được lịch.");
        }
      },
    });
  }
  return (
    <>
      <button
        className="adm-btn"
        onClick={() => {
          setDate(bookingTime(booking).slice(0, 10));
          setTime(timeLabel(bookingTime(booking)));
          setError("");
          dialog.current?.showModal();
        }}
      >
        <AdminIcon name="calendar" />
        Đổi lịch
      </button>
      <dialog
        className="adm-dialog"
        ref={dialog}
        aria-labelledby={`reschedule-${booking.id}`}
      >
        <form onSubmit={submit} noValidate>
          <span className="adm-eyebrow">ĐIỀU CHỈNH THỜI GIAN</span>
          <h2 id={`reschedule-${booking.id}`}>Đổi lịch hẹn</h2>
          <p>
            {booking.id} · Thời gian cũ: {formatDate(bookingTime(booking))}{" "}
            {timeLabel(bookingTime(booking))}
          </p>
          <div className="adm-form-grid">
            <label className="adm-field">
              Ngày mới
              <input
                type="date"
                min={localDate()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label className="adm-field">
              Giờ mới
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </label>
          </div>
          {error && (
            <p role="alert" className="adm-error-text">
              {error}
            </p>
          )}
          <div className="adm-dialog-actions">
            <button
              type="button"
              className="adm-btn"
              onClick={() => dialog.current?.close()}
            >
              Quay lại
            </button>
            <button className="adm-btn adm-primary" type="submit">
              Tiếp tục
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
export function EditBookingLink({ booking }: { booking: Booking }) {
  if (terminal(booking.status)) return null;
  return (
    <Link className="adm-btn" href={`/co-van/lich-hen/${booking.id}?edit=1`}>
      Sửa thông tin
    </Link>
  );
}
