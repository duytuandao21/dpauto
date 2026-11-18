"use client";
import { formatPlate } from "@/lib/advisor/formats";
import { useRef, useState } from "react";
import Link from "next/link";
import {
  actionLabels,
  allowedActions,
  bookingTime,
  formatDate,
  slotLabel,
  terminal,
} from "@/lib/booking/logic";
import type { Booking, BookingAction } from "@/lib/booking/types";
import { useBookings } from "./booking-provider";
import { AdminIcon } from "./admin-icon";
import { useAdvisor } from "@/components/advisor/advisor-provider";
import { useSession } from "./auth-gate";
import { BookingTimeForm } from "./booking-time-form";
import { apiEnabled } from "@/lib/api/client";
import { bookingServices as seedServices } from "@/lib/booking/seed";

export function BookingActions({
  booking,
  compact = false,
  secondaryOnly = false,
}: {
  booking: Booking;
  compact?: boolean;
  secondaryOnly?: boolean;
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
      message: `${customer?.name} · ${booking.id} · ${formatDate(bookingTime(booking))} · ${slotLabel(booking)}.`,
      label: actionLabels[action],
      danger: ["cancel", "no_show"].includes(action),
      buttonTone:
        action === "confirm" || action === "arrive" || action === "complete"
          ? action
          : undefined,
      onConfirm: () => act(booking.id, action),
    });
  }
  if (!secondaryOnly && terminal(booking.status))
    return (
      <Link className="adm-btn" href={`/co-van/lich-hen/${booking.id}`}>
        {booking.status === "completed" ? "Xem lịch sử" : "Xem chi tiết"}
      </Link>
    );
  if (secondaryOnly && terminal(booking.status)) return null;
  if (booking.serviceVisitId && !secondaryOnly)
    return (
      <Link
        className="adm-btn adm-primary adm-booking-action adm-action-arrive"
        href={`/co-van/phieu-dich-vu/${booking.serviceVisitId}`}
      >
        Xem phiếu dịch vụ
      </Link>
    );
  return (
    <div className={`adm-booking-actions ${compact ? "is-compact" : ""}`}>
      {!secondaryOnly &&
        primary &&
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
        ) : primary === "confirm" ? (
          // Confirming means entering the exact time agreed with the customer.
          <RescheduleButton booking={booking} confirm />
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
      {(!compact || secondaryOnly) &&
        actions.slice(1).map((a) =>
          apiEnabled ? (
            <BookingReasonButton key={a} booking={booking} action={a} />
          ) : (
            <button
              key={a}
              className={`adm-btn ${a === "cancel" ? "adm-danger" : "adm-subtle-danger"}`}
              onClick={() => request(a)}
            >
              {actionLabels[a]}
            </button>
          ),
        )}
    </div>
  );
}
export function RescheduleButton({
  booking,
  confirm = false,
}: {
  booking: Booking;
  confirm?: boolean;
}) {
  const { data, reschedule, theme } = useBookings();
  const session = useSession();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  if (!["pending", "confirmed"].includes(booking.status)) return null;
  return (
    <>
      <button
        className={
          confirm
            ? "adm-btn adm-primary adm-booking-action adm-action-confirm"
            : "adm-btn"
        }
        onClick={() => {
          setOpen(true);
          dialog.current?.showModal();
        }}
      >
        {confirm ? "Chốt lịch" : "Đổi giờ"}
      </button>
      <dialog
        ref={dialog}
        className={`adm-dialog${confirm ? " adv-booking-confirm-dialog" : ""}`}
        data-theme={theme}
        aria-labelledby={`booking-time-${booking.id}-${confirm}`}
        onClose={() => setOpen(false)}
      >
        <div className={confirm ? "adv-booking-confirm-heading" : undefined}>
          <div>
            <h2 id={`booking-time-${booking.id}-${confirm}`}>
              {confirm ? "Chốt lịch hẹn" : "Đổi giờ hẹn"}
            </h2>
            {confirm && <p>Xác nhận giờ tiếp nhận với khách</p>}
          </div>
          {confirm && (
            <button
              type="button"
              className="adm-icon-btn"
              autoFocus
              aria-label="Đóng form chốt lịch"
              onClick={() => dialog.current?.close()}
            >
              <AdminIcon name="close" />
            </button>
          )}
        </div>
        {open && (
          <BookingTimeForm
            key={`${booking.id}-${booking.version}`}
            booking={{
              ...booking,
              customerSnapshot:
                booking.customerSnapshot ||
                data.customers.find((c) => c.id === booking.customerId),
              vehicleSnapshot:
                booking.vehicleSnapshot ||
                data.vehicles.find((v) => v.id === booking.vehicleId),
              serviceNames: Object.fromEntries(
                booking.serviceIds.map((id) => [
                  id,
                  booking.serviceNames?.[id] ||
                    (data.services ?? seedServices).find((s) => s.id === id)
                      ?.name ||
                    "Chưa có tên dịch vụ",
                ]),
              ),
            }}
            confirm={confirm}
            advisors={data.advisors || []}
            pickAdvisor={
              confirm &&
              !booking.advisorId &&
              !!session?.roles.includes("MANAGER")
            }
            onCancel={() => dialog.current?.close()}
            onSave={async ({ date, time, advisorId, note }) => {
              await reschedule(
                booking.id,
                date,
                time,
                confirm,
                advisorId || undefined,
                note,
              );
              dialog.current?.close();
            }}
          />
        )}
      </dialog>
    </>
  );
}
export function EditBookingLink({ booking }: { booking: Booking }) {
  if (!["pending", "confirmed"].includes(booking.status)) return null;
  return (
    <Link className="adm-btn" href={`/co-van/lich-hen/${booking.id}?edit=1`}>
      Sửa thông tin
    </Link>
  );
}

