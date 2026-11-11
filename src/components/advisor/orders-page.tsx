"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AdminIcon } from "@/components/admin/admin-icon";
import { useBookings } from "@/components/admin/booking-provider";
import {
  AdminLoading,
  EmptyState,
  PageHeading,
} from "@/components/admin/primitives";
import { advisors } from "@/lib/booking/seed";
import { formatDate } from "@/lib/booking/logic";
import type { ServiceStage } from "@/lib/advisor/types";
import { useAdvisor } from "./advisor-provider";
import { StageBadge, stageLabels } from "./order-common";

const normalize = (value: string) =>
  value
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");

export function OrdersPage() {
  const { data } = useBookings();
  const { orders, ready } = useAdvisor();
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<ServiceStage | "all">("all");
  const [advisor, setAdvisor] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const filtered = useMemo(
    () =>
      orders
        .filter((order) => {
          const customer = data.customers.find(
            (item) => item.id === order.customerId,
          );
          const vehicle = data.vehicles.find(
            (item) => item.id === order.vehicleId,
          );
          return (
            (!query ||
              normalize(
                `${customer?.name} ${customer?.phone} ${vehicle?.plate} ${order.id} ${order.bookingId} ${order.quote.id}`,
              ).includes(normalize(query))) &&
            (stage === "all" || order.stage === stage) &&
            (!advisor || order.advisorId === advisor) &&
            (!from || order.openedAt.slice(0, 10) >= from) &&
            (!to || order.openedAt.slice(0, 10) <= to)
          );
        })
        .sort((a, b) => b.openedAt.localeCompare(a.openedAt)),
    [orders, data, query, stage, advisor, from, to],
  );
  if (!ready) return <AdminLoading />;
  return (
    <div className="adv-page">
      <PageHeading
        eyebrow="CỐ VẤN / XE DỊCH VỤ"
        title="Xe dịch vụ"
        description="Theo dõi phiếu từ lúc tiếp nhận đến bàn giao."
      >
        <Link className="adm-btn" href="/co-van/lich-hen">
          Mở lịch hẹn
        </Link>
      </PageHeading>
      <section className="adm-panel">
        <div className="adm-search-row">
          <label className="adm-search">
            <AdminIcon name="search" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Biển số, khách, SĐT, mã phiếu…"
              aria-label="Tìm phiếu dịch vụ"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Xóa tìm kiếm"
              >
                ×
              </button>
            )}
          </label>
        </div>
        <div className="adm-quick-filters" aria-label="Lọc tiến độ">
          {(["all", "quote", "work", "acceptance", "done"] as const).map(
            (value) => (
              <button
                key={value}
                className={stage === value ? "is-active" : ""}
                aria-pressed={stage === value}
                onClick={() => setStage(value)}
              >
                {value === "all" ? "Tất cả" : stageLabels[value]}
              </button>
            ),
          )}
        </div>
        <details className="adv-advanced">
          <summary className="adm-btn">
            Bộ lọc nâng cao
            {[advisor, from, to].filter(Boolean).length > 0
              ? ` (${[advisor, from, to].filter(Boolean).length})`
              : ""}
          </summary>
          <div className="adm-filters adv-filters">
            <label>
              Cố vấn
              <select
                value={advisor}
                onChange={(event) => setAdvisor(event.target.value)}
              >
                <option value="">Tất cả cố vấn</option>
                {advisors.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Từ ngày
              <input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </label>
            <label>
              Đến ngày
              <input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </label>
          </div>
        </details>
        <div className="adm-results-row">
          <strong>{filtered.length} phiếu dịch vụ</strong>
        </div>
        <div className="adv-order-list">
          {filtered.length ? (
            filtered.map((order) => {
              const customer = data.customers.find(
                (item) => item.id === order.customerId,
              );
              const vehicle = data.vehicles.find(
                (item) => item.id === order.vehicleId,
              );
              return (
                <Link
                  key={order.id}
                  href={`/co-van/phieu-dich-vu/${order.id}`}
                  className="adm-booking-card adv-order-card"
                >
                  <span className="adm-card-top">
                    <strong>{order.id}</strong>
                    <StageBadge stage={order.stage} />
                  </span>
                  <strong className="adv-order-name">
                    {vehicle?.plate || "Chưa có biển số"} · {vehicle?.model}
                  </strong>
                  <span>
                    {customer?.name} · {customer?.phone}
                  </span>
                  <span className="adm-muted">
                    Tiếp nhận {formatDate(order.openedAt)} ·{" "}
                    {advisors.find((item) => item.id === order.advisorId)?.name}
                  </span>
                  <span className="adm-text-link">
                    Xem phiếu <AdminIcon name="arrow" />
                  </span>
                </Link>
              );
            })
          ) : (
            <EmptyState
              title="Không có phiếu phù hợp"
              description="Thử đổi bộ lọc hoặc tiếp nhận một lịch hẹn đã xác nhận."
              create={false}
            />
          )}
        </div>
      </section>
    </div>
  );
}
