"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { advisors, bookingServices } from "@/lib/booking/seed";
import {
  bookingTime,
  formatDate,
  localDate,
  shiftDate,
  sources,
  statuses,
  timeLabel,
  validDate,
} from "@/lib/booking/logic";
import type { Booking } from "@/lib/booking/types";
import { useBookings } from "./booking-provider";
import { AdminIcon } from "./admin-icon";
import {
  AdminLoading,
  EmptyState,
  NotFoundState,
  PageHeading,
  StatusBadge,
} from "./primitives";
import { BookingActions } from "./booking-actions";
import { BookingDetail } from "./booking-detail";
import { BookingForm } from "./booking-form";
import { OverviewInsights } from "./overview-insights";
import { OverviewTasks } from "@/components/advisor/overview-tasks";

export function BookingCard({
  booking,
  selected,
  href,
}: {
  booking: Booking;
  selected?: boolean;
  href: string;
}) {
  const { data } = useBookings(),
    customer = data.customers.find((c) => c.id === booking.customerId),
    vehicle = data.vehicles.find((v) => v.id === booking.vehicleId);
  return (
    <article
      className={`adm-booking-card ${selected ? "is-selected" : ""}`}
      data-status={booking.status}
    >
      <div className="adm-card-top">
        <Link href={href} className="adm-booking-time">
          <AdminIcon name="time" />
          <time dateTime={bookingTime(booking)}>
            {timeLabel(bookingTime(booking))}
          </time>
        </Link>
        <StatusBadge status={booking.status} />
      </div>
      <Link href={href} className="adm-card-main">
        <div className="adm-booking-customer">
          <span className="adm-customer-initials" aria-hidden="true">
            {customer?.name
              .split(" ")
              .slice(-2)
              .map((word) => word[0])
              .join("")}
          </span>
          <div>
            <h3>{customer?.name}</h3>
            <p>
              {vehicle?.model}
              <span>·</span>
              {vehicle?.plate || "Chưa có biển số"}
            </p>
          </div>
        </div>
        <p className="adm-card-service">
          <AdminIcon name="tool" />
          {booking.serviceIds
            .map((id) => bookingServices.find((s) => s.id === id)?.name)
            .join(", ")}
          <span className="adm-card-assignee">
            · {advisors.find((a) => a.id === booking.advisorId)?.name}
          </span>
        </p>
      </Link>
      <div className="adm-card-footer">
        <span className="adm-card-advisor">
          <AdminIcon name="user" />
          {advisors.find((a) => a.id === booking.advisorId)?.name}
          <small>{booking.id}</small>
        </span>
        <BookingActions booking={booking} compact />
        <Link href={href} className="adm-btn">
          Chi tiết
        </Link>
      </div>
    </article>
  );
}
export function BookingsWorkspace({
  overview = false,
  id,
}: {
  overview?: boolean;
  id?: string;
}) {
  const { data, ready, selectedDate, setSelectedDate } = useBookings(),
    params = useSearchParams(),
    router = useRouter();
  const [advanced, setAdvanced] = useState(false);
  const selected = data.bookings.find((b) => b.id === id);
  const queryDate = params.get("date");
  const date = overview
    ? localDate()
    : queryDate && validDate(queryDate)
      ? queryDate
      : selected
        ? bookingTime(selected).slice(0, 10)
        : selectedDate || localDate();
  useEffect(() => {
    if (ready && date !== selectedDate) setSelectedDate(date);
  }, [date, ready, selectedDate, setSelectedDate]);
  const query = params.get("q") || "",
    status = params.get("status") || "all",
    service = params.get("service") || "",
    advisor = params.get("advisor") || "",
    source = params.get("source") || "",
    sort = params.get("sort") || "asc",
    mode = params.get("mode") || "day";
  function update(values: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    router.replace(`${overview ? "/co-van" : "/co-van/lich-hen"}?${next}`, {
      scroll: false,
    });
  }
  const weekday = new Date(`${date}T12:00:00`).getDay();
  const weekStart = shiftDate(date, -(weekday === 0 ? 6 : weekday - 1));
  const weekEnd = shiftDate(weekStart, 6);
  const dayBookings = data.bookings.filter((b) => {
    const at = bookingTime(b).slice(0, 10);
    return !overview && mode === "week"
      ? at >= weekStart && at <= weekEnd
      : at === date;
  });
  const filtered = dayBookings
    .filter((b) => {
      const c = data.customers.find((c) => c.id === b.customerId),
        v = data.vehicles.find((v) => v.id === b.vehicleId);
      const haystack = `${c?.name} ${c?.phone} ${v?.plate} ${b.id}`
        .toLocaleLowerCase("vi")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d");
      const needle = query
        .toLocaleLowerCase("vi")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d");
      return (
        haystack.includes(needle) &&
        (status === "all" || b.status === status) &&
        (!service || b.serviceIds.includes(service)) &&
        (!advisor || b.advisorId === advisor) &&
        (!source || b.source === source)
      );
    })
    .sort(
      (a, b) =>
        (sort === "asc" ? 1 : -1) *
        bookingTime(a).localeCompare(bookingTime(b)),
    );
  if (!ready) return <AdminLoading />;
  if (id && !selected) return <NotFoundState />;
  if (id && params.get("edit") === "1")
    return <BookingForm existing={selected} />;
  const display = selected || filtered[0];
  const days = Array.from({ length: mode === "week" ? 7 : 9 }, (_, i) =>
    shiftDate(
      date,
      i -
        (mode === "week"
          ? new Date(`${date}T12:00:00`).getDay() === 0
            ? 6
            : new Date(`${date}T12:00:00`).getDay() - 1
          : 2),
    ),
  );
  const filterCount = [service, advisor, source].filter(Boolean).length;
  return (
    <div
      className={`adm-workspace-page${id ? " has-detail" : ""}${overview ? " adm-overview" : ""}`}
    >
      {id && (
        <Link
          href={`/co-van/lich-hen?${params}`}
          className="adm-mobile-back adm-text-link"
        >
          <AdminIcon name="back" />
          Lịch hẹn
        </Link>
      )}
      <div className="adm-list-heading">
        <PageHeading
          eyebrow="CỐ VẤN DỊCH VỤ"
          title={overview ? "Tổng quan" : "Lịch hẹn"}
          description={
            overview
              ? "Theo dõi lịch hẹn hôm nay tại trạm."
              : "Sắp xếp lịch và tiếp nhận xe."
          }
        >
          <Link
            href="/co-van/lich-hen/tao-moi"
            className="adm-btn adm-primary"
            aria-label="Tạo lịch hẹn"
          >
            <AdminIcon name="plus" />
            <span>Tạo lịch hẹn</span>
          </Link>
        </PageHeading>
      </div>
      {overview && (
        <div className="adm-kpis">
          {(
            [
              {
                label: "Tổng lịch",
                value: dayBookings.length,
                icon: "calendar",
                kind: "total",
              },
              {
                label: "Chờ xác nhận",
                value: dayBookings.filter((b) => b.status === "pending").length,
                icon: "time",
                kind: "pending",
              },
              {
                label: "Đã xác nhận",
                value: dayBookings.filter((b) => b.status === "confirmed")
                  .length,
                icon: "check",
                kind: "confirmed",
              },
              {
                label: "Đã tiếp nhận",
                value: dayBookings.filter((b) =>
                  ["arrived", "completed"].includes(b.status),
                ).length,
                icon: "car",
                kind: "done",
              },
            ] as const
          ).map((k) => (
            <div key={k.kind} className={`adm-kpi adm-kpi-${k.kind}`}>
              <div>
                <span>{k.label}</span>
                <AdminIcon name={k.icon} />
              </div>
              <strong>{k.value}</strong>
              <small>{formatDate(date)}</small>
            </div>
          ))}
        </div>
      )}
      {overview && <OverviewInsights date={date} />}
      {overview && <OverviewTasks />}
      <div className="adm-master-detail">
        <section className="adm-master" aria-label="Danh sách lịch hẹn">
          <div className="adm-schedule-header">
            <div>
              <h2>{overview ? "Lịch hẹn hôm nay" : "Quản lý lịch hẹn"}</h2>
              <p className="adm-muted">
                {!overview && mode === "week"
                  ? `${formatDate(weekStart)} – ${formatDate(weekEnd)}`
                  : formatDate(date)}
              </p>
            </div>
            {overview ? (
              <div className="adm-schedule-links">
                <Link
                  href={`/co-van/lich-hen?date=${date}`}
                  className="adm-text-link"
                >
                  Tất cả lịch <AdminIcon name="arrow" />
                </Link>
              </div>
            ) : (
              <div className="adm-segment" aria-label="Chế độ xem">
                {["day", "week"].map((m) => (
                  <button
                    key={m}
                    aria-pressed={mode === m}
                    className={mode === m ? "is-active" : ""}
                    onClick={() => update({ mode: m })}
                  >
                    {m === "day" ? "Ngày" : "Tuần"}
                  </button>
                ))}
              </div>
            )}
          </div>
          {!overview && (
            <>
              <div className="adm-date-controls">
                <button
                  className="adm-icon-btn"
                  aria-label={mode === "week" ? "Tuần trước" : "Ngày trước"}
                  onClick={() =>
                    update({ date: shiftDate(date, mode === "week" ? -7 : -1) })
                  }
                >
                  <span>‹</span>
                </button>
                <button
                  className="adm-btn adm-btn-sm"
                  onClick={() => update({ date: localDate() })}
                >
                  Hôm nay
                </button>
                <label className="adm-date-picker">
                  <AdminIcon name="calendar" />
                  <input
                    aria-label="Chọn ngày xem lịch"
                    type="date"
                    value={date}
                    onChange={(e) => {
                      if (validDate(e.target.value))
                        update({ date: e.target.value });
                    }}
                  />
                </label>
                <button
                  className="adm-icon-btn"
                  aria-label={mode === "week" ? "Tuần sau" : "Ngày sau"}
                  onClick={() =>
                    update({ date: shiftDate(date, mode === "week" ? 7 : 1) })
                  }
                >
                  <span>›</span>
                </button>
              </div>
              <div
                className="adm-quick-filters adv-date-shortcuts"
                aria-label="Chọn khoảng lịch nhanh"
              >
                <button
                  type="button"
                  onClick={() => update({ date: localDate(), mode: "day" })}
                >
                  Hôm nay
                </button>
                <button
                  type="button"
                  onClick={() =>
                    update({ date: shiftDate(localDate(), 1), mode: "day" })
                  }
                >
                  Ngày mai
                </button>
                <button
                  type="button"
                  onClick={() => update({ date: localDate(), mode: "week" })}
                >
                  Tuần này
                </button>
              </div>
              <div
                className={`adm-date-strip ${mode === "week" ? "is-week" : ""}`}
                aria-label="Chọn ngày"
              >
                {days.map((d) => (
                  <button
                    key={d}
                    className={`${date === d ? "is-active" : ""} ${d === localDate() ? "is-today" : ""}`}
                    aria-pressed={date === d}
                    aria-label={`${formatDate(d)}${d === localDate() ? ", hôm nay" : ""}`}
                    onClick={() => update({ date: d })}
                  >
                    <span>{formatDate(d, { weekday: "short" })}</span>
                    <strong>{d.slice(8)}</strong>
                    {mode === "week" ? (
                      <small>
                        {
                          data.bookings.filter(
                            (b) => bookingTime(b).slice(0, 10) === d,
                          ).length
                        }{" "}
                        lịch
                      </small>
                    ) : (
                      <i />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="adm-search-row">
            <label className="adm-search">
              <AdminIcon name="search" />
              <input
                aria-label="Tìm lịch hẹn"
                placeholder="Tên, SĐT, biển số, mã lịch…"
                value={query}
                onChange={(e) => update({ q: e.target.value })}
              />
              {query && (
                <button
                  aria-label="Xóa tìm kiếm"
                  onClick={() => update({ q: "" })}
                >
                  ×
                </button>
              )}
            </label>
            <button
              className={`adm-icon-btn ${advanced ? "is-active" : ""}`}
              aria-label="Bộ lọc mở rộng"
              aria-expanded={advanced}
              onClick={() => setAdvanced(!advanced)}
            >
              <AdminIcon name="filter" />
              {filterCount > 0 && <small>{filterCount}</small>}
            </button>
          </div>
          <div className="adm-quick-filters" aria-label="Lọc trạng thái">
            {(["all", "pending", "confirmed"] as const).map((s) => (
              <button
                key={s}
                aria-pressed={status === s}
                className={status === s ? "is-active" : ""}
                onClick={() => update({ status: s })}
              >
                {s === "all" ? "Tất cả" : statuses[s]}
              </button>
            ))}
          </div>
          {(advanced || filterCount > 0) && (
            <div className="adm-filters">
              <label>
                Trạng thái
                <select
                  aria-label="Lọc trạng thái đầy đủ"
                  value={status}
                  onChange={(e) => update({ status: e.target.value })}
                >
                  <option value="all">Tất cả trạng thái</option>
                  {Object.entries(statuses).map(([s, label]) => (
                    <option key={s} value={s}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Dịch vụ
                <select
                  aria-label="Lọc dịch vụ"
                  value={service}
                  onChange={(e) => update({ service: e.target.value })}
                >
                  <option value="">Tất cả dịch vụ</option>
                  {bookingServices.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Cố vấn
                <select
                  aria-label="Lọc cố vấn"
                  value={advisor}
                  onChange={(e) => update({ advisor: e.target.value })}
                >
                  <option value="">Tất cả cố vấn</option>
                  {advisors.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Nguồn
                <select
                  aria-label="Lọc nguồn đặt lịch"
                  value={source}
                  onChange={(e) => update({ source: e.target.value })}
                >
                  <option value="">Tất cả nguồn</option>
                  {sources.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <div className="adm-results-row">
            <strong>{filtered.length} lịch hẹn</strong>
            <div>
              {(query || status !== "all" || filterCount > 0) && (
                <button
                  className="adm-text-link"
                  onClick={() =>
                    update({
                      q: "",
                      status: "",
                      service: "",
                      advisor: "",
                      source: "",
                    })
                  }
                >
                  Xóa lọc
                </button>
              )}
              <button
                className="adm-sort"
                onClick={() =>
                  update({ sort: sort === "asc" ? "desc" : "asc" })
                }
                aria-label={
                  sort === "asc"
                    ? "Sắp xếp giờ giảm dần"
                    : "Sắp xếp giờ tăng dần"
                }
              >
                Theo giờ hẹn {sort === "asc" ? "↓" : "↑"}
              </button>
            </div>
          </div>
          <div className="adm-booking-list">
            {filtered.length ? (
              filtered.map((b) => (
                <BookingCard
                  key={b.id}
                  booking={b}
                  selected={display?.id === b.id}
                  href={`/co-van/lich-hen/${b.id}?${new URLSearchParams({ ...Object.fromEntries(params), date })}`}
                />
              ))
            ) : (
              <EmptyState />
            )}
          </div>
        </section>
        <aside className={`adm-detail-pane ${id ? "is-open" : ""}`}>
          {display ? (
            <BookingDetail booking={display} embedded={!id} />
          ) : (
            <div className="adm-panel">
              <EmptyState
                title="Chọn một lịch hẹn"
                description="Thông tin tiếp nhận và lịch sử thao tác sẽ hiển thị ở đây."
                create={false}
              />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
