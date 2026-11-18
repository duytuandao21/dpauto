"use client";
import { DateInput } from "@/components/advisor/date-input";
import { formatPhone, formatPlate } from "@/lib/advisor/formats";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  advisors as seedAdvisors,
  bookingServices as seedServices,
} from "@/lib/booking/seed";
import {
  bookingTime,
  formatDate,
  localDate,
  shiftDate,
  slotLabel,
  sources,
  statuses,
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
import { OverviewTasks } from "@/components/advisor/overview-tasks";
import { apiEnabled } from "@/lib/api/client";
import { pendingQueue } from "@/lib/booking/queue";
import { WorkspaceDrawer } from "@/components/advisor/workspace-drawer";
import { EditBookingLink, RescheduleButton } from "./booking-actions";

export function BookingCard({
  booking,
  selected,
  href,
  compact = false,
}: {
  booking: Booking;
  selected?: boolean;
  href: string;
  compact?: boolean;
}) {
  const { data } = useBookings(),
    customer =
      booking.customerSnapshot ||
      data.customers.find((c) => c.id === booking.customerId),
    vehicle =
      booking.vehicleSnapshot ||
      data.vehicles.find((v) => v.id === booking.vehicleId);
  const advisors = data.advisors ?? seedAdvisors,
    bookingServices = data.services ?? seedServices;
  const serviceNames = booking.serviceIds.map(
    (id) =>
      booking.serviceNames?.[id] ||
      bookingServices.find((s) => s.id === id)?.name ||
      "Chưa có tên dịch vụ",
  );
  return (
    <article
      className={`adm-booking-card ${selected ? "is-selected" : ""}${compact ? " adm-task-card" : ""}`}
      data-status={booking.status}
    >
      <div className="adm-card-top">
        {compact ? (
          <Link href={href} scroll={false} className="adm-task-customer">
            <h3>{customer?.name}</h3>
          </Link>
        ) : (
          <Link href={href} scroll={false} className="adm-booking-time">
            <AdminIcon name="time" />
            <time dateTime={bookingTime(booking)}>{slotLabel(booking)}</time>
          </Link>
        )}
        <StatusBadge status={booking.status} />
      </div>
      {!compact && (
        <p className="adm-muted">
          {booking.code || booking.id} · {formatDate(bookingTime(booking))}
        </p>
      )}
      <Link
        href={href}
        scroll={false}
        className="adm-card-main"
        aria-current={selected ? "true" : undefined}
      >
        <div className="adm-booking-customer">
          {!compact && (
            <span className="adm-customer-initials" aria-hidden="true">
              {customer?.name
                .split(" ")
                .slice(-2)
                .map((word) => word[0])
                .join("")}
            </span>
          )}
          <div>
            {!compact && <h3>{customer?.name}</h3>}
            <p>
              {vehicle?.model}
              <span>·</span>
              {formatPlate(vehicle?.plate) || "Chưa có biển số"}
            </p>
          </div>
        </div>
        {compact && (
          <p className="adm-task-time">
            <AdminIcon name="calendar" />
            <time dateTime={bookingTime(booking)}>
              {formatDate(bookingTime(booking))} · {slotLabel(booking)}
            </time>
          </p>
        )}
        <p className="adm-card-service">
          <AdminIcon name="tool" />
          {compact ? (
            <span className="adv-booking-services">
              {serviceNames.length ? (
                serviceNames.slice(0, 2).map((name, index) => (
                  <span key={booking.serviceIds[index]} title={name}>
                    {name}
                  </span>
                ))
              ) : (
                <span>Chưa chọn dịch vụ</span>
              )}
              {serviceNames.length > 2 && (
                <span className="adv-booking-services-more">
                  +{serviceNames.length - 2} dịch vụ khác
                </span>
              )}
            </span>
          ) : (
            serviceNames.join(", ")
          )}
          {!compact && (
            <span className="adm-card-assignee">
              · {advisors.find((a) => a.id === booking.advisorId)?.name}
            </span>
          )}
        </p>
      </Link>
      {!compact && customer?.phone && (
        <a className="adm-phone" href={`tel:${formatPhone(customer.phone)}`}>
          <AdminIcon name="phone" />
          {formatPhone(customer.phone)}
        </a>
      )}
      <div className="adm-card-footer">
        {!compact && (
          <span className="adm-card-advisor">
            <AdminIcon name="user" />
            {advisors.find((a) => a.id === booking.advisorId)?.name ||
              "Chưa phân công"}
          </span>
        )}
        <BookingActions booking={booking} compact />
        {compact && customer?.phone && (
          <a
            className="adm-btn adm-task-call"
            href={`tel:${formatPhone(customer.phone)}`}
            aria-label={`Gọi ${customer.name}`}
          >
            <AdminIcon name="phone" />
            <span>Gọi</span>
          </a>
        )}
        {compact ? (
          <Link href={href} scroll={false} className="adm-btn">
            Chi tiết
          </Link>
        ) : (
          <details className="adm-booking-menu">
            <summary className="adm-btn" aria-label="Thao tác khác">
              …
            </summary>
            <div className="adv-actions">
              <Link href={href} scroll={false} className="adm-btn">
                Chi tiết & lịch sử
              </Link>
              <EditBookingLink booking={booking} />
              <RescheduleButton booking={booking} />
              <BookingActions booking={booking} secondaryOnly />
            </div>
          </details>
        )}
      </div>
    </article>
  );
}
export function BookingTable({
  bookings,
  selectedId,
  params,
  date,
  overview = false,
}: {
  bookings: Booking[];
  selectedId?: string;
  params: URLSearchParams;
  date: string;
  overview?: boolean;
}) {
  const { data } = useBookings();
  const services = data.services ?? seedServices;
  return (
    <div
      className="adv-data-scroll adv-bookings-scroll"
      role="region"
      aria-label="Bảng lịch hẹn"
      tabIndex={0}
    >
      <table className="adv-data-table adv-bookings-table" role="table">
        <thead role="rowgroup">
          <tr role="row">
            <th scope="col">Lịch hẹn</th>
            <th scope="col">Khách hàng</th>
            <th scope="col">Xe</th>
            <th scope="col">Dịch vụ</th>
            <th scope="col">Trạng thái</th>
            <th scope="col">Thao tác</th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          {bookings.map((booking) => {
            const customer =
              booking.customerSnapshot ||
              data.customers.find((c) => c.id === booking.customerId);
            const vehicle =
              booking.vehicleSnapshot ||
              data.vehicles.find((v) => v.id === booking.vehicleId);
            const href = overview
              ? `/co-van?${new URLSearchParams({ ...Object.fromEntries(params), booking: booking.id })}`
              : `/co-van/lich-hen/${booking.id}?${new URLSearchParams({ ...Object.fromEntries(params), date })}`;
            const serviceNames = booking.serviceIds.map(
              (id) =>
                booking.serviceNames?.[id] ||
                services.find((s) => s.id === id)?.name ||
                "Chưa có tên dịch vụ",
            );
            return (
              <tr
                key={booking.id}
                role="row"
                className={
                  selectedId === booking.id ? "is-selected" : undefined
                }
              >
                <td role="cell" className="adv-booking-schedule">
                  <Link
                    className="adm-text-link adv-booking-code"
                    href={href}
                    scroll={false}
                  >
                    {booking.code || booking.id}
                  </Link>
                  <small>
                    {formatDate(bookingTime(booking))} · {slotLabel(booking)}
                  </small>
                </td>
                <td role="cell" className="adv-booking-customer">
                  <Link href={href} scroll={false}>
                    <strong>{customer?.name || "Chưa có thông tin"}</strong>
                  </Link>
                  {customer?.phone && (
                    <a
                      className="adv-table-secondary"
                      href={`tel:${formatPhone(customer.phone)}`}
                    >
                      {formatPhone(customer.phone)}
                    </a>
                  )}
                </td>
                <td role="cell" className="adv-booking-vehicle">
                  <strong>
                    {formatPlate(vehicle?.plate) || "Chưa có biển số"}
                  </strong>
                  <small>{vehicle?.model || "Chưa ghi dòng xe"}</small>
                </td>
                <td role="cell" className="adv-booking-service-cell">
                  <div className="adv-booking-services">
                    {serviceNames.length ? (
                      serviceNames.slice(0, 2).map((name, index) => (
                        <span key={booking.serviceIds[index]} title={name}>
                          {name}
                        </span>
                      ))
                    ) : (
                      <span className="adm-muted">Chưa chọn dịch vụ</span>
                    )}
                    {serviceNames.length > 2 && (
                      <Link
                        href={href}
                        scroll={false}
                        className="adm-text-link"
                        aria-label={`Xem tất cả ${serviceNames.length} dịch vụ`}
                      >
                        +{serviceNames.length - 2} dịch vụ khác
                      </Link>
                    )}
                  </div>
                </td>
                <td role="cell" className="adv-booking-status">
                  <StatusBadge status={booking.status} />
                </td>
                <td role="cell" className="adv-booking-action-cell">
                  <div className="adv-table-actions">
                    <BookingActions booking={booking} compact />
                    <Link className="adm-btn" href={href} scroll={false}>
                      Chi tiết
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
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
  const advisors = data.advisors ?? seedAdvisors,
    bookingServices = data.services ?? seedServices;
  const [advanced, setAdvanced] = useState(false);
  const selectionId = id || (overview ? params.get("booking") : null);
  const selected = data.bookings.find((b) => b.id === selectionId);
  const queryDate = params.get("date");
  const requestedView = params.get("view") || "pending";
  const view =
    overview && !["pending", "today", "arrived"].includes(requestedView)
      ? "pending"
      : requestedView;
  const date =
    overview || view === "today"
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
    status = overview ? "all" : params.get("status") || "all",
    service = params.get("service") || "",
    advisor = params.get("advisor") || "",
    source = params.get("source") || "",
    sort = params.get("sort") || "asc",
    mode = params.get("mode") || "day";
  const queue = pendingQueue(data.bookings);
  const upcoming = data.bookings.filter(
    (b) =>
      b.status === "confirmed" && bookingTime(b).slice(0, 10) === localDate(),
  );
  const arrived = data.bookings.filter((b) => b.status === "arrived");
  function update(values: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    if (overview) next.delete("booking");
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
  const viewBookings =
    view === "pending"
      ? queue
      : view === "today"
        ? upcoming
        : view === "arrived"
          ? arrived
          : dayBookings;
  const filtered = viewBookings
    .filter((b) => {
      const c =
          b.customerSnapshot ||
          data.customers.find((c) => c.id === b.customerId),
        v =
          b.vehicleSnapshot || data.vehicles.find((v) => v.id === b.vehicleId);
      const haystack =
        `${c?.name} ${c?.phone} ${formatPhone(c?.phone)} ${v?.plate} ${formatPlate(v?.plate)} ${b.code || b.id}`
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
    .sort((a, b) =>
      view === "pending"
        ? queue.indexOf(a) - queue.indexOf(b)
        : (overview || sort === "asc" ? 1 : -1) *
          bookingTime(a).localeCompare(bookingTime(b)),
    );
  if (!ready) return <AdminLoading />;
  if (id && !selected) return <NotFoundState />;
  if (id && params.get("edit") === "1")
    return <BookingForm existing={selected} />;
  const display = overview
    ? filtered.find((b) => b.id === selectionId) || filtered[0]
    : selected || filtered[0];
  const detailOpen =
    !!id || (overview && !!selectionId && display?.id === selectionId);
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
      className={`adm-workspace-page${detailOpen ? " has-detail" : ""}${overview ? " adm-overview" : ""}`}
    >
      <div className="adm-list-heading">
        <PageHeading
          eyebrow="CỐ VẤN DỊCH VỤ"
          title={overview ? "Tổng quan" : "Lịch hẹn"}
          description={
            overview
              ? "Công việc cần xử lý tại trạm"
              : "Sắp xếp lịch và tiếp nhận xe."
          }
        >
          <div className="adv-actions">
            {apiEnabled && !overview && (
              <Link href="/co-van/tiep-nhan/truc-tiep" className="adm-btn">
                Tiếp nhận xe trực tiếp
              </Link>
            )}
            <Link
              href="/co-van/lich-hen/tao-moi"
              className="adm-btn adm-primary"
              aria-label="Tạo lịch hẹn"
            >
              <AdminIcon name="plus" />
              <span>{overview ? "Tạo lịch" : "Tạo lịch hẹn"}</span>
            </Link>
          </div>
        </PageHeading>
      </div>
      {overview && (
        <div className="adm-kpis">
          {(
            [
              {
                label: "Chờ xác nhận",
                value: queue.length,
                icon: "time",
                kind: "pending",
              },
              {
                label: "Sắp đến",
                value: upcoming.length,
                icon: "check",
                kind: "confirmed",
              },
              {
                label: "Đã đến",
                value: arrived.length,
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
              <small>
                {k.kind === "pending" ? "Tất cả ngày" : formatDate(date)}
              </small>
            </div>
          ))}
        </div>
      )}
      <div className="adm-master-detail adv-list-workspace">
        <section className="adm-master" aria-label="Danh sách lịch hẹn">
          <div className="adm-schedule-header">
            {overview ? (
              <div className="adm-task-heading">
                <h2>Lịch cần xử lý</h2>
                <span className="adm-muted">
                  {queue.length + upcoming.length + arrived.length} lịch
                </span>
              </div>
            ) : (
              <div>
                <h2>
                  {view === "pending"
                    ? "Cần xử lý"
                    : view === "today"
                      ? "Lịch hôm nay"
                      : view === "arrived"
                        ? "Đã đến"
                        : "Quản lý lịch hẹn"}
                </h2>
                <p className="adm-muted">
                  {view === "pending"
                    ? "Tất cả yêu cầu chưa chốt lịch"
                    : !overview && mode === "week"
                      ? `${formatDate(weekStart)} – ${formatDate(weekEnd)}`
                      : formatDate(date)}
                </p>
              </div>
            )}
            {!overview && view === "all" ? (
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
            ) : null}
          </div>
          <div id={overview ? "advisor-task-list" : undefined}>
            <div className="adm-quick-filters" aria-label="Nhóm lịch hẹn">
              {(overview
                ? [
                    ["pending", `Chờ xử lý (${queue.length})`],
                    ["today", `Sắp đến (${upcoming.length})`],
                    ["arrived", `Đã đến (${arrived.length})`],
                  ]
                : [
                    ["pending", `Cần xử lý (${queue.length})`],
                    ["today", "Lịch hôm nay"],
                    ["arrived", "Đã đến"],
                    ["all", "Tất cả lịch"],
                  ]
              ).map(([value, label]) => (
                <button
                  key={value}
                  aria-pressed={view === value}
                  className={view === value ? "is-active" : ""}
                  onClick={() => update({ view: value, status: "" })}
                >
                  {label}
                </button>
              ))}
            </div>
            {!overview && view === "all" && (
              <>
                <div className="adm-date-controls">
                  <button
                    className="adm-icon-btn"
                    aria-label={mode === "week" ? "Tuần trước" : "Ngày trước"}
                    onClick={() =>
                      update({
                        date: shiftDate(date, mode === "week" ? -7 : -1),
                      })
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
                    <DateInput
                      aria-label="Chọn ngày xem lịch"
                      value={date}
                      onValueChange={(value) => {
                        if (validDate(value)) update({ date: value });
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
            <div
              className={`adm-search-row${overview && (advanced || query || filterCount > 0) ? " adm-task-search" : ""}`}
            >
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
              {!overview && (
                <button
                  className={`adm-btn ${advanced ? "is-active" : ""}`}
                  aria-label="Bộ lọc mở rộng"
                  aria-expanded={advanced}
                  onClick={() => setAdvanced(!advanced)}
                >
                  <AdminIcon name="filter" />
                  Bộ lọc
                  {filterCount > 0 && <small>{filterCount}</small>}
                </button>
              )}
            </div>
            {view === "all" && (
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
            )}
            {(advanced || filterCount > 0) && (
              <div className="adm-filters">
                {view === "all" && (
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
                )}
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
              {overview ? (
                <span className="adm-muted">
                  {view === "pending"
                    ? "Ưu tiên lịch gần nhất và chờ lâu nhất"
                    : `${filtered.length} lịch hẹn${view === "today" ? ` · ${formatDate(date)}` : ""}`}
                </span>
              ) : (
                <strong>{filtered.length} lịch hẹn</strong>
              )}
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
                {overview && (
                  <button
                    className={`adm-icon-btn ${advanced ? "is-active" : ""}`}
                    aria-label="Tìm kiếm và lọc công việc"
                    aria-expanded={advanced}
                    onClick={() => setAdvanced(!advanced)}
                  >
                    <AdminIcon name="filter" />
                    {filterCount > 0 && <small>{filterCount}</small>}
                  </button>
                )}
                {!overview && (
                  <button
                    className="adm-sort"
                    disabled={view === "pending"}
                    onClick={() =>
                      update({ sort: sort === "asc" ? "desc" : "asc" })
                    }
                    aria-label={
                      sort === "asc"
                        ? "Sắp xếp giờ giảm dần"
                        : "Sắp xếp giờ tăng dần"
                    }
                  >
                    {view === "pending"
                      ? "Ưu tiên ngày mong muốn"
                      : `Theo giờ hẹn ${sort === "asc" ? "↓" : "↑"}`}
                  </button>
                )}
              </div>
            </div>
            {filtered.length > 0 ? (
              <BookingTable
                bookings={overview ? filtered.slice(0, 5) : filtered}
                selectedId={detailOpen ? display?.id : undefined}
                params={params}
                date={date}
                overview={overview}
              />
            ) : (
              <div className="adm-booking-list">
                <EmptyState />
              </div>
            )}
            {overview && (
              <div className="adm-task-heading adv-overview-footer">
                <span className="adm-muted">
                  {filtered.length > 5
                    ? `Hiển thị 5 / ${filtered.length} lịch ưu tiên trong nhóm`
                    : ""}
                </span>
                <Link className="adm-text-link" href="/co-van/lich-hen">
                  Xem tất cả lịch hẹn
                </Link>
              </div>
            )}
          </div>
        </section>
        {detailOpen && display && (
          <WorkspaceDrawer
            title="Chi tiết lịch hẹn"
            closeHref={
              overview
                ? `/co-van?${new URLSearchParams([...params].filter(([key]) => key !== "booking"))}`
                : `/co-van/lich-hen?${params}`
            }
          >
            <BookingDetail booking={display} />
          </WorkspaceDrawer>
        )}
      </div>
      {overview && <OverviewTasks />}
    </div>
  );
}