export function BookingReasonButton({
  booking,
  action,
}: {
  booking: Booking;
  action: BookingAction;
}) {
  const { act, theme } = useBookings();
  const ref = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <button
        className="adm-btn adm-danger"
        onClick={() => {
          setError("");
          setReason("");
          setChecked(false);
          ref.current?.showModal();
        }}
      >
        {actionLabels[action]}
      </button>
      <dialog
        className="adm-dialog"
        data-theme={theme}
        ref={ref}
        aria-labelledby={`reason-${booking.id}-${action}`}
        onCancel={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            setError("");
            try {
              await act(booking.id, action, reason);
              ref.current?.close();
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Chưa thể cập nhật lịch.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2 id={`reason-${booking.id}-${action}`}>{actionLabels[action]}</h2>
          <p>
            {booking.code || booking.id} · {booking.customerSnapshot?.name} ·{" "}
            {formatPlate(booking.vehicleSnapshot?.plate) ||
              booking.vehicleSnapshot?.model}{" "}
            · {formatDate(bookingTime(booking))} {slotLabel(booking)}
          </p>
          <label className="adm-field">
            Lý do thực tế
            <textarea
              required
              maxLength={400}
              rows={3}
              value={reason}
              disabled={busy}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          {action === "no_show" && (
            <label className="adm-consent">
              <input
                type="checkbox"
                required
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
              />
              Đã liên hệ và kiểm tra khách chưa đến trạm
            </label>
          )}
          {error && (
            <p className="adm-error-text" role="alert">
              {error}
            </p>
          )}
          <div className="adm-dialog-actions">
            <button
              type="button"
              className="adm-btn"
              disabled={busy}
              onClick={() => ref.current?.close()}
            >
              Quay lại
            </button>
            <button
              className="adm-btn adm-danger"
              disabled={
                busy || !reason.trim() || (action === "no_show" && !checked)
              }
            >
              {busy ? "Đang lưu…" : actionLabels[action]}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
