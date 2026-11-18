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
          const h = hours.find((h) => h.weekday === weekday);
          return (
            <div className="adm-panel mgr-form" key={weekday}>
              <label className="adm-toggle-row">
                <span>{name}</span>
                <input
                  type="checkbox"
                  checked={!!h}
                  onChange={(e) =>
                    setHours(
                      e.target.checked
                        ? [
                            ...hours,
                            { weekday, opensAt: "07:30", closesAt: "17:30" },
                          ]
                        : hours.filter((h) => h.weekday !== weekday),
                    )
                  }
                />
              </label>
              {h && (
                <div className="mgr-form-columns">
                  <ManagerField label="Mở cửa">
                    <input
                      type="time"
                      required
                      value={h.opensAt}
                      onChange={(e) =>
                        setHours(
                          hours.map((h) =>
                            h.weekday === weekday
                              ? { ...h, opensAt: e.target.value }
                              : h,
                          ),
                        )
                      }
                    />
                  </ManagerField>
                  <ManagerField label="Đóng cửa">
                    <input
                      type="time"
                      required
                      value={h.closesAt}
                      onChange={(e) =>
                        setHours(
                          hours.map((h) =>
                            h.weekday === weekday
                              ? { ...h, closesAt: e.target.value }
                              : h,
                          ),
                        )
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
