"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AdminLoading,
  PageHeading,
  StatusBadge,
} from "@/components/admin/primitives";
import { AdminIcon } from "@/components/admin/admin-icon";
import {
  formatDate,
  shiftDate,
  statuses,
  validDate,
} from "@/lib/booking/logic";
import { useManager } from "./manager-provider";
import {
  FilterSelect,
  ManagerPanel,
  ManagerPager,
  ManagerSearch,
  ManagerEmpty,
} from "./manager-ui";
import { ManagerBookingTable, ManagerBookingDetail } from "./booking-list";

export function ManagerBookingsPage() {
  return (
    <Suspense fallback={<AdminLoading />}>
      <BookingsContent />
    </Suspense>
  );
}
function BookingsContent() {
  const params = useSearchParams();
  const { data, today } = useManager();
  const requestedDate = params.get("date") || params.get("from") || today;
  const requestedEnd = params.get("to") || today;
  const [view, setView] = useState("table");
  const [mode, setMode] = useState(params.get("from") ? "range" : "day");
  const [date, setDate] = useState(
    validDate(requestedDate) ? requestedDate : today,
  );
  const [endDate, setEndDate] = useState(
    validDate(requestedEnd) ? requestedEnd : today,
  );
  const [advisor, setAdvisor] = useState("");
  const [group, setGroup] = useState("");
  const [change, setChange] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(params.get("status") || "");
  const [service, setService] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(params.get("selected") || "");
  const week = Array.from({ length: 7 }, (_, i) => shiftDate(date, i));
  const filtered = data.bookings
    .filter((booking) => {
      const customer = data.customers.find(
        (item) => item.id === booking.customerId,
      );
      return (
        (mode === "week"
          ? week.includes(booking.date)
          : mode === "range"
            ? booking.date >= date && booking.date <= endDate
            : booking.date === date) &&
        (!status ||
          (status === "checkedin"
            ? ["arrived", "completed"].includes(booking.status)
            : booking.status === status)) &&
        (!advisor ||
          (advisor === "unassigned"
            ? !booking.advisorId
            : booking.advisorId === advisor)) &&
        (!group ||
          data.services.some(
            (s) => booking.serviceIds.includes(s.id) && s.group === group,
          )) &&
        (!change || (booking.changeKind || "new") === change) &&
        (!service || booking.serviceIds.includes(service)) &&
        `${booking.id} ${customer?.name} ${customer?.phone} ${customer?.plate}`
          .toLocaleLowerCase("vi")
          .includes(query.toLocaleLowerCase("vi"))
      );
    })
    .sort(
      (a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time),
    );
  const resetPage = (change: () => void) => {
    setPage(1);
    change();
  };
  return (
    <>
      <PageHeading
        title="Quản lý lịch hẹn"
        description="Theo dõi lịch toàn trạm và phân công cố vấn phụ trách."
      />
      <div className="mgr-section-toolbar">
        <div className="mgr-tabs" aria-label="Chế độ hiển thị">
          <button
            aria-pressed={view === "table"}
            onClick={() => resetPage(() => setView("table"))}
          >
            <AdminIcon name="more" />
            Danh sách
          </button>
          <button
            aria-pressed={view === "calendar"}
            onClick={() => resetPage(() => setView("calendar"))}
          >
            <AdminIcon name="calendar" />
            Lịch
          </button>
        </div>
        <div className="mgr-date-control">
          <button
            className="adm-icon-btn"
            aria-label="Ngày trước"
            onClick={() =>
              resetPage(() =>
                setDate(shiftDate(date, mode === "week" ? -7 : -1)),
              )
            }
          >
            <AdminIcon name="back" />
          </button>
          <input
            type="date"
            aria-label="Ngày xem lịch"
            value={date}
            onChange={(event) => {
              if (event.target.value)
                resetPage(() => setDate(event.target.value));
            }}
          />
          <button
            className="adm-icon-btn mgr-arrow-next"
            aria-label="Ngày sau"
            onClick={() =>
              resetPage(() => setDate(shiftDate(date, mode === "week" ? 7 : 1)))
            }
          >
            <AdminIcon name="back" />
          </button>
          <button
            className="adm-btn"
            onClick={() => resetPage(() => setDate(today))}
          >
            Hôm nay
          </button>
        </div>
      </div>
      <div className="mgr-toolbar">
        <FilterSelect
          label="Khoảng xem"
          value={mode}
          onChange={(v) => resetPage(() => setMode(v))}
        >
          <option value="day">Theo ngày</option>
          <option value="week">7 ngày từ ngày chọn</option>
          <option value="range">Khoảng ngày</option>
        </FilterSelect>
        {mode === "range" && (
          <label className="mgr-filter">
            Đến ngày
            <input
              type="date"
              min={date}
              value={endDate}
              onChange={(e) => resetPage(() => setEndDate(e.target.value))}
            />
          </label>
        )}
        <FilterSelect
          label="CVDV"
          value={advisor}
          onChange={(v) => resetPage(() => setAdvisor(v))}
        >
          <option value="">Tất cả</option>
          <option value="unassigned">Chưa phân công</option>
          {data.staff
            .filter((s) => s.role === "advisor")
            .map((s) => (
              <option value={s.id} key={s.id}>
                {s.name}
              </option>
            ))}
        </FilterSelect>
        <FilterSelect
          label="Nhóm dịch vụ"
          value={group}
          onChange={(v) => resetPage(() => setGroup(v))}
        >
          <option value="">Tất cả</option>
          {[...new Set(data.services.map((s) => s.group))].map((g) => (
            <option key={g}>{g}</option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Thay đổi"
          value={change}
          onChange={(v) => resetPage(() => setChange(v))}
        >
          <option value="">Tất cả</option>
          <option value="new">Lịch mới</option>
          <option value="rescheduled">Đã đổi lịch</option>
          <option value="cancelled">Đã hủy</option>
        </FilterSelect>
      </div>
      {mode === "range" && endDate < date && (
        <p role="alert" className="adm-error-text">
          Ngày kết thúc phải từ ngày bắt đầu trở đi.
        </p>
      )}
      <ManagerPanel
        title={`${filtered.length} lịch hẹn`}
        action={
          view === "calendar" &&
          mode !== "range" && (
            <div className="mgr-tabs">
              <button
                aria-pressed={mode === "day"}
                onClick={() => setMode("day")}
              >
                Ngày
              </button>
              <button
                aria-pressed={mode === "week"}
                onClick={() => setMode("week")}
              >
                Tuần
              </button>
            </div>
          )
        }
      >
        <div className="mgr-toolbar">
          <ManagerSearch
            value={query}
            onChange={(value) => resetPage(() => setQuery(value))}
            placeholder="Tìm mã lịch, tên, SĐT, biển số…"
          />
          <FilterSelect
            label="Trạng thái"
            value={status}
            onChange={(value) => resetPage(() => setStatus(value))}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="checkedin">Đã check-in (gồm hoàn tất)</option>
            {Object.entries(statuses).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            label="Dịch vụ"
            value={service}
            onChange={(value) => resetPage(() => setService(value))}
          >
            <option value="">Tất cả dịch vụ</option>
            {data.services.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </FilterSelect>
        </div>
        {view === "table" || mode === "range" ? (
          <>
            <ManagerBookingTable
              bookings={filtered.slice((page - 1) * 6, page * 6)}
              onSelect={setSelected}
            />
            <ManagerPager
              page={page}
              total={filtered.length}
              onChange={setPage}
            />
          </>
        ) : filtered.length ? (
          <div
            className={`mgr-calendar ${mode === "week" ? "mgr-week-calendar" : ""}`}
          >
            <div className="mgr-calendar-mobile">
              <ManagerBookingTable bookings={filtered} onSelect={setSelected} />
            </div>
            <div className="mgr-calendar-scroll">
              <div
                className="mgr-calendar-grid"
                style={{
                  gridTemplateColumns: `64px repeat(${mode === "week" ? 7 : 1}, minmax(${mode === "week" ? 145 : 240}px, 1fr))`,
                }}
              >
                <div className="mgr-calendar-corner">Giờ</div>
                {(mode === "week" ? week : [date]).map((day) => (
                  <div
                    className={`mgr-calendar-day ${day === today ? "is-today" : ""}`}
                    key={day}
                  >
                    {new Intl.DateTimeFormat("vi-VN", {
                      weekday: "short",
                    }).format(new Date(`${day}T12:00:00`))}
                    <strong>{formatDate(day)}</strong>
                  </div>
                ))}
                {Array.from(
                  {
                    length: Math.max(
                      1,
                      Number(data.settings.close.slice(0, 2)) -
                        Number(data.settings.open.slice(0, 2)) +
                        1,
                    ),
                  },
                  (_, i) =>
                    String(Number(data.settings.open.slice(0, 2)) + i).padStart(
                      2,
                      "0",
                    ),
                ).map((hour) => (
                  <div className="mgr-calendar-row" key={hour}>
                    <div className="mgr-calendar-hour">{hour}:00</div>
                    {(mode === "week" ? week : [date]).map((day) => (
                      <div className="mgr-calendar-cell" key={day}>
                        {filtered
                          .filter(
                            (booking) =>
                              booking.date === day &&
                              booking.time.startsWith(hour),
                          )
                          .map((booking) => (
                            <button
                              className={`mgr-calendar-event mgr-event-${booking.status}`}
                              key={booking.id}
                              onClick={() => setSelected(booking.id)}
                            >
                              <span>
                                {booking.time} · {booking.id}
                              </span>
                              <strong>
                                {
                                  data.customers.find(
                                    (item) => item.id === booking.customerId,
                                  )?.name
                                }
                              </strong>
                              <StatusBadge status={booking.status} />
                            </button>
                          ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <ManagerEmpty
            onReset={() => {
              setQuery("");
              setService("");
              setStatus("");
              setDate(today);
            }}
          />
        )}
      </ManagerPanel>
      {selected && (
        <ManagerBookingDetail
          key={selected}
          id={selected}
          onClose={() => setSelected("")}
        />
      )}
    </>
  );
}
