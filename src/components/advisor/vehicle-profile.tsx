"use client";

import Link from "next/link";
import { AdminIcon } from "@/components/admin/admin-icon";
import { useBookings } from "@/components/admin/booking-provider";
import {
  AdminLoading,
  EmptyState,
  PageHeading,
  StatusBadge,
} from "@/components/admin/primitives";
import { bookingTime, formatDate, timeLabel } from "@/lib/booking/logic";
import { useAdvisor } from "./advisor-provider";
import { StageBadge } from "./order-common";

export function VehicleProfile({ id }: { id: string }) {
  const { data, ready: bookingsReady } = useBookings();
  const { orders, ready } = useAdvisor();
  const vehicle = data.vehicles.find((item) => item.id === id);
  const customer = data.customers.find(
    (item) => item.id === vehicle?.customerId,
  );
  const bookings = data.bookings
    .filter((item) => item.vehicleId === id)
    .sort((a, b) => bookingTime(b).localeCompare(bookingTime(a)));
  const history = orders
    .filter((item) => item.vehicleId === id)
    .sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  const lastOdo = history.find((item) => item.odo)?.odo;
  const parts = history
    .filter((item) => item.stage === "done")
    .flatMap((item) =>
      item.quote.lines
        .filter((line) => line.kind === "part")
        .map((line) => ({ ...line, orderId: item.id, at: item.openedAt })),
    );
  if (!bookingsReady || !ready) return <AdminLoading />;
  if (!vehicle || !customer)
    return <EmptyState title="Không tìm thấy xe" create={false} />;
  return (
    <div className="adv-page adv-stack">
      <Link
        className="adm-mobile-back adm-text-link"
        href={`/co-van/khach-hang/${customer.id}`}
      >
        <AdminIcon name="back" />
        Hồ sơ khách hàng
      </Link>
      <PageHeading
        eyebrow="CỐ VẤN / HỒ SƠ XE"
        title={vehicle.plate || vehicle.model}
        description={`${vehicle.model} · ${vehicle.year || "Chưa rõ năm sản xuất"}`}
      >
        <Link
          className="adm-btn adm-primary"
          href={`/co-van/lich-hen/tao-moi?customer=${customer.id}`}
        >
          Đặt lịch cho xe
        </Link>
      </PageHeading>
      <section className="adm-panel">
        <h2>Thông tin xe</h2>
        <dl className="adm-info-grid">
          <div>
            <dt>Chủ xe</dt>
            <dd>
              <Link
                className="adm-text-link"
                href={`/co-van/khach-hang/${customer.id}`}
              >
                {customer.name}
              </Link>
            </dd>
          </div>
          <div>
            <dt>Điện thoại</dt>
            <dd>
              <a href={`tel:${customer.phone}`}>{customer.phone}</a>
            </dd>
          </div>
          <div>
            <dt>Biển số</dt>
            <dd>{vehicle.plate || "Chưa có"}</dd>
          </div>
          <div>
            <dt>Dòng xe</dt>
            <dd>{vehicle.model}</dd>
          </div>
          <div>
            <dt>Năm sản xuất</dt>
            <dd>{vehicle.year || "Chưa có"}</dd>
          </div>
          <div>
            <dt>ODO gần nhất</dt>
            <dd>{lastOdo ? `${lastOdo} km` : "Chưa ghi"}</dd>
          </div>
        </dl>
      </section>
      <section className="adm-panel">
        <div className="adm-section-line">
          <h2>Phiếu dịch vụ</h2>
          <span className="adm-muted">{history.length} phiếu</span>
        </div>
        <div className="adm-related-bookings adv-vehicle-bookings">
          {history.length ? (
            history.map((order) => (
              <Link key={order.id} href={`/co-van/phieu-dich-vu/${order.id}`}>
                <div>
                  <strong>{order.id}</strong>
                  <small>
                    {formatDate(order.openedAt)} · {order.request}
                  </small>
                </div>
                <StageBadge stage={order.stage} />
              </Link>
            ))
          ) : (
            <p className="adm-muted">Chưa có phiếu dịch vụ.</p>
          )}
        </div>
      </section>
      <section className="adm-panel">
        <div className="adm-section-line">
          <h2>Lịch hẹn</h2>
          <span className="adm-muted">{bookings.length} lịch</span>
        </div>
        <div className="adm-related-bookings adv-vehicle-bookings">
          {bookings.length ? (
            bookings.map((booking) => (
              <Link key={booking.id} href={`/co-van/lich-hen/${booking.id}`}>
                <div>
                  <strong>{booking.id}</strong>
                  <small>
                    {formatDate(bookingTime(booking))} ·{" "}
                    {timeLabel(bookingTime(booking))}
                  </small>
                </div>
                <StatusBadge status={booking.status} />
              </Link>
            ))
          ) : (
            <p className="adm-muted">Chưa có lịch hẹn.</p>
          )}
        </div>
      </section>
      <section className="adm-panel">
        <div className="adm-section-line">
          <h2>Phụ tùng đã thay</h2>
          <span className="adm-muted">{parts.length} hạng mục</span>
        </div>
        <div className="adm-related-bookings adv-vehicle-bookings">
          {parts.length ? (
            parts.map((part) => (
              <Link
                key={`${part.orderId}-${part.id}`}
                href={`/co-van/phieu-dich-vu/${part.orderId}`}
              >
                <div>
                  <strong>{part.name}</strong>
                  <small>
                    {part.quantity} {part.unit} · {formatDate(part.at)} ·{" "}
                    {part.orderId}
                  </small>
                </div>
              </Link>
            ))
          ) : (
            <p className="adm-muted">Chưa ghi nhận phụ tùng đã thay.</p>
          )}
        </div>
      </section>
    </div>
  );
}
