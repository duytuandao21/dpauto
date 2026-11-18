"use client";
import { formatPhone, formatPlate } from "@/lib/advisor/formats";
import Link from "next/link";
import {
  advisors as seedAdvisors,
  bookingServices as seedServices,
} from "@/lib/booking/seed";
import {
  bookingTime,
  formatDate,
  periodLabels,
  timeLabel,
} from "@/lib/booking/logic";
import type { Booking } from "@/lib/booking/types";
import { useBookings } from "./booking-provider";
import { StatusBadge } from "./primitives";
import {
  BookingActions,
  EditBookingLink,
  RescheduleButton,
} from "./booking-actions";
import { AdminIcon } from "./admin-icon";
import { useAdvisor } from "@/components/advisor/advisor-provider";

export function BookingDetail({
  booking,
  embedded = false,
}: {
  booking: Booking;
  embedded?: boolean;
}) {
  const { data } = useBookings(),
    customer = {
      ...data.customers.find((c) => c.id === booking.customerId)!,
      ...booking.customerSnapshot,
    },
    vehicle =
      booking.vehicleSnapshot ||
      data.vehicles.find((v) => v.id === booking.vehicleId);
  const advisors = data.advisors ?? seedAdvisors,
    bookingServices = data.services ?? seedServices;
  const { orders } = useAdvisor();
  const order = orders.find((item) => item.bookingId === booking.id);
  const phone = formatPhone(customer.phone);
  return (
    <section className="adm-detail adm-panel" aria-label="Chi tiết lịch hẹn">
      <div className="adm-detail-title">
        <div>
          <span className="adm-eyebrow">CHI TIẾT LỊCH HẸN</span>
          <h2>{booking.code || booking.id}</h2>
        </div>
        <StatusBadge status={booking.status} />
      </div>
      <div className="adm-person adm-booking-person">
        <span className="adm-avatar adm-avatar-lg">
          {customer.name.split(" ").at(-1)?.slice(0, 1)}
        </span>
        <div className="adm-booking-person-info">
          <Link
            href={`/co-van/khach-hang/${customer.id}`}
            className="adm-person-name"
          >
            {customer.name}
          </Link>
          <a href={`tel:${phone}`} className="adm-phone">
            <AdminIcon name="phone" />
            {phone}
          </a>
        </div>
        {phone && (
          <div className="adm-booking-contact-actions">
            <a
              className="adm-btn"
              href={`tel:${phone}`}
              aria-label={`Gọi ${customer.name}`}
            >
              <AdminIcon name="phone" />
              Gọi
            </a>
            <a
              className="adm-btn"
              href={`https://zalo.me/${phone}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Mở Zalo của ${customer.name}`}
            >
              Zalo
            </a>
          </div>
        )}
      </div>
      <div className="adm-detail-section">
        <h3>Thông tin tiếp nhận</h3>
        <dl className="adm-info-grid">
          <div>
            <dt>Xe</dt>
            <dd>
              {vehicle?.model} {vehicle?.year}
            </dd>
          </div>
          <div>
            <dt>Biển số</dt>
            <dd>{formatPlate(vehicle?.plate) || "Chưa cung cấp"}</dd>
          </div>
          <div>
            <dt>Khách yêu cầu</dt>
            <dd>
              {booking.originalPeriod
                ? periodLabels[booking.originalPeriod]
                : timeLabel(booking.requestedAt)}{" "}
              · {formatDate(booking.requestedAt)}
            </dd>
          </div>
          <div>
            <dt>Giờ đã xác nhận</dt>
            <dd>
              {booking.confirmedAt
                ? `${timeLabel(booking.confirmedAt)} · ${formatDate(booking.confirmedAt)}`
                : "Chưa xác nhận"}
            </dd>
          </div>
          <div>
            <dt>Phụ trách</dt>
            <dd>
              {advisors.find((a) => a.id === booking.advisorId)?.name ||
                "Chưa phân công"}
            </dd>
          </div>
          <div>
            <dt>Nguồn đặt lịch</dt>
            <dd>{booking.source}</dd>
          </div>
        </dl>
      </div>
      <div className="adm-detail-section">
        <h3>Dịch vụ đã chọn</h3>
        <div className="adm-service-tags">
          {booking.serviceIds.map((id) => (
            <span key={id}>
              <AdminIcon name="tool" />
              {booking.serviceNames?.[id] ||
                bookingServices.find((s) => s.id === id)?.name}
            </span>
          ))}
        </div>
      </div>
      {order && (
        <div className="adm-detail-section">
          <h3>Phiếu dịch vụ</h3>
          <Link className="adm-btn" href={`/co-van/phieu-dich-vu/${order.id}`}>
            Mở phiếu {order.id}
          </Link>
        </div>
      )}
      <div className="adm-detail-section">
        <h3>Ghi chú</h3>
        <div className="adm-note">
          <span>Khách hàng</span>
          <p>{booking.customerNote || "Chưa có ghi chú từ khách hàng."}</p>
        </div>
        <div className="adm-note">
          <span>Nội bộ</span>
          <p>{booking.internalNote || "Chưa có ghi chú nội bộ."}</p>
        </div>
      </div>
      <div className="adm-detail-section">
        <div className="adm-section-line">
          <h3>Lịch sử thao tác</h3>
          <span className="adm-muted">{booking.events.length} hoạt động</span>
        </div>
        <ol className="adm-timeline">
          {[...booking.events].reverse().map((event) => (
            <li key={event.id}>
              <i />
              <div>
                <strong>{event.label}</strong>
                <time dateTime={event.at}>
                  {formatDate(event.at)} · {timeLabel(event.at)}
                </time>
                <p>{event.detail}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="adm-created">
          Tạo lúc {timeLabel(booking.createdAt)},{" "}
          {formatDate(booking.createdAt)}
        </p>
      </div>
      <div className="adm-detail-actions">
        <BookingActions booking={booking} />
        <div className="adm-action-row">
          <RescheduleButton key={booking.id} booking={booking} />
          <EditBookingLink booking={booking} />
        </div>
      </div>
      {embedded && (
        <Link
          href={`/co-van/lich-hen/${booking.id}?date=${bookingTime(booking).slice(0, 10)}`}
          className="adm-text-link"
        >
          Mở trang chi tiết <AdminIcon name="arrow" />
        </Link>
      )}
    </section>
  );
}
