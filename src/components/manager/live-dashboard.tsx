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
import { FilterSelect, ManagerPanel, ManagerSearch } from "./manager-ui";
import { LiveOperations, LiveAlerts } from "./live-operations";
import { ManagerBookingTable, ManagerBookingDetail } from "./booking-list";
import {
  BookingTrend,
  BookingDistribution,
  CapacityBars,
} from "./manager-charts";

export function LiveManagerDashboard() {
  const { data, today, setRange } = useManager(),
    session = useSession();
  const [range, setDays] = useState(1),
    [query, setQuery] = useState(""),
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
      label:
        range === 1 ? "Lịch hẹn hôm nay" : "Lịch " + range + " ngày tới",
      value: summary.total,
      sub: range === 1 ? "Toàn bộ lịch hôm nay" : "Từ hôm nay đến " + formatDate(end),
      icon: "calendar",
      tone: "neutral",
      href: "/dieu-hanh/lich-hen?from=" + today + "&to=" + end,
    },
    {
      label: "Chờ xác nhận",
      value: pendingCount,
      sub: "Mọi yêu cầu chưa chốt lịch",
      icon: "time",
      tone: "warning",
      href: "/dieu-hanh/lich-hen?status=pending",
    },
    {
      label: "Đã xác nhận",
      value: summary.confirmed,
      sub: "Khách đã xác nhận đến trạm",
      icon: "check",
      tone: "blue",
      href: "/dieu-hanh/lich-hen?status=confirmed" + suffix,
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
      href: "/dieu-hanh/nang-luc?date=" + today,
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
  return (
    <>
      <div className="mgr-welcome">
        <PageHeading
          title={`Xin chào, ${staffName}!`}
          description="Cùng theo dõi lịch hẹn và sắp xếp vận hành hôm nay."
        />
        <div className="mgr-welcome-date">
          <AdminIcon name="calendar" />
          <span>{formatDate(today)}</span>
        </div>
      </div>
      <div className="mgr-section-toolbar">
        <div className="mgr-tabs" aria-label="Khoảng thời gian">
          {[1, 7, 30].map((days) => (
            <button
              key={days}
              aria-pressed={range === days}
              onClick={() => setDays(days)}
            >
              {days === 1 ? "Hôm nay" : days + " ngày tới"}
            </button>
          ))}
        </div>
        <div className="mgr-row-actions">
          <Link className="adm-btn" href="/dieu-hanh/tiep-nhan/truc-tiep">
            Tiếp nhận xe trực tiếp
          </Link>
          <Link className="adm-btn adm-primary" href="/dieu-hanh/lich-hen">
            <AdminIcon name="calendar" />
            Xem lịch toàn trạm
          </Link>
        </div>
      </div>
      <div className="mgr-kpis">
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
      <div className="mgr-operating-layout">
        <LiveAlerts limit={4} />
        <ManagerPanel
          title="Lịch theo khung giờ"
          description="Số chỗ đã đặt và còn lại hôm nay"
          action={
            <Link className="adm-text-link" href="/dieu-hanh/nang-luc">
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
      <LiveOperations />
      <div className="mgr-chart-layout">
        <ManagerPanel
          title="Xu hướng lịch hẹn"
          description="Lượng lịch được ghi nhận theo ngày"
          action={<span className="mgr-chip">{Math.max(7, range)} ngày</span>}
        >
          <BookingTrend bookings={data.bookings} today={today} days={range} />
        </ManagerPanel>
        <ManagerPanel
          title="Phân bố trạng thái"
          description="Theo khoảng thời gian đang chọn"
        >
          <BookingDistribution bookings={bookings} />
        </ManagerPanel>
      </div>
      <ManagerPanel
        title="Lịch cần xử lý"
        description="Lịch trong kỳ đang chọn và mọi yêu cầu chưa chốt"
        action={
          <Link className="adm-text-link" href="/dieu-hanh/lich-hen">
            Tất cả lịch <AdminIcon name="arrow" />
          </Link>
        }
      >
        <div className="mgr-toolbar">
          <ManagerSearch
            value={query}
            onChange={setQuery}
            placeholder="Tìm mã lịch, khách, SĐT, biển số…"
          />
          <FilterSelect label="Trạng thái" value={status} onChange={setStatus}>
            <option value="">Tất cả</option>
            <option value="pending">Chờ xác nhận</option>
            <option value="confirmed">Đã xác nhận</option>
            <option value="arrived">Đã tiếp nhận</option>
            <option value="cancelled">Đã hủy</option>
          </FilterSelect>
        </div>
        <ManagerBookingTable bookings={filtered} onSelect={setSelected} />
      </ManagerPanel>
      {selected && (
        <ManagerBookingDetail id={selected} onClose={() => setSelected("")} />
      )}
    </>
  );
}
