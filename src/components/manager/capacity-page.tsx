"use client";
import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AdminLoading, PageHeading } from "@/components/admin/primitives";
import { formatDate, validDate } from "@/lib/booking/logic";
import { serviceGroups, type CapacitySlot } from "@/lib/manager/mock";
import { useManager } from "./manager-provider";
import {
  FilterSelect,
  ManagerPanel,
  ManagerEmpty,
  ManagerField,
} from "./manager-ui";
import { ManagerModal } from "./manager-modal";

export function ManagerCapacityPage() {
  return (
    <Suspense fallback={<AdminLoading />}>
      <CapacityContent />
    </Suspense>
  );
}
function CapacityContent() {
  const { data, today, theme, ask, update } = useManager();
  const params = useSearchParams();
  const requestedDate = params.get("date") || today;
  const [date, setDate] = useState(
    validDate(requestedDate) ? requestedDate : today,
  );
  const [group, setGroup] = useState("Tất cả nhóm");
  const [config, setConfig] = useState<CapacitySlot | null>(null);
  const [total, setTotal] = useState(0);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [holidayDate, setHolidayDate] = useState(today);
  const [holidayReason, setHolidayReason] = useState("");
  const holiday = data.holidays.find((h) => h.date === date);
  const slots = data.capacity.filter(
    (s) => s.date === date && (group === "Tất cả nhóm" || s.group === group),
  );
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!config) return;
    if (
      !Number.isInteger(total) ||
      total < 0 ||
      total > 1440 ||
      !reason.trim()
    ) {
      setError("Nhập năng lực từ 0–1440 phút và lý do thay đổi.");
      return;
    }
    ask({
      title: "Điều chỉnh năng lực?",
      message: `${formatDate(date)} · ${config.time}: ${config.total} → ${total} ${config.unit}. Đã giữ ${config.reserved}; lịch hiện hữu được giữ nguyên. ${reason.trim()}`,
      label: "Cập nhật năng lực",
      action: () => {
        update(
          (d) => ({
            ...d,
            capacity: d.capacity.map((s) =>
              s.id === config.id
                ? {
                    ...s,
                    total,
                    state:
                      s.reserved >= total
                        ? "full"
                        : s.reserved >= total * 0.8
                          ? "limited"
                          : "available",
                    reason: reason.trim(),
                  }
                : s,
            ),
          }),
          "Đã điều chỉnh năng lực",
          config.id,
        );
        setConfig(null);
      },
    });
  }
  function edit(slot: CapacitySlot) {
    setError("");
    setConfig(slot);
    setTotal(slot.total);
    setReason("");
  }
  function toggleLock() {
    if (!config || !reason.trim()) {
      setError("Nhập lý do khóa hoặc mở khung giờ.");
      return;
    }
    ask({
      title: config.locked ? "Mở lại khung giờ?" : "Khóa nhận lịch mới?",
      message: `${date} · ${config.time}. ${reason.trim()} Lịch đã giữ chỗ vẫn được giữ nguyên.`,
      label: config.locked ? "Mở khung giờ" : "Khóa khung giờ",
      danger: !config.locked,
      action: () => {
        update(
          (d) => ({
            ...d,
            capacity: d.capacity.map((s) =>
              s.id === config.id
                ? { ...s, locked: !s.locked, reason: reason.trim() }
                : s,
            ),
          }),
          "Đã đổi trạng thái khung giờ",
          config.id,
        );
        setConfig(null);
      },
    });
  }
  function initDay() {
    const template = data.capacity.filter((s) => s.date === today);
    update(
      (d) => ({
        ...d,
        capacity: [
          ...d.capacity,
          ...template.map((s, i) => ({
            ...s,
            id: `CP-${date}-${i}`,
            date,
            reserved: 0,
            locked: false,
            state: "available" as const,
            reason: "",
          })),
        ],
      }),
      "Đã khởi tạo khung giờ",
      date,
    );
  }
  function addHoliday(e: FormEvent) {
    e.preventDefault();
    if (!holidayDate || !holidayReason.trim()) {
      setError("Nhập ngày nghỉ và lý do.");
      return;
    }
    ask({
      title: "Thiết lập ngày nghỉ?",
      message: `Ngừng nhận lịch mới ngày ${formatDate(holidayDate)}. Không hủy lịch đã có; cần liên hệ và điều phối riêng.`,
      action: () => {
        update(
          (d) => ({
            ...d,
            holidays: [
              ...d.holidays.filter((h) => h.date !== holidayDate),
              { date: holidayDate, reason: holidayReason.trim() },
            ],
          }),
          "Đã cập nhật ngày nghỉ",
          holidayDate,
        );
        setHolidayReason("");
      },
    });
  }
  return (
    <>
      <PageHeading
        title="Khung giờ & năng lực phục vụ"
        description="Năng lực theo nhóm dịch vụ; lịch chờ xác nhận vẫn giữ nguồn lực. Giảm năng lực không hủy lịch đã có."
      />
      <ManagerPanel
        title={`Năng lực ngày ${formatDate(date)}`}
        action={
          <span className="mgr-chip">
            {data.settings.open} – {data.settings.close}
          </span>
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
          <FilterSelect label="Nhóm dịch vụ" value={group} onChange={setGroup}>
            {serviceGroups.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </FilterSelect>
          <Link className="adm-btn" href="/dieu-hanh/cau-hinh">
            Giờ hoạt động
          </Link>
        </div>
        {holiday && (
          <p className="mgr-capacity-impact">
            Ngày nghỉ · {holiday.reason}. Không nhận thêm lịch; kiểm tra các
            lịch đã giữ chỗ.
          </p>
        )}
        <div className="mgr-capacity-grid">
          {slots.map((s) => (
            <article className="mgr-capacity-card" key={s.id}>
              <div className="mgr-section-toolbar">
                <span
                  className={`mgr-pill ${s.locked || holiday ? "mgr-pill-danger" : s.state === "available" ? "mgr-pill-success" : "mgr-pill-warning"}`}
                >
                  {s.locked
                    ? "🔒 Đã khóa"
                    : holiday
                      ? "Ngày nghỉ"
                      : s.reserved >= s.total
                        ? "Đã đầy"
                        : s.reserved >= s.total * 0.8
                          ? "Gần đầy"
                          : "Còn năng lực"}
                </span>
                <button className="adm-btn" onClick={() => edit(s)}>
                  Điều chỉnh
                </button>
              </div>
              <h3>{s.time}</h3>
              <p>
                {s.group} · {s.resource}
              </p>
              <div className="mgr-capacity-metric">
                <strong>
                  {s.reserved}
                  <small> / {s.total}</small>
                </strong>
                <span>{s.unit} đã giữ</span>
              </div>
              <progress
                value={Math.min(s.reserved, s.total)}
                max={s.total || 1}
              />
              <p>
                Còn nhận:{" "}
                {s.locked || holiday ? 0 : Math.max(0, s.total - s.reserved)}{" "}
                {s.unit}
              </p>
              {s.reserved > s.total && (
                <p className="mgr-warning-text">
                  ⚠ Vượt năng lực {s.reserved - s.total} phút. Cần điều phối
                  lịch hiện hữu.
                </p>
              )}
              {s.reason && <small>{s.reason}</small>}
            </article>
          ))}
        </div>
        {!slots.length && (
          <>
            <ManagerEmpty message="Chưa có khung giờ cho ngày / nhóm này" />
            {!data.capacity.some((s) => s.date === date) && (
              <button className="adm-btn adm-primary" onClick={initDay}>
                Khởi tạo khung ngày từ cấu hình hiện tại
              </button>
            )}
          </>
        )}
      </ManagerPanel>
      <ManagerPanel title="Ngày nghỉ / tạm ngừng phục vụ">
        <form className="mgr-form" onSubmit={addHoliday}>
          <div className="mgr-form-columns">
            <ManagerField label="Ngày nghỉ">
              <input
                required
                type="date"
                value={holidayDate}
                onChange={(e) => setHolidayDate(e.target.value)}
              />
            </ManagerField>
            <ManagerField label="Lý do">
              <input
                required
                maxLength={250}
                value={holidayReason}
                onChange={(e) => setHolidayReason(e.target.value)}
              />
            </ManagerField>
          </div>
          <button className="adm-btn" type="submit">
            Thêm ngày nghỉ
          </button>
        </form>
        {error && !config && (
          <p className="adm-error-text" role="alert">
            {error}
          </p>
        )}
        {data.holidays.map((h) => (
          <div className="mgr-summary-row" key={h.date}>
            <span>
              {formatDate(h.date)} · {h.reason}
            </span>
            <button
              className="adm-btn"
              onClick={() =>
                ask({
                  title: "Mở lại ngày phục vụ?",
                  message: formatDate(h.date),
                  action: () =>
                    update(
                      (d) => ({
                        ...d,
                        holidays: d.holidays.filter((x) => x.date !== h.date),
                      }),
                      "Đã mở lại ngày phục vụ",
                      h.date,
                    ),
                })
              }
            >
              Mở lại
            </button>
          </div>
        ))}
      </ManagerPanel>
      {config && (
        <ManagerModal
          title={`Điều chỉnh ${config.time}`}
          theme={theme}
          onClose={() => setConfig(null)}
        >
          <form className="mgr-form" onSubmit={submit}>
            <p>
              {config.group} · {config.resource}
            </p>
            <ManagerField label={`Năng lực (${config.unit})`}>
              <input
                type="number"
                min={0}
                max={1440}
                step={1}
                value={total}
                onChange={(e) => setTotal(Number(e.target.value))}
              />
            </ManagerField>
            <div className="mgr-capacity-impact">
              Đã giữ {config.reserved} phút. Sau thay đổi còn nhận{" "}
              {Math.max(0, total - config.reserved)} phút.
              {total < config.reserved &&
                ` Thiếu ${config.reserved - total} phút so với lịch đã giữ; cần điều phối, không tự hủy lịch.`}
            </div>
            <div className="mgr-line-list">
              <strong>
                Lịch đang giữ nguồn lực (
                {
                  data.bookings.filter((b) =>
                    b.holds?.some((h) => h.slotId === config.id),
                  ).length
                }
                )
              </strong>
              {data.bookings
                .filter((b) => b.holds?.some((h) => h.slotId === config.id))
                .map((b) => (
                  <Link
                    className="adm-text-link"
                    key={b.id}
                    href={`/dieu-hanh/lich-hen?selected=${b.id}&date=${b.date}`}
                  >
                    {b.id} · {b.time} ·{" "}
                    {data.customers.find((c) => c.id === b.customerId)?.plate} ↗
                  </Link>
                ))}
            </div>
            <ManagerField label="Lý do điều chỉnh *">
              <textarea
                required
                maxLength={300}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </ManagerField>
            {error && (
              <p role="alert" className="adm-error-text">
                {error}
              </p>
            )}
            <button className="adm-btn adm-primary" type="submit">
              Cập nhật năng lực
            </button>
            <button
              className={`adm-btn ${config.locked ? "" : "adm-danger"}`}
              type="button"
              onClick={toggleLock}
            >
              {config.locked ? "Mở lại khung giờ" : "Khóa nhận lịch mới"}
            </button>
          </form>
        </ManagerModal>
      )}
    </>
  );
}
