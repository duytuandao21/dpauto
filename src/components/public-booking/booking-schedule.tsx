import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import {
  addDays,
  dateKey,
  dayStatus,
  displayDate,
  loadMockAvailability,
  parseDate,
  slotLabels,
  type Availability,
  type DemoScenario,
} from "@/lib/public-booking/mock";

function Calendar({
  today,
  value,
  onChange,
}: {
  today: string;
  value: string;
  onChange: (value: string) => void;
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
  const end = addDays(today, 59);
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
          const status = dayStatus(key, today);
          const outside = key < today || key > end;
          const disabled = outside || status === "closed" || status === "full";
          const label =
            status === "closed"
              ? "Ngày nghỉ mẫu"
              : status === "full"
                ? "Hết chỗ mẫu"
                : status === "limited"
                  ? "Sắp đầy mẫu"
                  : "Còn lịch mẫu";
          return (
            <button
              type="button"
              key={key}
              className={`pb-day ${key === value ? "is-selected" : ""}`}
              data-status={outside ? undefined : status}
              disabled={disabled}
              aria-label={`${displayDate(key, true)}${outside ? " · Không khả dụng" : ` · ${label}`}`}
              aria-pressed={key === value}
              aria-current={key === today ? "date" : undefined}
              onClick={() => onChange(key)}
            >
              <span>{i + 1}</span>
              {!outside && <span className="pb-day-dot" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <div className="pb-calendar-legend">
        <span>
          <i />
          Còn lịch
        </span>
        <span>
          <i className="is-limited" />
          Sắp đầy
        </span>
        <span>
          <i className="is-closed" />
          Hết chỗ / nghỉ
        </span>
      </div>
    </section>
  );
}

export function BookingSchedule({
  today,
  date,
  serviceIds,
  selectedTime,
  error,
  onDate,
  onTime,
  onReady,
}: {
  today: string;
  date: string;
  serviceIds: string[];
  selectedTime: string;
  error: string;
  onDate: (value: string) => void;
  onTime: (value: string) => void;
  onReady: (value: boolean) => void;
}) {
  const [scenario, setScenario] = useState<DemoScenario>("normal");
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{
    status: "loading" | "error" | "ready";
    data?: Availability;
  }>({ status: "loading" });
  const signature = serviceIds.join(",");
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    onReady(false);
    loadMockAvailability({
      date,
      serviceIds: signature.split(","),
      scenario,
      signal: controller.signal,
    })
      .then((data) => {
        setState({ status: "ready", data });
        onReady(true);
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") setState({ status: "error" });
      });
    return () => controller.abort();
  }, [date, signature, scenario, retry, onReady]);

  const empty =
    state.status === "ready" &&
    !state.data?.slots.some(
      (slot) => slot.status === "available" || slot.status === "limited",
    );
  function changeScenario(value: DemoScenario) {
    onTime("");
    onReady(false);
    setScenario(value);
  }
  return (
    <>
      <div className="pb-schedule-layout">
        <div>
          <h4 className="pb-section-label">Ngày đến trạm</h4>
          <Calendar
            today={today}
            value={date}
            onChange={(value) => {
              onTime("");
              onReady(false);
              onDate(value);
            }}
          />
        </div>
        <section
          className="pb-times"
          aria-label="Chọn khung giờ"
          aria-busy={state.status === "loading"}
        >
          <h4 className="pb-section-label">Khung giờ đến trạm</h4>
          <p className="pb-selected-date">{displayDate(date, true)}</p>
          {state.status === "loading" && (
            <div className="pb-loading" role="status">
              <span>Đang tải khung giờ…</span>
              <div className="pb-slot-grid">
                {Array.from({ length: 6 }, (_, i) => (
                  <div className="pb-skeleton" key={i} />
                ))}
              </div>
            </div>
          )}
          {state.status === "error" && (
            <div className="pb-empty" role="alert">
              <Icon name="clock" />
              <strong>Chưa tải được khung giờ</strong>
              <p>Bạn thử tải lại để tiếp tục nhé.</p>
              <button
                className="pb-text-button"
                type="button"
                onClick={() => {
                  setScenario("normal");
                  setRetry((value) => value + 1);
                }}
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
                  <strong>
                    {scenario === "closed"
                      ? "Ngày nghỉ minh họa"
                      : "Chưa còn khung giờ phù hợp"}
                  </strong>
                  <p>
                    {scenario === "closed"
                      ? "Trạm không phục vụ trong ngày mẫu này."
                      : "Các khung giờ mẫu đã đầy. Bạn vui lòng chọn ngày khác."}
                  </p>
                  <button
                    className="pb-text-button"
                    type="button"
                    onClick={() => {
                      changeScenario("normal");
                      let next = addDays(date, 1);
                      while (
                        ["closed", "full"].includes(dayStatus(next, today))
                      )
                        next = addDays(next, 1);
                      onDate(
                        next > addDays(today, 59) ? addDays(today, 1) : next,
                      );
                    }}
                  >
                    Chọn ngày khác
                  </button>
                </div>
              )}
              {(["morning", "afternoon"] as const).map((period) => (
                <fieldset className="pb-slot-group" key={period}>
                  <legend>
                    {period === "morning" ? "Buổi sáng" : "Buổi chiều"}
                  </legend>
                  <div className="pb-slot-grid">
                    {state.data?.slots
                      .filter((slot) => slot.period === period)
                      .map((slot) => {
                        const disabled =
                          slot.status === "full" ||
                          slot.status === "unavailable";
                        return (
                          <button
                            key={slot.id}
                            type="button"
                            className={`pb-slot ${selectedTime === slot.id ? "is-selected" : ""}`}
                            data-status={slot.status}
                            disabled={disabled}
                            aria-pressed={selectedTime === slot.id}
                            aria-label={`${slot.time} · ${selectedTime === slot.id ? "Đang chọn" : slotLabels[slot.status]}`}
                            onClick={() => onTime(slot.id)}
                          >
                            <strong>{slot.time}</strong>
                            <span>
                              {selectedTime === slot.id ? (
                                <>
                                  <Icon name="check" />
                                  Đang chọn
                                </>
                              ) : (
                                slotLabels[slot.status]
                              )}
                            </span>
                          </button>
                        );
                      })}
                  </div>
                </fieldset>
              ))}
            </>
          )}
          {error && (
            <p className="pb-error" role="alert" id="pb-time-error">
              {error}
            </p>
          )}
        </section>
      </div>
    </>
  );
}
