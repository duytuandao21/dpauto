"use client";
import { formatPhone, formatPlate } from "@/lib/advisor/formats";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { bookingTime, formatDate, slotLabel } from "@/lib/booking/logic";
import type { Customer } from "@/lib/booking/types";
import { useBookings } from "./booking-provider";
import { AdminIcon } from "./admin-icon";
import {
  AdminLoading,
  EmptyState,
  NotFoundState,
  PageHeading,
  StatusBadge,
} from "./primitives";
import { useAdvisor } from "@/components/advisor/advisor-provider";
import { StageBadge } from "@/components/advisor/order-common";
import { apiEnabled } from "@/lib/api/client";
import { LiveVisits } from "@/components/advisor/live-visits";
import { LegacyHistory } from "@/components/advisor/legacy-history";
import { WorkspaceDrawer } from "@/components/advisor/workspace-drawer";

function CustomerDetail({ customer }: { customer: Customer }) {
  const { data } = useBookings(),
    vehicles = data.vehicles.filter(
      (v) =>
        v.customerId === customer.id || v.customerIds?.includes(customer.id),
    ),
    bookings = data.bookings
      .filter((b) => b.customerId === customer.id)
      .sort((a, b) => bookingTime(b).localeCompare(bookingTime(a)));
  const { orders } = useAdvisor();
  const serviceOrders = orders
    .filter((item) => item.customerId === customer.id)
    .sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  return (
    <section className="adm-panel adm-detail">
      <div className="adm-detail-title">
        <span className="adm-eyebrow">HỒ SƠ KHÁCH HÀNG</span>
        <span className="adm-muted">{bookings.length} lịch hẹn</span>
      </div>
      <div className="adm-person">
        <span className="adm-avatar adm-avatar-lg">
          {customer.name.split(" ").at(-1)?.slice(0, 1)}
        </span>
        <div>
          <h2>{customer.name}</h2>
          <a className="adm-phone" href={`tel:${formatPhone(customer.phone)}`}>
            <AdminIcon name="phone" />
            {formatPhone(customer.phone)}
          </a>
        </div>
      </div>
      <Link
        href={`/co-van/lich-hen/tao-moi?customer=${customer.id}`}
        className="adm-btn adm-primary"
      >
        <AdminIcon name="plus" />
        Tạo lịch hẹn cho khách này
      </Link>
      <div className="adv-actions">
        <a className="adm-btn" href={`tel:${formatPhone(customer.phone)}`}>
          Gọi khách
        </a>
        <a
          className="adm-btn"
          href={`https://zalo.me/${customer.phone}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Mở Zalo
        </a>
      </div>
      <div className="adm-detail-section">
        <h3>
          Xe của khách <span className="adm-muted">({vehicles.length})</span>
        </h3>
        <div className="adm-vehicle-list">
          {vehicles.map((v) => (
            <Link key={v.id} href={`/co-van/xe/${v.id}`}>
              <span className="adm-vehicle-icon">
                <AdminIcon name="car" />
              </span>
              <div>
                <strong>
                  {v.model} {v.year}
                </strong>
                <p>{formatPlate(v.plate) || "Chưa có biển số"}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
      {apiEnabled && <LiveVisits customerId={customer.id} />}
      {apiEnabled && <LegacyHistory id={customer.id} />}
      {!apiEnabled && (
        <div className="adm-detail-section">
          <h3>Lịch sử dịch vụ</h3>
          <div className="adm-related-bookings">
            {serviceOrders.length ? (
              serviceOrders.map((order) => (
                <Link key={order.id} href={`/co-van/phieu-dich-vu/${order.id}`}>
                  <div>
                    <strong>
                      {order.id} · {formatDate(order.openedAt)}
                    </strong>
                    <small>
                      {formatPlate(
                        data.vehicles.find(
                          (item) => item.id === order.vehicleId,
                        )?.plate,
                      )}
                    </small>
                  </div>
                  <StageBadge stage={order.stage} />
                </Link>
              ))
            ) : (
              <p className="adm-muted">Chưa có phiếu dịch vụ.</p>
            )}
          </div>
        </div>
      )}
      <div className="adm-detail-section">
        <h3>Lịch hẹn liên quan</h3>
        <div className="adm-related-bookings">
          {bookings.length ? (
            bookings.map((b) => (
              <Link key={b.id} href={`/co-van/lich-hen/${b.id}`}>
                <div>
                  <strong>
                    {formatDate(bookingTime(b))} · {slotLabel(b)}
                  </strong>
                  <small>{b.id}</small>
                </div>
                <StatusBadge status={b.status} />
              </Link>
            ))
          ) : (
            <p className="adm-muted">Khách chưa có lịch hẹn.</p>
          )}
        </div>
      </div>
    </section>
  );
}
export function CustomersWorkspace({ id }: { id?: string }) {
  const { data, ready } = useBookings(),
    params = useSearchParams(),
    router = useRouter(),
    query = params.get("q") || "",
    filter = params.get("filter") || "all";
  const { orders } = useAdvisor();
  const customers = data.customers.filter((c) => {
    const vs = data.vehicles.filter(
        (v) => v.customerId === c.id || v.customerIds?.includes(c.id),
      ),
      text =
        `${c.name} ${c.phone} ${formatPhone(c.phone)} ${vs.map((v) => `${v.plate} ${formatPlate(v.plate)}`).join(" ")} ${data.bookings
          .filter((b) => b.customerId === c.id)
          .map((b) => b.id)
          .join(" ")} ${orders
          .filter((o) => o.customerId === c.id)
          .map((o) => `${o.id} ${o.quote.id}`)
          .join(" ")}`
          .toLocaleLowerCase("vi")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/đ/g, "d"),
      q = query
        .toLocaleLowerCase("vi")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d");
    return text.includes(q) && (filter !== "multiple" || vs.length > 1);
  });
  const selected = id ? data.customers.find((c) => c.id === id) : customers[0];
  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    next.set(key, value);
    router.replace(`/co-van/khach-hang?${next}`, { scroll: false });
  }
  if (!ready) return <AdminLoading />;
  if (id && !selected) return <NotFoundState kind="khách hàng" />;
  return (
    <div className={`adm-workspace-page ${id ? "has-detail" : ""}`}>
      <div className="adm-list-heading">
        <PageHeading
          eyebrow="CỐ VẤN DỊCH VỤ"
          title="Khách hàng"
          description="Hồ sơ khách hàng, phương tiện và lịch sử đặt lịch."
        />
      </div>
      <div className="adm-master-detail adm-customer-workspace adv-list-workspace">
        <section className="adm-master" aria-label="Danh sách khách hàng">
          <div className="adm-search-row">
            <label className="adm-search">
              <AdminIcon name="search" />
              <input
                aria-label="Tìm khách hàng"
                value={query}
                onChange={(e) => update("q", e.target.value)}
                placeholder="Tên, SĐT, biển số, mã lịch, mã phiếu…"
              />
              {query && (
                <button
                  aria-label="Xóa tìm khách"
                  onClick={() => update("q", "")}
                >
                  ×
                </button>
              )}
            </label>
          </div>
          <div className="adm-results-row">
            <strong>{customers.length} khách hàng</strong>
            <select
              aria-label="Lọc khách hàng"
              value={filter}
              onChange={(e) => update("filter", e.target.value)}
            >
              <option value="all">Tất cả khách</option>
              <option value="multiple">Có nhiều xe</option>
            </select>
          </div>
          <div
            className="adv-data-scroll"
            role="region"
            aria-label="Bảng khách hàng"
            tabIndex={0}
          >
            <table className="adv-data-table adv-customers-table">
              <thead>
                <tr>
                  <th scope="col">Khách hàng</th>
                  <th scope="col">Số điện thoại</th>
                  <th scope="col">Xe</th>
                  <th scope="col">Lịch gần nhất</th>
                  <th scope="col">Tổng lịch hẹn</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => {
                  const vehicles = data.vehicles.filter(
                      (v) =>
                        v.customerId === c.id || v.customerIds?.includes(c.id),
                    ),
                    bs = data.bookings
                      .filter((b) => b.customerId === c.id)
                      .sort((a, b) =>
                        bookingTime(b).localeCompare(bookingTime(a)),
                      );
                  return (
                    <tr
                      key={c.id}
                      className={id === c.id ? "is-selected" : undefined}
                    >
                      <td>
                        <Link
                          className="adm-text-link"
                          href={`/co-van/khach-hang/${c.id}?${params}`}
                          scroll={false}
                        >
                          <strong>{c.name}</strong>
                        </Link>
                      </td>
                      <td>
                        <a href={`tel:${formatPhone(c.phone)}`}>
                          {formatPhone(c.phone)}
                        </a>
                      </td>
                      <td>
                        {vehicles[0]?.model || "Chưa có xe"}
                        {vehicles.length > 1 && ` +${vehicles.length - 1}`}
                        {vehicles[0]?.plate && (
                          <small>{formatPlate(vehicles[0].plate)}</small>
                        )}
                      </td>
                      <td>
                        {bs[0] ? formatDate(bookingTime(bs[0])) : "Chưa có"}
                      </td>
                      <td>{c.bookingCount ?? bs.length} lịch</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!customers.length && (
              <EmptyState
                title="Không tìm thấy khách hàng"
                description="Thử tìm bằng tên, số điện thoại hoặc biển số khác."
                create={false}
              />
            )}
          </div>
        </section>
        {id && selected && (
          <WorkspaceDrawer
            title="Hồ sơ khách hàng"
            closeHref={`/co-van/khach-hang?${params}`}
          >
            <CustomerDetail customer={selected} />
          </WorkspaceDrawer>
        )}
      </div>
    </div>
  );
}
