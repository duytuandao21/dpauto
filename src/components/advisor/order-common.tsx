"use client";

import Link from "next/link";
import { useState } from "react";
import { AdminIcon } from "@/components/admin/admin-icon";
import { useBookings } from "@/components/admin/booking-provider";
import { formatDate, timeLabel } from "@/lib/booking/logic";
import { formatMoney, quoteTotals } from "@/lib/advisor/seed";
import type { ServiceOrder, ServiceStage } from "@/lib/advisor/types";

export const stageLabels: Record<ServiceStage, string> = {
  quote: "Chờ báo giá",
  work: "Đang thi công",
  acceptance: "Chờ nghiệm thu",
  done: "Hoàn tất",
};

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {}
  }
  const input = document.createElement("textarea");
  input.value = value;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.focus();
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("Copy unavailable");
}

export function StageBadge({ stage }: { stage: ServiceStage }) {
  return (
    <span className={`adm-badge adv-stage adv-stage-${stage}`}>
      {stageLabels[stage]}
    </span>
  );
}

export function OrderPerson({ order }: { order: ServiceOrder }) {
  const { data, notify } = useBookings();
  const customer = data.customers.find((item) => item.id === order.customerId);
  const vehicle = data.vehicles.find((item) => item.id === order.vehicleId);
  const [contact, setContact] = useState(false);
  if (!customer || !vehicle)
    return <p className="adm-muted">Không tìm thấy thông tin khách hoặc xe.</p>;
  return (
    <section className="adm-panel adv-person-panel">
      <div className="adm-person">
        <span className="adm-avatar adm-avatar-lg">
          {customer.name.slice(-1)}
        </span>
        <div>
          <Link
            className="adm-person-name"
            href={`/co-van/khach-hang/${customer.id}`}
          >
            {customer.name}
          </Link>
          <span className="adm-muted">
            {vehicle.model} · {vehicle.plate}
          </span>
        </div>
      </div>
      <div className="adv-actions">
        <a className="adm-btn" href={`tel:${customer.phone}`}>
          <AdminIcon name="phone" />
          Gọi {customer.phone}
        </a>
        <button
          type="button"
          className="adm-btn"
          onClick={async () => {
            try {
              await copyText(customer.phone);
              notify("Đã sao chép số điện thoại.");
            } catch {
              notify("Không thể sao chép trên trình duyệt này.");
            }
          }}
        >
          Sao chép SĐT
        </button>
        <a
          className="adm-btn"
          href={`https://zalo.me/${customer.phone}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Mở Zalo
        </a>
        <button
          type="button"
          className="adm-btn"
          onClick={() => setContact(!contact)}
          aria-expanded={contact}
        >
          Soạn nội dung
        </button>
      </div>
      {contact && (
        <div className="adm-note">
          <span>Nội dung liên hệ</span>
          <p>
            Xin chào {customer.name}, Trạm dịch vụ Toàn Trung đang xử lý xe{" "}
            {vehicle.plate}. Chúng tôi sẽ liên hệ khi có thông tin mới về dịch
            vụ.
          </p>
          <button
            type="button"
            className="adm-btn adm-btn-sm"
            onClick={async () => {
              try {
                await copyText(
                  `Xin chào ${customer.name}, Trạm dịch vụ Toàn Trung đang xử lý xe ${vehicle.plate}. Chúng tôi sẽ liên hệ khi có thông tin mới về dịch vụ.`,
                );
                notify("Đã sao chép nội dung.");
              } catch {
                notify("Không thể sao chép trên trình duyệt này.");
              }
            }}
          >
            Sao chép nội dung
          </button>
        </div>
      )}
    </section>
  );
}

export function OrderSummary({ order }: { order: ServiceOrder }) {
  const totals = quoteTotals(order.quote.lines, order.quote.discount);
  const debt = Math.max(
    0,
    totals.total - order.finance.deposit - order.finance.collected,
  );
  return (
    <section className="adm-panel adv-summary">
      <dl className="adm-info-grid">
        <div>
          <dt>Phiếu dịch vụ</dt>
          <dd>{order.id}</dd>
        </div>
        <div>
          <dt>Lịch hẹn</dt>
          <dd>
            <Link
              className="adm-text-link"
              href={`/co-van/lich-hen/${order.bookingId}`}
            >
              {order.bookingId}
            </Link>
          </dd>
        </div>
        <div>
          <dt>Tiếp nhận</dt>
          <dd>
            {formatDate(order.openedAt)} · {timeLabel(order.openedAt)}
          </dd>
        </div>
        <div>
          <dt>Tiến độ</dt>
          <dd>{order.work.progress}%</dd>
        </div>
        <div>
          <dt>Tổng báo giá</dt>
          <dd>{formatMoney(totals.total)}</dd>
        </div>
        <div>
          <dt>Đã cọc / đã thu</dt>
          <dd>
            {formatMoney(order.finance.deposit + order.finance.collected)}
          </dd>
        </div>
        <div>
          <dt>Còn phải thu</dt>
          <dd>
            {order.quote.status === "confirmed"
              ? formatMoney(debt)
              : "Chờ xác nhận báo giá"}
          </dd>
        </div>
      </dl>
    </section>
  );
}

export function OrderHistory({ order }: { order: ServiceOrder }) {
  return (
    <section className="adm-panel">
      <div className="adm-section-line">
        <h2>Lịch sử thao tác</h2>
        <span className="adm-muted">{order.events.length} hoạt động</span>
      </div>
      <ol className="adm-timeline adv-timeline">
        {[...order.events].reverse().map((item) => (
          <li key={item.id}>
            <i />
            <div>
              <strong>{item.label}</strong>
              <time dateTime={item.at}>
                {formatDate(item.at)} · {timeLabel(item.at)}
              </time>
              <p>{item.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function withEvent(
  order: ServiceOrder,
  label: string,
  detail: string,
): ServiceOrder {
  return {
    ...order,
    events: [
      ...order.events,
      { id: crypto.randomUUID(), at: new Date().toISOString(), label, detail },
    ],
  };
}
