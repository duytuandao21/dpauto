"use client";
import { useState, type FormEvent } from "react";
import { useManager } from "./manager-provider";
import { ManagerPanel, ManagerField } from "./manager-ui";
import { ManagerModal } from "./manager-modal";

const days = [
  "Chủ nhật",
  "Thứ hai",
  "Thứ ba",
  "Thứ tư",
  "Thứ năm",
  "Thứ sáu",
  "Thứ bảy",
];
export function ManagerPolicyEditor() {
  const { policy, theme } = useManager(),
    [open, setOpen] = useState(false);
  return (
    <ManagerPanel
      title="Thiết lập nhận lịch"
      action={
        <button className="adm-btn adm-primary" onClick={() => setOpen(true)}>
          Chỉnh sửa
        </button>
      }
    >
      <dl className="adm-info-grid">
        <div>
          <dt>Nhận lịch trực tuyến</dt>
          <dd>{policy?.bookingEnabled ? "Đang mở" : "Đang đóng"}</dd>
        </div>
        <div>
          <dt>Mỗi khung giờ</dt>
          <dd>{policy?.slotMinutes || 60} phút</dd>
        </div>
        <div>
          <dt>Ngưỡng cảnh báo mỗi khung</dt>
          <dd>{policy?.maxBookingsPerSlot || 5} lịch</dd>
        </div>
      </dl>
      {open && (
        <ManagerModal
          title="Thiết lập nhận lịch"
          theme={theme}
          onClose={() => setOpen(false)}
          drawer
        >
          <PolicyForm onClose={() => setOpen(false)} />
        </ManagerModal>
      )}
    </ManagerPanel>
  );
}
function PolicyForm({ onClose }: { onClose: () => void }) {
  const { policy, savePolicy } = useManager();
  const [enabled, setEnabled] = useState(policy?.bookingEnabled || false),
    [width, setWidth] = useState(policy?.slotMinutes || 60),
    [limit, setLimit] = useState(policy?.maxBookingsPerSlot || 5);
  const [hours, setHours] = useState(
    policy?.hours ||
      days.map((_, weekday) => ({
        weekday,
        opensAt: "07:30",
        closesAt: "17:30",
      })),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  // A day is one hour range, or two with a lunch break between them (bookings split at noon).
  type Day = {
    opensAt: string;
    closesAt: string;
    breakFrom: string;
    breakTo: string;
  };
  const dayOf = (weekday: number): Day | null => {
    const r = hours
      .filter((h) => h.weekday === weekday)
      .sort((a, b) => (a.opensAt < b.opensAt ? -1 : 1));
    return r.length
      ? {
          opensAt: r[0].opensAt,
          closesAt: r[r.length - 1].closesAt,
          breakFrom: r.length > 1 ? r[0].closesAt : "",
          breakTo: r.length > 1 ? r[1].opensAt : "",
        }
      : null;
  };
  const setDay = (weekday: number, d: Day | null) =>
    setHours([
      ...hours.filter((h) => h.weekday !== weekday),
      ...(!d
        ? []
        : d.breakFrom && d.breakTo
          ? [
              { weekday, opensAt: d.opensAt, closesAt: d.breakFrom },
              { weekday, opensAt: d.breakTo, closesAt: d.closesAt },
            ]
          : [{ weekday, opensAt: d.opensAt, closesAt: d.closesAt }]),
    ]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !savePolicy) return;
    setBusy(true);
    setError("");
    try {
      await savePolicy({
        expectedVersion: policy?.configurationVersion,
        reason: "Cập nhật thiết lập nhận lịch",
        bookingEnabled: enabled,
        slotMinutes: width,
        maxBookingsPerSlot: limit,
        hours,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể lưu thiết lập.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="mgr-form" onSubmit={submit}>
      <fieldset className="mgr-form" disabled={busy}>
        <legend>Nhận lịch</legend>
        <label className="adm-toggle-row">
          <span>Mở nhận lịch trực tuyến</span>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
        </label>
        <div className="mgr-form-columns">
          <ManagerField label="Độ dài khung giờ (phút)">
            <input
              type="number"
              required
              min={15}
              max={120}
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
            />
          </ManagerField>
          <ManagerField label="Ngưỡng cảnh báo (lịch đã xác nhận mỗi khung)">
            <input
              type="number"
              required
              min={1}
              max={100}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            />
          </ManagerField>
        </div>
        <h3>Giờ hoạt động</h3>
        {days.map((name, weekday) => {
          const d = dayOf(weekday);
          return (
            <div className="adm-panel mgr-form" key={weekday}>
              <label className="adm-toggle-row">
                <span>{name}</span>
                <input
                  type="checkbox"
                  checked={!!d}
                  onChange={(e) =>
                    setDay(
                      weekday,
                      e.target.checked
                        ? {
                            opensAt: "07:30",
                            closesAt: "17:30",
                            breakFrom: "",
                            breakTo: "",
                          }
                        : null,
                    )
                  }
                />
              </label>
              {d && (
                <div className="mgr-form-columns">
                  <ManagerField label="Mở cửa">
                    <input
                      type="time"
                      required
                      value={d.opensAt}
                      onChange={(e) =>
                        setDay(weekday, { ...d, opensAt: e.target.value })
                      }
                    />
                  </ManagerField>
                  <ManagerField label="Đóng cửa">
                    <input
                      type="time"
                      required
                      value={d.closesAt}
                      onChange={(e) =>
                        setDay(weekday, { ...d, closesAt: e.target.value })
                      }
                    />
                  </ManagerField>
                  <ManagerField label="Nghỉ trưa từ">
                    <input
                      type="time"
                      value={d.breakFrom}
                      onChange={(e) =>
                        setDay(weekday, { ...d, breakFrom: e.target.value })
                      }
                    />
                  </ManagerField>
                  <ManagerField label="Nghỉ trưa đến">
                    <input
                      type="time"
                      value={d.breakTo}
                      onChange={(e) =>
                        setDay(weekday, { ...d, breakTo: e.target.value })
                      }
                    />
                  </ManagerField>
                </div>
              )}
            </div>
          );
        })}
        {error && (
          <p className="adm-error-text" role="alert">
            {error}
          </p>
        )}
        <button className="adm-btn adm-primary" type="submit">
          {busy ? "Đang lưu…" : "Lưu thiết lập"}
        </button>
      </fieldset>
    </form>
  );
}
