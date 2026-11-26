"use client";
import { DateInput } from "@/components/advisor/date-input";
import { formatPhone, formatPlate } from "@/lib/advisor/formats";
import { useState, type FormEvent } from "react";
import { apiEnabled, request } from "@/lib/api/client";
import {
  bookingTime,
  formatDate,
  localDate,
  periodLabels,
  slotLabel,
  timeLabel,
  validDate,
  warningText,
} from "@/lib/booking/logic";
import type { Advisor, Booking } from "@/lib/booking/types";
import { AdminIcon } from "./admin-icon";
import { Icon } from "@/components/ui/icon";

export type BookingTimeInput = {
  date: string;
  time: string;
  advisorId: string;
  note: string;
};

export function BookingTimeForm({
  booking,
  confirm = false,
  advisors,
  pickAdvisor = false,
  summary = true,
  onSave,
  onCancel,
}: {
  booking: Booking;
  confirm?: boolean;
  advisors: Advisor[];
  pickAdvisor?: boolean;
  /** false where the customer and vehicle are already shown above (manager drawer). */
  summary?: boolean;
  onSave: (value: BookingTimeInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(bookingTime(booking).slice(0, 10));
  const [time, setTime] = useState(
    confirm
      ? booking.confirmedAt
        ? timeLabel(booking.confirmedAt)
        : ""
      : booking.period || timeLabel(bookingTime(booking)),
  );
  const [advisorId, setAdvisorId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const isPeriod = time === "morning" || time === "afternoon";
  const serviceNames = booking.serviceIds
    .map((id) => booking.serviceNames?.[id])
    .filter(Boolean);
  const noteField = (
    <label className="adm-field adm-span-full">
      {confirm ? "Nội dung ghi chú" : "Lý do đổi giờ (nếu có)"}
      <textarea
        rows={2}
        maxLength={confirm ? 1000 : 400}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
    </label>
  );
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (
      !validDate(date) ||
      date < localDate() ||
      (!isPeriod && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) ||
      (confirm && isPeriod)
    ) {
      setError(
        "Chọn ngày hợp lệ từ hôm nay và nhập giờ đã thống nhất với khách.",
      );
      return;
    }
    if (pickAdvisor && !advisorId) {
      setError("Chọn cố vấn phụ trách.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (apiEnabled && !isPeriod && warnings === null) {
        const params = new URLSearchParams({
          action: confirm ? "confirm" : "reschedule",
          expectedVersion: String(booking.version),
          startAt: `${date}T${time}:00+07:00`,
          ...(pickAdvisor ? { advisorId } : {}),
        });
        const result = await request<{ warnings: string[] }>(
          `admin/bookings/${booking.id}/preview?${params}`,
        );
        if (result.data.warnings.length) {
          setWarnings(result.data.warnings);
          return;
        }
      }
      await onSave({ date, time, advisorId, note });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không cập nhật được lịch.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className={`adm-booking-time-form${confirm ? " adv-booking-confirm-form" : ""}`}
      onSubmit={submit}
      onChange={() => setWarnings(null)}
    >
      {summary && (
      <div className={confirm ? "adv-booking-confirm-customer" : "adm-note"}>
        <div>
          <strong>
            {booking.customerSnapshot?.name || "Chưa có thông tin khách hàng"}
          </strong>
          {!confirm && booking.customerSnapshot?.phone && (
            <p>
              <a
                className="adm-phone"
                href={`tel:${formatPhone(booking.customerSnapshot.phone)}`}
              >
                {formatPhone(booking.customerSnapshot.phone)}
              </a>
            </p>
          )}
          <p>
            {booking.vehicleSnapshot?.model || "Chưa có thông tin xe"}
            {booking.vehicleSnapshot?.plate
              ? ` · ${formatPlate(booking.vehicleSnapshot.plate)}`
              : ""}
          </p>
          {!confirm && <p>{serviceNames.join(", ")}</p>}
        </div>
        {confirm && booking.customerSnapshot?.phone && (
          <a
            className="adm-btn"
            href={`tel:${formatPhone(booking.customerSnapshot.phone)}`}
            aria-label={`Gọi ${booking.customerSnapshot.name}`}
            title={`Gọi ${formatPhone(booking.customerSnapshot.phone)}`}
          >
            <AdminIcon name="phone" />
          </a>
        )}
      </div>
      )}
      {summary && confirm &&
        (serviceNames.length > 2 ? (
          <details className="adv-booking-confirm-services">
            <summary>
              <span>{serviceNames.slice(0, 2).join(", ")}</span>
              <span className="adv-booking-services-more">
                +{serviceNames.length - 2} dịch vụ khác <Icon name="chevron" />
              </span>
            </summary>
            <ul>
              {serviceNames.slice(2).map((name, index) => (
                <li key={index}>{name}</li>
              ))}
            </ul>
          </details>
        ) : (
          <p className="adv-booking-confirm-services">
            {serviceNames.join(", ") || "Chưa chọn dịch vụ"}
          </p>
        ))}
      <p className={confirm ? "adv-booking-confirm-request" : undefined}>
        {confirm && <AdminIcon name="calendar" />}
        <span>
          <span>Khách yêu cầu:</span>{" "}
          <strong>
            {formatDate(booking.requestedAt)} ·{" "}
            {booking.originalPeriod
              ? periodLabels[booking.originalPeriod]
              : timeLabel(booking.requestedAt)}
          </strong>
        </span>
      </p>
      <fieldset disabled={busy} className="adm-form-grid adm-booking-fields">
        {confirm && <legend>Thời gian đã thống nhất</legend>}
        <label className="adm-field">
          {confirm ? "Ngày hẹn" : "Ngày hẹn chính thức"}
          <DateInput
            required
            min={localDate()}
            value={date}
            onValueChange={setDate}
          />
        </label>
        {!confirm && booking.status === "pending" && (
          <label className="adm-field">
            Thời gian
            <select
              value={isPeriod ? time : "exact"}
              onChange={(e) =>
                setTime(e.target.value === "exact" ? "" : e.target.value)
              }
            >
              <option value="morning">Buổi sáng</option>
              <option value="afternoon">Buổi chiều</option>
              <option value="exact">Giờ cụ thể</option>
            </select>
          </label>
        )}
        {!isPeriod && (
          <label className="adm-field">
            {confirm ? "Giờ hẹn (24h)" : "Giờ hẹn chính thức"}
            <input
              required
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </label>
        )}
        {confirm && (
          <p className="adm-span-full adv-booking-confirm-hint">
            Theo thời gian đã trao đổi với khách.
          </p>
        )}
        {pickAdvisor && (
          <label className={`adm-field${confirm ? " adm-span-full" : ""}`}>
            Cố vấn phụ trách
            <select
              required
              value={advisorId}
              onChange={(e) => setAdvisorId(e.target.value)}
            >
              <option value="">Chọn cố vấn</option>
              {advisors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {confirm ? (
          <details className="adv-booking-confirm-notes adm-span-full">
            <summary>
              <span>
                Ghi chú nội bộ{" "}
                <span className="adm-muted">(không bắt buộc)</span>
              </span>
              <Icon name="chevron" />
            </summary>
            {noteField}
          </details>
        ) : (
          noteField
        )}
      </fieldset>
      {warnings && (
        <div className="adm-note" role="status">
          <strong>Cần lưu ý trước khi xác nhận</strong>
          <p>{warningText(warnings)}</p>
        </div>
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
          onClick={onCancel}
        >
          {confirm ? "Hủy" : "Quay lại"}
        </button>
        <button
          className={`adm-btn adm-primary${confirm ? " adm-booking-action adm-action-confirm" : ""}`}
          disabled={busy}
          type="submit"
        >
          {confirm && !busy && <AdminIcon name="check" />}
          {busy
            ? "Đang lưu…"
            : warnings
              ? "Vẫn xác nhận"
              : confirm
                ? "Xác nhận lịch hẹn"
                : "Lưu giờ mới"}
        </button>
      </div>
    </form>
  );
}
