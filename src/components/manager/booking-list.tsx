"use client";

import { useState } from "react";
import Link from "next/link";
import {
  validateBookingChange,
  applyBookingChange,
  type BookingChange,
} from "@/lib/manager/rules";
import { orderEvent } from "@/lib/manager/operations";
import { StatusBadge } from "@/components/admin/primitives";
import { AdminIcon } from "@/components/admin/admin-icon";
import { formatDate } from "@/lib/booking/logic";
import type { ManagerBooking } from "@/lib/manager/mock";
import { useManager } from "./manager-provider";
import { ManagerEmpty, ManagerField } from "./manager-ui";
import { ManagerModal } from "./manager-modal";

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
            const customer = data.customers.find(
              (item) => item.id === booking.customerId,
            );
            return (
              <tr key={booking.id}>
                <td data-label="Khách hàng">
                  <button
                    className="mgr-id-link"
                    onClick={() => onSelect(booking.id)}
                  >
                    {booking.id}
                  </button>
                  <strong>{customer?.name}</strong>
                  <small>{customer?.phone}</small>
                </td>
                <td data-label="Phương tiện">
                  <span>{customer?.model}</span>
                  <small>{customer?.plate}</small>
                </td>
                <td data-label="Dịch vụ">
                  {data.services
                    .filter((item) => booking.serviceIds.includes(item.id))
                    .map((item) => item.name)
                    .join(", ")}
                </td>
                <td data-label="Ngày giờ">
                  <strong>{booking.time}</strong>
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
  const { data, theme, update, ask } = useManager();
  const booking = data.bookings.find((item) => item.id === id);
  const [advisorId, setAdvisorId] = useState(booking?.advisorId ?? "");
  const [action, setAction] = useState<BookingChange | null>(null);
  const [date, setDate] = useState(booking?.date || "");
  const [time, setTime] = useState(booking?.time || "");
  const [reason, setReason] = useState("");
  const [assignmentReason, setAssignmentReason] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
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
  const customer = data.customers.find(
    (item) => item.id === booking.customerId,
  );
  const terminal = ["completed", "cancelled", "no_show"].includes(
    booking.status,
  );
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
      action: () =>
        update(
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
        ),
    });
  }
  function applyAction() {
    if (!booking || !action) return;
    const message = validateBookingChange(
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
      message: `${id} · ${booking.date} ${booking.time}${action === "reschedule" ? ` → ${date} ${time}` : ""}. ${reason.trim()}`,
      danger: action === "cancel",
      label,
      action: () => {
        update(
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
      title={`Chi tiết ${id}`}
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
          {booking.time} · {formatDate(booking.date)}
        </span>
      </div>
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
                Xác nhận lịch
              </button>
            )}
            <button
              className="adm-btn"
              onClick={() => {
                setAction("reschedule");
                setError("");
              }}
            >
              Đổi lịch
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
          {action && (
            <div className="mgr-form">
              {action === "reschedule" && (
                <div className="mgr-form-columns">
                  <ManagerField label="Ngày mới">
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </ManagerField>
                  <ManagerField label="Giờ mới">
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
          <p className="adm-muted">Lịch đã kết thúc, chỉ xem thông tin.</p>
        )}
      </section>
      {error && (
        <p className="adm-error-text" role="alert">
          {error}
        </p>
      )}
      <section className="mgr-detail-section">
        <h3>Ghi chú</h3>
        <p>{booking.note || "Không có ghi chú."}</p>
      </section>
      <section className="mgr-detail-section">
        <h3>Nhật ký liên quan</h3>
        {data.events.filter((event) => event.target.includes(id)).length ? (
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
