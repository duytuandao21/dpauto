import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { apiEnabled, request } from "@/lib/api/client";
import type { PublicCatalog } from "@/lib/api/types";
import {
  addDays,
  dateKey,
  dayStatus,
  displayDate,
  loadMockAvailability,
  parseDate,
} from "@/lib/public-booking/mock";

function Calendar({
  today,
  value,
  onChange,
  advanceDays = 59,
}: {
  today: string;
  value: string;
  onChange: (value: string) => void;
  advanceDays?: number;
}) {
  const [month, setMonth] = useState(
    () =>
      new Date(
        parseDate(value).getFullYear(),
        parseDate(value).getMonth(),
        1,
        12,
      ),
  );
  useEffect(() => {
    const selected = parseDate(value);
    setMonth(new Date(selected.getFullYear(), selected.getMonth(), 1, 12));
  }, [value]);
  const end = addDays(today, advanceDays);
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const leading = (month.getDay() + 6) % 7;
  const first = dateKey(month);
  const monthLabel = new Intl.DateTimeFormat("vi-VN", {
    month: "long",
    year: "numeric",
  }).format(month);
  function move(amount: number) {
    setMonth(new Date(month.getFullYear(), month.getMonth() + amount, 1, 12));
  }
  return (
    <section className="pb-calendar" aria-label="Chọn ngày đến trạm">
      <div className="pb-calendar-heading">
        <button
          type="button"
          className="pb-icon-button"
          aria-label="Tháng trước"
          disabled={first.slice(0, 7) <= today.slice(0, 7)}
          onClick={() => move(-1)}
        >
          <Icon name="chevron" className="pb-chevron-prev" />
        </button>
        <strong aria-live="polite">{monthLabel}</strong>
        <button
          type="button"
          className="pb-icon-button"
          aria-label="Tháng sau"
          disabled={first.slice(0, 7) >= end.slice(0, 7)}
          onClick={() => move(1)}
        >
          <Icon name="chevron" className="pb-chevron-next" />
        </button>
      </div>
      <div className="pb-calendar-grid">
        {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => (
          <span className="pb-weekday" key={day} aria-hidden="true">
            {day}
          </span>
        ))}
        {Array.from({ length: leading }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const key = dateKey(
            new Date(month.getFullYear(), month.getMonth(), i + 1, 12),
          );
          // Requests are unlimited: a day is only unavailable when the station is closed.
          const status =
            !apiEnabled && dayStatus(key, today) === "closed"
              ? "closed"
              : "available";
          const outside = key < today || key > end;
          const disabled = outside || status === "closed";
          const label = status === "closed" ? "Ngày nghỉ mẫu" : "Nhận lịch mẫu";
          return (
            <button
              type="button"
              key={key}
              className={`pb-day ${key === value ? "is-selected" : ""}`}
              data-status={outside || apiEnabled ? undefined : status}
              disabled={disabled}
              aria-label={`${displayDate(key, true)}${outside ? " · Không khả dụng" : apiEnabled ? "" : ` · ${label}`}`}
              aria-pressed={key === value}
              aria-current={key === today ? "date" : undefined}
              onClick={() => onChange(key)}
            >
              <span>{i + 1}</span>
              {!outside && !apiEnabled && (
                <span className="pb-day-dot" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>
      {!apiEnabled && (
        <div className="pb-calendar-legend">
          <span>
            <i />
            Nhận lịch
          </span>
          <span>
            <i className="is-closed" />
            Ngày nghỉ
          </span>
        </div>
      )}
    </section>
  );
}

type Period = "morning" | "afternoon";
const periods: { id: Period; label: string; hint: string }[] = [
  { id: "morning", label: "Buổi sáng", hint: "7:30 – 12:00" },
  { id: "afternoon", label: "Buổi chiều", hint: "13:30 – 17:30" },
];

export function BookingSchedule({
  today,
  date,
  serviceIds,
  selectedTime,
  error,
  onDate,
  onTime,
  onReady,
  catalog,
}: {
  today: string;
  date: string;
  serviceIds: string[];
  /** Selected period ("morning" | "afternoon"); the advisor sets the exact time later. */
  selectedTime: string;
  error: string;
  onDate: (value: string) => void;
  onTime: (value: string) => void;
  onReady: (value: boolean) => void;
  catalog?: PublicCatalog | null;
}) {
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{
    status: "loading" | "error" | "ready";
    open?: Record<Period, boolean>;
    /** Station hours per half-day from the API ("7:30 – 12:00"); falls back to the defaults above. */
    hours?: Partial<Record<Period, string>>;
  }>({ status: "loading" });
  const signature = serviceIds.join(",");
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    onReady(false);
    let hours: Partial<Record<Period, string>> = {};
    const loading: Promise<Record<Period, boolean>> =
      apiEnabled && catalog
        ? request<{
            periods: {
              period: string;
              status: string;
              opensAt?: string | null;
              closesAt?: string | null;
            }[];
          }>("public/availability?" + new URLSearchParams({ date }), {
            signal: controller.signal,
          }).then((r) => {
            const open = (p: string) =>
              r.data.periods.some(
                (x) => x.period === p && x.status === "AVAILABLE",
              );
            const span = (p: string) => {
              const x = r.data.periods.find((x) => x.period === p);
              const t = (v: string) => v.replace(/^0/, "");
              return x?.opensAt && x.closesAt
                ? `${t(x.opensAt)} – ${t(x.closesAt)}`
                : undefined;
            };
            hours = { morning: span("MORNING"), afternoon: span("AFTERNOON") };
            return { morning: open("MORNING"), afternoon: open("AFTERNOON") };
          })
        : apiEnabled
          ? Promise.reject(new Error("Chưa tải được danh mục dịch vụ."))
          : loadMockAvailability({
              date,
              serviceIds: signature.split(","),
              scenario: "normal",
              signal: controller.signal,
            }).then((data) => {
              const open = (p: Period) =>
                data.slots.some(
                  (s) => s.period === p && s.status !== "unavailable",
                );
              return { morning: open("morning"), afternoon: open("afternoon") };
            });
    loading
      .then((open) => {
        setState({ status: "ready", open, hours });
        onReady(true);
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") setState({ status: "error" });
      });
    return () => controller.abort();
  }, [date, signature, retry, onReady, catalog]);

  const empty =
    state.status === "ready" && !state.open?.morning && !state.open?.afternoon;
  return (
    <div className="pb-schedule-layout">
      <div>
        <h4 className="pb-section-label">Ngày đến trạm</h4>
        <Calendar
          today={today}
          value={date}
          advanceDays={catalog?.bookingPolicy.advanceDays}
          onChange={(value) => {
            onTime("");
            onReady(false);
            onDate(value);
          }}
        />
      </div>
      <section
        className="pb-times"
        aria-label="Chọn buổi đến trạm"
        aria-busy={state.status === "loading"}
      >
        <div className="pb-times-heading">
          <h4 className="pb-section-label">Buổi đến trạm</h4>
          <p className="pb-selected-date">{displayDate(date)}</p>
        </div>
        {state.status === "loading" && (
          <div className="pb-loading" role="status">
            <span>Đang kiểm tra lịch làm việc…</span>
            <div className="pb-slot-grid">
              <div className="pb-skeleton" />
              <div className="pb-skeleton" />
            </div>
          </div>
        )}
        {state.status === "error" && (
          <div className="pb-empty" role="alert">
            <Icon name="clock" />
            <strong>Chưa tải được lịch làm việc</strong>
            <p>Bạn thử tải lại để tiếp tục nhé.</p>
            <button
              className="pb-text-button"
              type="button"
              onClick={() => setRetry((value) => value + 1)}
            >
              Thử lại
            </button>
          </div>
        )}
        {state.status === "ready" && (
          <>
            {empty && (
              <div className="pb-empty" role="status">
                <Icon name="clock" />
                <strong>Trạm không nhận lịch ngày này</strong>
                <p>Bạn vui lòng chọn ngày khác.</p>
              </div>
            )}
            <div className="pb-slot-grid">
              {periods.map((p) => {
                const available = !!state.open?.[p.id],
                  selected = selectedTime === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`pb-slot ${selected ? "is-selected" : ""}`}
                    data-status={available ? "available" : "unavailable"}
                    disabled={!available}
                    aria-pressed={selected}
                    aria-label={`${p.label} · ${selected ? "Đang chọn" : available ? (state.hours?.[p.id] || p.hint) : "Không nhận lịch"}`}
                    onClick={() => onTime(p.id)}
                  >
                    <strong>{p.label}</strong>
                    <span>
                      {selected ? (
                        <>
                          <Icon name="check" />
                          Đang chọn
                        </>
                      ) : available ? (
                        (state.hours?.[p.id] || p.hint)
                      ) : (
                        "Không nhận lịch"
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
        <p className="pb-caption">Cố vấn sẽ liên hệ xác nhận giờ cụ thể.</p>
        {error && (
          <p className="pb-error" role="alert" id="pb-time-error">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
