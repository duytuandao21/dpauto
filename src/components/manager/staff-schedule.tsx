"use client";
import { useState, type FormEvent } from "react";
import { createDemoId } from "@/lib/booking/logic";
import type { WorkShift } from "@/lib/manager/operations";
import { useManager } from "./manager-provider";
import {
  FilterSelect,
  ManagerPanel,
  ManagerField,
  ManagerEmpty,
} from "./manager-ui";
import { ManagerModal } from "./manager-modal";
export function ManagerStaffSchedule() {
  const { data, today, theme, update, ask } = useManager();
  const [date, setDate] = useState(today);
  const [role, setRole] = useState("");
  const [editing, setEditing] = useState<WorkShift | null>(null);
  const [error, setError] = useState("");
  const people = data.staff.filter(
    (s) => (!role || s.role === role) && s.role !== "manager",
  );
  function save(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    if (
      !editing.staffId ||
      !editing.date ||
      !editing.start ||
      !editing.end ||
      editing.start >= editing.end ||
      !editing.note.trim()
    ) {
      setError(
        "Chọn nhân viên, ngày, giờ kết thúc sau giờ bắt đầu và lý do cập nhật.",
      );
      return;
    }
    if (
      editing.state !== "leave" &&
      data.shifts.some(
        (s) =>
          s.id !== editing.id &&
          s.staffId === editing.staffId &&
          s.date === editing.date &&
          s.state !== "leave" &&
          editing.start < s.end &&
          editing.end > s.start,
      )
    ) {
      setError("Ca làm trùng giờ với một ca đã có.");
      return;
    }
    ask({
      title: "Cập nhật ca làm?",
      message: `${data.staff.find((s) => s.id === editing.staffId)?.name} · ${editing.date} · ${editing.start}–${editing.end}. ${editing.note}`,
      action: () => {
        update(
          (d) => ({
            ...d,
            shifts: [...d.shifts.filter((s) => s.id !== editing.id), editing],
          }),
          "Đã cập nhật ca làm",
          editing.staffId,
        );
        setEditing(null);
      },
    });
  }
  return (
    <ManagerPanel
      title="Lịch làm việc & khả dụng"
      action={
        <button
          className="adm-btn"
          onClick={() => {
            setEditing({
              id: createDemoId(),
              staffId: "",
              date,
              start: data.settings.open,
              end: data.settings.close,
              state: "scheduled",
              note: "",
            });
            setError("");
          }}
        >
          Thêm ca làm
        </button>
      }
    >
      <div className="mgr-toolbar">
        <label className="mgr-filter">
          Ngày
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </label>
        <FilterSelect label="Vai trò" value={role} onChange={setRole}>
          <option value="">Tất cả</option>
          <option value="advisor">Cố vấn dịch vụ</option>
          <option value="technician">Kỹ thuật viên</option>
        </FilterSelect>
      </div>
      <div className="mgr-line-list">
        {people.map((p) => {
          const shifts = data.shifts.filter(
            (s) => s.staffId === p.id && s.date === date,
          );
          return (
            <article key={p.id}>
              <strong>
                {p.name} · {p.role === "technician" ? "KTV" : "CVDV"}
              </strong>
              <a className="adm-text-link" href={`tel:${p.phone}`}>
                {p.phone}
              </a>
              {shifts.length ? (
                shifts.map((s) => (
                  <div className="mgr-summary-row" key={s.id}>
                    <span>
                      {s.start} – {s.end} ·{" "}
                      {
                        {
                          present: "Đang có mặt",
                          scheduled: "Theo lịch",
                          leave: "Nghỉ / không khả dụng",
                        }[s.state]
                      }
                      {s.note && ` · ${s.note}`}
                    </span>
                    <button
                      className="adm-btn"
                      onClick={() => {
                        setEditing({ ...s });
                        setError("");
                      }}
                    >
                      Điều chỉnh ca
                    </button>
                  </div>
                ))
              ) : (
                <p className="adm-muted">Chưa có ca làm ngày này.</p>
              )}
            </article>
          );
        })}
      </div>
      {!people.length && <ManagerEmpty />}
      {editing && (
        <ManagerModal
          title="Điều chỉnh lịch làm việc"
          theme={theme}
          onClose={() => setEditing(null)}
        >
          <form className="mgr-form" onSubmit={save}>
            <ManagerField label="Nhân viên">
              <select
                required
                value={editing.staffId}
                onChange={(e) =>
                  setEditing({ ...editing, staffId: e.target.value })
                }
              >
                <option value="">Chọn nhân viên</option>
                {data.staff
                  .filter((s) => s.role !== "manager" && s.active)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </ManagerField>
            <ManagerField label="Ngày">
              <input
                required
                type="date"
                value={editing.date}
                onChange={(e) =>
                  setEditing({ ...editing, date: e.target.value })
                }
              />
            </ManagerField>
            <div className="mgr-form-columns">
              <ManagerField label="Bắt đầu">
                <input
                  required
                  type="time"
                  value={editing.start}
                  onChange={(e) =>
                    setEditing({ ...editing, start: e.target.value })
                  }
                />
              </ManagerField>
              <ManagerField label="Kết thúc">
                <input
                  required
                  type="time"
                  value={editing.end}
                  onChange={(e) =>
                    setEditing({ ...editing, end: e.target.value })
                  }
                />
              </ManagerField>
            </div>
            <ManagerField label="Khả dụng">
              <select
                value={editing.state}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    state: e.target.value as WorkShift["state"],
                  })
                }
              >
                <option value="scheduled">Theo lịch</option>
                <option value="present">Đang có mặt</option>
                <option value="leave">Nghỉ / không khả dụng</option>
              </select>
            </ManagerField>
            <ManagerField label="Lý do thay đổi *">
              <textarea
                required
                maxLength={300}
                value={editing.note}
                onChange={(e) =>
                  setEditing({ ...editing, note: e.target.value })
                }
              />
            </ManagerField>
            {error && (
              <p role="alert" className="adm-error-text">
                {error}
              </p>
            )}
            <button className="adm-btn adm-primary">Cập nhật ca làm</button>
          </form>
        </ManagerModal>
      )}
    </ManagerPanel>
  );
}
