"use client";

import Link from "next/link";
import { useState } from "react";
import { AdminIcon, type AdminIconName } from "@/components/admin/admin-icon";
import { PageHeading } from "@/components/admin/primitives";
import { formatDate, shiftDate } from "@/lib/booking/logic";
import { useManager } from "./manager-provider";
import { ManagerPanel, ManagerSearch, FilterSelect } from "./manager-ui";
import {
  BookingTrend,
  BookingDistribution,
  CapacityBars,
} from "./manager-charts";
import { ManagerBookingTable, ManagerBookingDetail } from "./booking-list";
import { ManagerAlertList } from "./alerts-page";
import { ManagerOperationalOverview } from "./operational-overview";
import { operationStages, orderAmounts } from "@/lib/manager/operations";

export function ManagerDashboard({ report = false }: { report?: boolean }) {
  const { data, today, notify } = useManager();
  const [range, setRange] = useState(1);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("pending");
  const [selected, setSelected] = useState("");
  const start = shiftDate(today, 1 - range);
  const bookings = data.bookings.filter(
    (item) => item.date >= start && item.date <= today,
  );
  const pending = bookings.filter((item) => item.status === "pending").length;
  const confirmed = bookings.filter(
    (item) => item.status === "confirmed",
  ).length;
  const canceled = bookings.filter(
    (item) => item.status === "cancelled",
  ).length;
  const occupation = Math.round(
    (data.capacity
      .filter((s) => s.date === today)
      .reduce((sum, slot) => sum + slot.reserved, 0) /
      Math.max(
        1,
        data.capacity
          .filter((s) => s.date === today)
          .reduce((sum, slot) => sum + slot.total, 0),
      )) *
      100,
  );
  const kpis: {
    label: string;
    value: number | string;
    sub: string;
    icon: AdminIconName;
    tone: string;
  }[] = [
    {
      label: range === 1 ? "Tổng lịch hẹn hôm nay" : `Tổng lịch ${range} ngày`,
      value: bookings.length,
      sub: "Toàn bộ lịch trong kỳ",
      icon: "calendar",
      tone: "neutral",
    },
    {
      label: "Chờ xác nhận",
      value: pending,
      sub: "Cần liên hệ và xử lý",
      icon: "time",
      tone: "warning",
    },
    {
      label: "Đã xác nhận",
      value: confirmed,
      sub: "Khách đã xác nhận đến trạm",
      icon: "check",
      tone: "blue",
    },
    {
      label: "Lịch bị hủy",
      value: canceled,
      sub: "Trong khoảng thời gian chọn",
      icon: "close",
      tone: "danger",
    },
    {
      label: "Khách đã check-in",
      value: bookings.filter((b) => ["arrived", "completed"].includes(b.status))
        .length,
      sub: "Gồm xe đang phục vụ và đã hoàn tất",
      icon: "car",
      tone: "success",
    },
    {
      label: "Công suất đặt lịch",
      value: `${occupation}%`,
      sub: "Theo nguồn lực hôm nay",
      icon: "overview",
      tone: "brand",
    },
  ];
  const filtered = bookings
    .filter((booking) => {
      const customer = data.customers.find(
        (item) => item.id === booking.customerId,
      );
      return (
        (!status || booking.status === status) &&
        `${booking.id} ${customer?.name} ${customer?.phone} ${customer?.plate}`
          .toLocaleLowerCase("vi")
          .includes(query.toLocaleLowerCase("vi"))
      );
    })
    .sort(
      (a, b) =>
        (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1) ||
        a.time.localeCompare(b.time),
    );
  function exportReport() {
    const rows = [
      ["Báo cáo DPAuto", `${start} - ${today}`],
      ["Nguồn dữ liệu", "Dữ liệu mô phỏng trong phiên hiện tại"],
      ...kpis.map((kpi) => [kpi.label, String(kpi.value)]),
      ...Object.entries(operationStages).map(([stage, label]) => [
        label,
        String(
          data.orders.filter(
            (o) =>
              o.openedAt.slice(0, 10) >= start &&
              o.openedAt.slice(0, 10) <= today &&
              o.stage === stage,
          ).length,
        ),
      ]),
      [
        "Giá trị báo giá đã chốt trong kỳ",
        String(
          data.orders
            .filter(
              (o) =>
                o.quote.status === "confirmed" &&
                o.openedAt.slice(0, 10) >= start &&
                o.openedAt.slice(0, 10) <= today,
            )
            .reduce((n, o) => n + orderAmounts(o).total, 0),
        ),
      ],
    ];
    const blob = new Blob(
      [
        "\ufeff" +
          rows
            .map((row) =>
              row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","),
            )
            .join("\r\n"),
      ],
      { type: "text/csv;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "dpauto-bao-cao.csv";
    link.click();
    URL.revokeObjectURL(url);
    notify("Đã tải báo cáo.");
  }
  return (
    <>
      <div className="mgr-welcome">
        <PageHeading
          title={report ? "Báo cáo & thống kê" : "Xin chào, Quản lý!"}
          description={
            report
              ? "Theo dõi hoạt động đặt lịch qua các chỉ số tổng hợp."
              : "Cùng theo dõi lịch hẹn và sắp xếp vận hành hôm nay."
          }
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
              onClick={() => setRange(days)}
            >
              {days === 1 ? "Hôm nay" : `${days} ngày`}
            </button>
          ))}
        </div>
        {report ? (
          <button className="adm-btn" onClick={exportReport}>
            <AdminIcon name="arrow" />
            Xuất báo cáo
          </button>
        ) : (
          <Link className="adm-btn adm-primary" href="/dieu-hanh/lich-hen">
            <AdminIcon name="calendar" />
            Xem lịch toàn trạm
          </Link>
        )}
      </div>
      <div className="mgr-kpis">
        {kpis.map((kpi, index) => (
          <Link
            href={
              [
                `/dieu-hanh/lich-hen?from=${start}&to=${today}`,
                `/dieu-hanh/lich-hen?status=pending&from=${start}&to=${today}`,
                `/dieu-hanh/lich-hen?status=confirmed&from=${start}&to=${today}`,
                `/dieu-hanh/lich-hen?status=cancelled&from=${start}&to=${today}`,
                `/dieu-hanh/lich-hen?status=checkedin&from=${start}&to=${today}`,
                `/dieu-hanh/nang-luc?date=${today}`,
              ][index]
            }
            className="adm-panel mgr-kpi mgr-kpi-link"
            key={kpi.label}
            data-tone={kpi.tone}
          >
            <div>
              <span>{kpi.label}</span>
              <span className="mgr-kpi-icon">
                <AdminIcon name={kpi.icon} />
              </span>
            </div>
            <strong>{kpi.value}</strong>
            <p>{kpi.sub}</p>
          </Link>
        ))}
      </div>
      <div className="mgr-operating-layout">
        <ManagerPanel
          title="Cảnh báo vận hành"
          description="Các tình huống cần theo dõi"
          action={
            <Link className="adm-text-link" href="/dieu-hanh/canh-bao">
              Xem tất cả
            </Link>
          }
        >
          <ManagerAlertList limit={4} />
        </ManagerPanel>
        <ManagerPanel
          title="Công suất theo khung giờ"
          description="Nguồn lực đã đặt và còn lại hôm nay"
          action={
            <Link href="/dieu-hanh/nang-luc" className="adm-text-link">
              Chi tiết
              <AdminIcon name="arrow" />
            </Link>
          }
        >
          <CapacityBars
            slots={data.capacity
              .filter((s) => s.date === today)
              .sort(
                (a, b) =>
                  b.reserved / Math.max(1, b.total) -
                  a.reserved / Math.max(1, a.total),
              )
              .slice(0, 6)}
          />
        </ManagerPanel>
      </div>
      <ManagerOperationalOverview report={report} start={start} end={today} />
      <div className="mgr-chart-layout">
        <ManagerPanel
          title="Xu hướng lịch hẹn"
          description="Lượng lịch được ghi nhận theo ngày"
          action={
            <span className="mgr-chip">{range === 1 ? "7" : range} ngày</span>
          }
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
        title={report ? "Chi tiết lịch trong kỳ" : "Lịch cần xử lý"}
        description="Ưu tiên lịch đang chờ xác nhận"
        action={
          <Link className="adm-text-link" href="/dieu-hanh/lich-hen">
            Tất cả lịch
            <AdminIcon name="arrow" />
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
            <option value="completed">Hoàn thành</option>
            <option value="cancelled">Đã hủy</option>
          </FilterSelect>
        </div>
        <ManagerBookingTable
          bookings={filtered.slice(0, 5)}
          onSelect={setSelected}
        />
      </ManagerPanel>
      {selected && (
        <ManagerBookingDetail id={selected} onClose={() => setSelected("")} />
      )}
    </>
  );
}
