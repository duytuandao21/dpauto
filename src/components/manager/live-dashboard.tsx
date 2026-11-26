"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeading } from "@/components/admin/primitives";
import { useSession } from "@/components/admin/auth-gate";
import { AdminIcon, type AdminIconName } from "@/components/admin/admin-icon";
import { formatDate, shiftDate } from "@/lib/booking/logic";
import { useManager } from "./manager-provider";
import {
  managerBookingNeedsAdvisor,
  managerBookingSummary,
} from "@/lib/api/manager-presentation";
import { ManagerPanel, ManagerSearch } from "./manager-ui";
import { LiveAlerts } from "./live-operations";
import { ManagerBookingTable, ManagerBookingDetail } from "./booking-list";
import {
  BookingTrend,
  BookingDistribution,
  CapacityBars,
} from "./manager-charts";

export function LiveManagerDashboard() {
  const { data, today, setRange } = useManager(),
    session = useSession();
  const range = 1;
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState("pending"),
    [selected, setSelected] = useState("");
  // Upcoming window (today … today + range - 1); the trend chart still needs the past days.
  const end = shiftDate(today, range - 1);
  useEffect(() => {
    setRange?.(shiftDate(today, 1 - Math.max(7, range)), end);
  }, [range, today, end, setRange]);
  const summary = managerBookingSummary(data.bookings, today, end),
    bookings = summary.bookings,
    // Open requests count whatever their date: an unconfirmed booking is work either way.
    open = data.bookings.filter(
      (b) =>
        b.status === "pending" ||
        (b.status === "confirmed" && b.date >= today && !b.advisorId),
    ),
    pendingCount = open.filter((b) => b.status === "pending").length,
    unassignedCount = open.filter(managerBookingNeedsAdvisor).length,
    slots = data.capacity.filter((s) => s.date === today);
  const total = slots.reduce((sum, s) => sum + s.total, 0),
    held = slots.reduce((sum, s) => sum + s.reserved, 0);
  const suffix = "&from=" + today + "&to=" + end;
  const kpis: {
    label: string;
    value: number | string;
    sub: string;
    icon: AdminIconName;
    tone: string;
    href: string;
  }[] = [
    {
      label: "Chờ xác nhận",
      value: pendingCount,
      sub: "Mọi yêu cầu chưa chốt lịch",
      icon: "time",
      tone: "warning",
      href: "/dieu-hanh/lich-hen?status=pending",
    },
    {
      label: "Chưa phân công",
      value: unassignedCount,
      sub: "Lịch chưa chốt hoặc sắp tới chưa có cố vấn",
      icon: "customers",
      tone: "danger",
      href: "/dieu-hanh/lich-hen?advisor=unassigned",
    },
    {
      label: "Đã tiếp nhận",
      value: summary.received,
      sub: "Xe đã đến theo lịch trong kỳ",
      icon: "car",
      tone: "success",
      href: "/dieu-hanh/lich-hen?status=checkedin" + suffix,
    },
    {
      label: "Chỗ đã đặt hôm nay",
      value: total ? Math.round((held / total) * 100) + "%" : "—",
      sub: "Lịch đã giữ / tổng số chỗ hôm nay",
      icon: "tool",
      tone: "brand",
      href: "/dieu-hanh/cau-hinh?tab=khung-gio&date=" + today,
    },
  ];
  const filtered = Array.from(
    new Map([...bookings, ...open].map((b) => [b.id, b])).values(),
  )
    .filter((b) => {
      const c = data.customers.find((c) => c.id === b.customerId);
      const haystack = [
        b.code || b.id,
        b.customerSnapshot?.name || c?.name || "",
        b.customerSnapshot?.phone || c?.phone || "",
        b.vehicleSnapshot?.plate || c?.plate || "",
      ].join(" ");
      return (
        (!status || b.status === status) &&
        haystack.toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi"))
      );
    })
    .sort(
      (a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time),
    );
  const staffName = session?.staff.name || "Quản lý";
  // Layout follows /co-van Tổng quan: totals, the work queue, then alerts and capacity.
  return (
    <>
      <PageHeading
        title="Tổng quan"
        description={`Xin chào, ${staffName} · ${formatDate(today)}`}
      >
        <div className="adv-actions">
          <Link className="adm-btn" href="/dieu-hanh/tiep-nhan/truc-tiep">
            Tiếp nhận xe trực tiếp
          </Link>
          <Link className="adm-btn adm-primary" href="/dieu-hanh/lich-hen">
            <AdminIcon name="calendar" />
            Xem lịch toàn trạm
          </Link>
        </div>
      </PageHeading>
      <div className="mgr-kpis mgr-kpis-4">
        {kpis.map((k) => (
          <Link
            key={k.label}
            className="adm-panel mgr-kpi mgr-kpi-link"
            data-tone={k.tone}
            href={k.href}
          >
            <div>
              <span>{k.label}</span>
              <span className="mgr-kpi-icon">
                <AdminIcon name={k.icon} />
              </span>
            </div>
            <strong>{k.value}</strong>
            <p>{k.sub}</p>
          </Link>
        ))}
      </div>
      <ManagerPanel
        title="Lịch cần xử lý"
        description="Lịch hôm nay và mọi yêu cầu chưa chốt"
        action={
          <Link className="adm-text-link" href="/dieu-hanh/lich-hen">
            Tất cả lịch <AdminIcon name="arrow" />
          </Link>
        }
      >
        <div className="adm-quick-filters" aria-label="Trạng thái lịch">
          {(
            [
              ["pending", "Chờ xác nhận"],
              ["confirmed", "Đã xác nhận"],
              ["arrived", "Đã tiếp nhận"],
              ["", "Tất cả"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              aria-pressed={status === value}
              className={status === value ? "is-active" : ""}
              onClick={() => setStatus(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="adm-search-row">
          <ManagerSearch
            value={query}
            onChange={setQuery}
            placeholder="Tìm mã lịch, khách, SĐT, biển số…"
          />
        </div>
        <ManagerBookingTable bookings={filtered} onSelect={setSelected} />
      </ManagerPanel>
      <div className="mgr-operating-layout" id="canh-bao">
        <LiveAlerts />
        <ManagerPanel
          title="Lịch theo khung giờ"
          description="Số chỗ đã đặt và còn lại hôm nay"
          action={
            <Link className="adm-text-link" href="/dieu-hanh/cau-hinh">
              Chi tiết <AdminIcon name="arrow" />
            </Link>
          }
        >
          <CapacityBars
            slots={[...slots].sort((a, b) => a.time.localeCompare(b.time))}
          />
          {!slots.length && (
            <p className="adm-muted">Hôm nay không có khung nhận lịch.</p>
          )}
        </ManagerPanel>
      </div>
      <div className="mgr-chart-layout">
        <ManagerPanel
          title="Xu hướng lịch hẹn"
          description="Lượng lịch được ghi nhận theo ngày"
          action={<span className="mgr-chip">7 ngày</span>}
        >
          <BookingTrend bookings={data.bookings} today={today} days={range} />
        </ManagerPanel>
        <ManagerPanel title="Phân bố trạng thái" description="Lịch hôm nay">
          <BookingDistribution bookings={bookings} />
        </ManagerPanel>
      </div>
      {selected && (
        <ManagerBookingDetail id={selected} onClose={() => setSelected("")} />
      )}
    </>
  );
}
