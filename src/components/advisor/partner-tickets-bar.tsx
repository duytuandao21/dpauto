"use client";
import { useState } from "react";
import { usePartners } from "@/lib/api/partners";
import { downloadPartnerMonth } from "@/lib/advisor/partner-export";
import { stationToday } from "@/lib/api/operations";

export const thisMonth = () => stationToday().slice(0, 7);
/** "YYYY-MM" for this month and the 23 before it, newest first. */
export function recentMonths(count = 24) {
  const [y, m] = thisMonth().split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

/** Filters of the "Đối tác" tab (month, sale) and the monthly statement export. */
export function PartnerTicketsBar({
  month,
  saleId,
  onMonth,
  onSale,
}: {
  month: string;
  saleId: string;
  onMonth: (month: string) => void;
  onSale: (saleId: string) => void;
}) {
  const { partners } = usePartners();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <div className="adv-partner-bar">
      <label className="adm-field">
        Tháng
        <select value={month} onChange={(e) => onMonth(e.target.value)}>
          {recentMonths().map((m) => (
            <option key={m} value={m}>
              Tháng {m.slice(5)}/{m.slice(0, 4)}
            </option>
          ))}
        </select>
      </label>
      <label className="adm-field">
        Sale
        <select value={saleId} onChange={(e) => onSale(e.target.value)}>
          <option value="">Tất cả sale</option>
          {partners.map((p) => {
            const options = p.sales.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.active ? "" : " (đã nghỉ)"}
              </option>
            ));
            return partners.length > 1 ? (
              <optgroup key={p.id} label={p.name}>
                {options}
              </optgroup>
            ) : (
              options
            );
          })}
        </select>
      </label>
      <button
        type="button"
        className="adm-btn"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMessage("");
          try {
            const n = await downloadPartnerMonth(month, saleId);
            setMessage(n ? `Đã xuất ${n} phiếu.` : "Tháng này chưa có phiếu đối tác.");
          } catch (e) {
            setMessage(e instanceof Error ? e.message : "Chưa thể xuất bảng kê.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Đang xuất…" : "Xuất bảng kê tháng"}
      </button>
      {message && (
        <p className="adm-muted adv-partner-bar-note" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
