"use client";

import { useEffect, useState } from "react";
import { apiEnabled } from "@/lib/api/client";
import Link from "next/link";
import {
  validateBookingChange,
  applyBookingChange,
  type BookingChange,
} from "@/lib/manager/rules";
import { orderEvent } from "@/lib/manager/operations";
import { StatusBadge } from "@/components/admin/primitives";
import { AdminIcon } from "@/components/admin/admin-icon";
import { formatDate, periodLabels, timeLabel } from "@/lib/booking/logic";
import type { ManagerBooking } from "@/lib/manager/mock";
import { useManager } from "./manager-provider";
import { ManagerEmpty, ManagerField } from "./manager-ui";
import { ManagerModal } from "./manager-modal";
import { BookingTimeForm } from "@/components/admin/booking-time-form";
import { bookingFromApi } from "@/lib/api/booking-adapter";
import { request, collection } from "@/lib/api/client";
import type { ApiBooking } from "@/lib/api/types";
import type { Booking } from "@/lib/booking/types";

export function ManagerBookingTable({
  bookings,
  onSelect,
}: {
  bookings: ManagerBooking[];
  onSelect: (id: string) => void;
}) {
  const { data } = useManager();
  if (!bookings.length) return <ManagerEmpty />;
  return (
    <div className="mgr-table-scroll">
      <table className="mgr-table mgr-booking-table">
        <caption className="mgr-sr-only">Danh sách lịch hẹn toàn trạm</caption>
        <thead>
          <tr>
            <th>Mã lịch / Khách hàng</th>
            <th>Phương tiện</th>
            <th>Dịch vụ</th>
            <th>Ngày giờ</th>
            <th>Phụ trách</th>
            <th>Trạng thái</th>
            <th>
              <span className="mgr-sr-only">Thao tác</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((booking) => {
            const profile = data.customers.find(
              (item) => item.id === booking.customerId,
            );
            const customer = {
              ...profile,
              ...booking.customerSnapshot,
              model:
                booking.vehicleSnapshot === null
                  ? ""
                  : booking.vehicleSnapshot?.model || profile?.model,
              plate:
                booking.vehicleSnapshot === null
                  ? ""
                  : booking.vehicleSnapshot?.plate || profile?.plate,
            };
            return (
              <tr key={booking.id}>
                <td data-label="Khách hàng">
                  <button
                    className="mgr-id-link"
                    onClick={() => onSelect(booking.id)}
                  >
                    {booking.code || booking.id}
                  </button>
                  <strong>{customer?.name}</strong>
                  <a className="adm-phone" href={`tel:${customer?.phone}`}>
                    {customer?.phone}
                  </a>
                </td>
                <td data-label="Phương tiện">
                  <span>{customer?.model}</span>
                  <small>{customer?.plate}</small>
                </td>
                <td data-label="Dịch vụ">
                  {booking.serviceIds
                    .map(
                      (id) =>
                        booking.serviceNames?.[id] ||
                        data.services.find((item) => item.id === id)?.name,
                    )
                    .join(", ")}
                </td>
                <td data-label="Ngày giờ">
                  <strong>
                    {booking.period
                      ? periodLabels[booking.period]
                      : booking.time}
                  </strong>
                  <small>{formatDate(booking.date)}</small>
                </td>
                <td data-label="Phụ trách">
                  <span
                    className={!booking.advisorId ? "mgr-warning-text" : ""}
                  >
                    {data.staff.find((item) => item.id === booking.advisorId)
                      ?.name ?? "Chưa phân công"}
                  </span>
                </td>
                <td data-label="Trạng thái">
                  <StatusBadge status={booking.status} />
                </td>
                <td>
                  <button
                    className="adm-icon-btn"
                    title="Xem chi tiết"
                    aria-label={`Xem chi tiết ${booking.id}`}
                    onClick={() => onSelect(booking.id)}
                  >
                    <AdminIcon name="arrow" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ManagerBookingDetail({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const { data, theme, update, ask, commandBooking } = useManager();
  const booking = data.bookings.find((item) => item.id === id);
  const [advisorId, setAdvisorId] = useState(booking?.advisorId ?? "");
  const [action, setAction] = useState<BookingChange | null>(
    apiEnabled && booking?.status === "pending" ? "confirm" : null,
  );
  const [date, setDate] = useState(booking?.date || "");
  const [time, setTime] = useState(booking?.time || "");
  const [reason, setReason] = useState("");
  const [assignmentReason, setAssignmentReason] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [record, setRecord] = useState<Booking | undefined>(booking?.record);
  const [timeline, setTimeline] = useState<
    { id: string; occurredAt: string; summary: string; reason: string | null }[]
  >([]);
  useEffect(() => {
    if (!apiEnabled) return;
    const abort = new AbortController();
    void Promise.all([
      request<ApiBooking>(`admin/bookings/${id}`, { signal: abort.signal }),
      collection<{
        id: string;
        occurredAt: string;
        summary: string;
        reason: string | null;
      }>(`admin/bookings/${id}/events`, abort.signal),
    ])
      .then(([detail, events]) => {
        setRecord(bookingFromApi(detail.data));
        setTimeline(events);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => abort.abort();
  }, [id, booking?.version]);
  if (!booking)
    return (
      <ManagerModal
        title="Không tìm thấy lịch hẹn"
        theme={theme}
        onClose={onClose}
      >
        <p>Lịch không có trong danh sách hiện tại. Đóng chi tiết để tìm lại.</p>
      </ManagerModal>
    );
  const profile = data.customers.find((item) => item.id === booking.customerId);
  const customer = {
    ...profile,
    ...booking.customerSnapshot,
    model:
      booking.vehicleSnapshot === null
        ? ""
        : booking.vehicleSnapshot?.model || profile?.model,
    plate:
      booking.vehicleSnapshot === null
        ? ""
        : booking.vehicleSnapshot?.plate || profile?.plate,
  };
  const terminal = [
    "completed",
    "cancelled",
    "no_show",
    ...(apiEnabled ? ["arrived"] : []),
  ].includes(booking.status);
  function assign() {
    if (!assignmentReason.trim()) {
      setError("Nhập lý do phân công hoặc chuyển cố vấn.");
      return;
    }
    if (
      data.shifts.some(
        (s) =>
          s.staffId === advisorId &&
          s.date === booking?.date &&
          s.state === "leave",
      )
    ) {
      setError("Cố vấn đang nghỉ trong ngày hẹn. Chọn người khác.");
      return;
    }
    ask({
      title: "Xác nhận phân công",
      message: `Giao lịch ${id}: ${data.staff.find((s) => s.id === booking?.advisorId)?.name || "Chưa phân công"} → ${data.staff.find((item) => item.id === advisorId)?.name}. ${assignmentReason.trim()}`,
      label: "Phân công",
      action: async () => {
        if (apiEnabled && commandBooking) {
          await commandBooking(id, booking?.advisorId ? "transfer" : "assign", {
            ...(booking?.advisorId
              ? { toAdvisorId: advisorId }
              : { advisorId }),
            reason: assignmentReason.trim(),
          });
          return;
        }
        await update(
          (previous) => ({
            ...previous,
            bookings: previous.bookings.map((item) =>
              item.id === id ? { ...item, advisorId } : item,
            ),
            orders: previous.orders.map((o) =>
              o.bookingId === id
                ? {
                    ...o,
                    advisorId,
                    events: [
                      ...o.events,
                      orderEvent(
                        "Chuyển cố vấn",
                        `${booking?.advisorId || "Chưa phân công"} → ${advisorId}. ${assignmentReason.trim()}`,
                      ),
                    ],
                  }
                : o,
            ),
          }),
          "Đã cập nhật người phụ trách",
          `${id} · ${booking?.advisorId || "Chưa phân công"} → ${advisorId} · ${assignmentReason.trim()}`,
        );
      },
    });
  }
  function applyAction() {
    if (!booking || !action) return;
    const message = apiEnabled
      ? !reason.trim()
        ? "Vui lòng nhập lý do."
        : action !== "cancel" && !agreed
          ? "Vui lòng xác nhận đã thống nhất với khách."
          : action === "confirm" && !booking.advisorId && !advisorId
            ? "Chọn cố vấn ở mục “Phân công cố vấn” để nhận lịch này."
            : ""
      : validateBookingChange(
          data,
          booking,
          action,
          date,
          time,
          reason,
          agreed,
        );
    if (message) {
      setError(message);
      return;
    }
    const label =
      action === "confirm"
        ? "Xác nhận lịch"
        : action === "cancel"
          ? "Hủy lịch"
          : "Đổi lịch";
    ask({
      title: `${label}?`,
      message: `${id} · ${booking.date} ${booking.time}${action !== "cancel" ? ` → ${date} ${time}` : ""}. ${reason.trim()}`,
      danger: action === "cancel",
      label,
      action: async () => {
        if (apiEnabled && commandBooking) {
          const currentPolicy = (await import("@/lib/api/client")).request;
          const metadata = await currentPolicy("admin/services?limit=1");
          await commandBooking(id, action, {
            reason: reason.trim(),
            ...(action === "confirm"
              ? {
                  confirmedStartAt: `${date}T${time}:00+07:00`,
                  customerAgreed: true,
                  policyVersion: metadata.meta.policyVersion,
                  ...(booking.advisorId ? {} : { advisorId }),
                }
              : action === "reschedule"
                ? {
                    newStartAt: `${date}T${time}:00+07:00`,
                    customerAgreed: true,
                    policyVersion: metadata.meta.policyVersion,
                  }
                : {}),
          });
        } else
          await update(
            (d) => applyBookingChange(d, booking, action, date, time),
            `Đã ${label.toLocaleLowerCase("vi")}`,
            `${id} · ${booking.date} ${booking.time}${action === "reschedule" ? ` → ${date} ${time}` : ""} · ${reason.trim()}`,
          );
        setAction(null);
        setReason("");
        setError("");
      },
    });
  }
  return (
    <ManagerModal
      title={`Chi tiết ${booking.code || id}`}
      theme={theme}
      onClose={onClose}
      drawer
      footer={
        <button className="adm-btn" onClick={onClose}>
          Đóng chi tiết
        </button>
      }
    >
      <div className="mgr-detail-status">
        <StatusBadge status={booking.status} />
        <span>
          {booking.period ? periodLabels[booking.period] : booking.time} ·{" "}
          {formatDate(booking.date)}
        </span>
      </div>
      {apiEnabled && booking.status === "confirmed" && (
        <Link
          className="adm-btn adm-primary adm-action-arrive"
          href={`/dieu-hanh/tiep-nhan/${id}`}
        >
          Tiếp nhận xe
        </Link>
      )}
      {booking.serviceVisitId && (
        <Link
          className="adm-btn adm-primary"
          href={`/dieu-hanh/phieu-dich-vu/${booking.serviceVisitId}`}
        >
          Xem phiếu dịch vụ
        </Link>
      )}
      <section className="mgr-detail-section">
        <h3>Khách hàng & phương tiện</h3>
        <h2>{customer?.name}</h2>
        <p>{customer?.phone}</p>
        <Link
          className="adm-text-link"
          href={`/dieu-hanh/khach-hang?selected=${customer?.id}`}
        >
          Mở hồ sơ khách / xe ↗
        </Link>
        <div className="mgr-vehicle">
          <AdminIcon name="car" />
          <div>
            <strong>{customer?.model}</strong>
            <span>{customer?.plate}</span>
          </div>
        </div>
      </section>
      {["pending", "confirmed"].includes(booking.status) && (
        <section className="mgr-detail-section">
          <h3>Xử lý lịch hẹn</h3>
          <div className="mgr-row-actions">
            {booking.status === "pending" && (
              <button
                className="adm-btn adm-primary"
                onClick={() => {
                  setAction("confirm");
                  setError("");
                }}
              >
                Chốt lịch
              </button>
            )}
            <button
              className="adm-btn"
              onClick={() => {
                setAction("reschedule");
                setError("");
              }}
            >
              Đổi giờ
            </button>
            <button
              className="adm-btn adm-danger"
              onClick={() => {
                setAction("cancel");
                setError("");
              }}
            >
              Hủy lịch
            </button>
          </div>
          {apiEnabled && record && action && action !== "cancel" && (
            <BookingTimeForm
              key={`${id}-${action}-${record.version}`}
              booking={record}
              confirm={action === "confirm"}
              advisors={data.staff
                .filter(
                  (s) =>
                    s.role === "advisor" &&
                    s.active &&
                    s.accountEnabled !== false,
                )
                .map((s) => ({ id: s.id, name: s.name }))}
              pickAdvisor={action === "confirm" && !booking.advisorId}
              onCancel={() => setAction(null)}
              onSave={async ({ date, time, advisorId, note }) => {
                if (!commandBooking)
                  throw new Error("Chưa thể cập nhật lịch hẹn.");
                const metadata = await request("admin/services?limit=1");
                const period =
                  time === "morning"
                    ? "MORNING"
                    : time === "afternoon"
                      ? "AFTERNOON"
                      : null;
                await commandBooking(
                  id,
                  action === "confirm" ? "confirm" : "reschedule",
                  {
                    expectedVersion: record.version,
                    customerAgreed: true,
                    ...(note.trim()
                      ? action === "confirm"
                        ? { internalNote: note.trim() }
                        : { reason: note.trim() }
                      : {}),
                    ...(action === "confirm" && advisorId ? { advisorId } : {}),
                    ...(period
                      ? { requestedDate: date, requestedPeriod: period }
                      : {
                          [action === "confirm"
                            ? "confirmedStartAt"
                            : "newStartAt"]: `${date}T${time}:00+07:00`,
                          policyVersion: Number(metadata.meta.policyVersion),
                        }),
                  },
                );
                setAction(null);
                onClose();
              }}
            />
          )}
          {apiEnabled && action === "cancel" && (
            <form
              className="mgr-form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (busy || !commandBooking) return;
                setBusy(true);
                setError("");
                try {
                  await commandBooking(id, "cancel", {
                    expectedVersion: record?.version || booking.version,
                    reason: reason.trim(),
                  });
                  setAction(null);
                  setReason("");
                  onClose();
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "Không hủy được lịch.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <p>
                {booking.code || id} · {customer.name} · {customer.plate} ·{" "}
                {formatDate(booking.date)}
              </p>
              <ManagerField label="Lý do hủy thực tế *">
                <textarea
                  required
                  maxLength={400}
                  rows={3}
                  disabled={busy}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </ManagerField>
              <div className="mgr-row-actions">
                <button
                  type="button"
                  className="adm-btn"
                  disabled={busy}
                  onClick={() => setAction(null)}
                >
                  Quay lại
                </button>
                <button
                  className="adm-btn adm-danger"
                  disabled={busy || !reason.trim()}
                >
                  {busy ? "Đang lưu…" : "Hủy lịch"}
                </button>
              </div>
            </form>
          )}
          {!apiEnabled && action && (
            <div className="mgr-form">
              {action !== "cancel" && (
                <div className="mgr-form-columns">
                  <ManagerField
                    label={action === "confirm" ? "Ngày hẹn" : "Ngày mới"}
                  >
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </ManagerField>
                  <ManagerField
                    label={action === "confirm" ? "Giờ hẹn" : "Giờ mới"}
                  >
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                    />
                  </ManagerField>
                </div>
              )}
              {action !== "cancel" && (
                <label className="adm-toggle-row">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                  />{" "}
                  Đã thống nhất thời gian với khách
                </label>
              )}
              <ManagerField label="Lý do thao tác *">
                <textarea
                  maxLength={400}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </ManagerField>
              <button className="adm-btn adm-primary" onClick={applyAction}>
                Kiểm tra & xác nhận
              </button>
            </div>
          )}
        </section>
      )}
      <section className="mgr-detail-section">
        <h3>Dịch vụ đã chọn</h3>
        {data.services
          .filter((item) => booking.serviceIds.includes(item.id))
          .map((service) => (
            <div className="mgr-summary-row" key={service.id}>
              <strong>{service.name}</strong>
              <span>~{service.duration} phút</span>
            </div>
          ))}
      </section>
      <section className="mgr-detail-section">
        <h3>Phân công cố vấn</h3>
        <ManagerField label="Cố vấn phụ trách">
          <select
            value={advisorId}
            disabled={terminal}
            onChange={(event) => setAdvisorId(event.target.value)}
          >
            <option value="">Chưa phân công</option>
            {data.staff
              .filter((item) => item.role === "advisor" && item.active)
              .map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name}
                </option>
              ))}
          </select>
        </ManagerField>
        {!terminal && (
          <ManagerField label="Lý do phân công / chuyển cố vấn *">
            <textarea
              maxLength={400}
              value={assignmentReason}
              onChange={(e) => setAssignmentReason(e.target.value)}
            />
          </ManagerField>
        )}
        <button
          className="adm-btn adm-primary mgr-full"
          disabled={terminal || !advisorId || advisorId === booking.advisorId}
          onClick={assign}
        >
          Lưu phân công
        </button>
        {terminal && (
          <p className="adm-muted">
            {booking.status === "arrived"
              ? "Điều phối cố vấn trên phiếu dịch vụ."
              : "Lịch đã kết thúc, chỉ xem thông tin."}
          </p>
        )}
      </section>
      {error && (
        <p className="adm-error-text" role="alert">
          {error}
        </p>
      )}
      <section className="mgr-detail-section">
        <h3>Ghi chú</h3>
        <p>{record?.customerNote || booking.note || "Không có ghi chú."}</p>
        {record?.internalNote && <p>Nội bộ: {record.internalNote}</p>}
      </section>
      <section className="mgr-detail-section">
        <h3>Nhật ký liên quan</h3>
        {apiEnabled ? (
          timeline.length ? (
            timeline.map((event) => (
              <p key={event.id}>
                {formatDate(event.occurredAt)} {timeLabel(event.occurredAt)} ·{" "}
                {event.summary}
                {event.reason ? ` · ${event.reason}` : ""}
              </p>
            ))
          ) : (
            <p>Chưa có thao tác liên quan.</p>
          )
        ) : data.events.filter((event) => event.target.includes(id)).length ? (
          data.events
            .filter((event) => event.target.includes(id))
            .map((event) => (
              <p key={event.id}>
                {event.time} · {event.action}
              </p>
            ))
        ) : (
          <p>Chưa có thao tác liên quan.</p>
        )}
      </section>
    </ManagerModal>
  );
}
