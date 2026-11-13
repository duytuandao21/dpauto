"use client";
import { useState, type FormEvent } from "react";
import { command } from "@/lib/api/client";
const outcomes: Record<string, string> = {
  UNREACHED: "Chưa liên hệ được",
  AGREED: "Đã thống nhất",
  PROPOSED_TIME: "Đề xuất giờ mới",
  DECLINED: "Khách từ chối",
  OTHER: "Khác",
};
export function BookingCommunication({
  bookingId,
  version,
}: {
  bookingId: string;
  version: number;
}) {
  const [error, setError] = useState("");
  const [channel, setChannel] = useState("PHONE"),
    [outcome, setOutcome] = useState("UNREACHED"),
    [proposed, setProposed] = useState(""),
    [note, setNote] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await command(`admin/bookings/${bookingId}/contact-events`, {
        expectedVersion: version,
        channel,
        outcome,
        ...(outcome === "PROPOSED_TIME"
          ? {
              proposedStartAt:
                proposed + (proposed.length === 16 ? ":00" : "") + "+07:00",
            }
          : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      setNote("");
      window.dispatchEvent(new Event("dpauto-data-updated"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chưa thể lưu liên hệ.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="adv-stack">
      <form className="adm-form-grid" onSubmit={submit}>
        <label className="adm-field">
          Kênh liên hệ
          <select value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="PHONE">Điện thoại</option>
            <option value="ZALO">Zalo</option>
            <option value="IN_PERSON">Tại trạm</option>
            <option value="OTHER">Khác</option>
          </select>
        </label>
        <label className="adm-field">
          Kết quả
          <select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
            {Object.entries(outcomes).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {outcome === "PROPOSED_TIME" && (
          <label className="adm-field">
            Giờ đề xuất
            <input
              required
              type="datetime-local"
              value={proposed}
              onChange={(e) => setProposed(e.target.value)}
            />
          </label>
        )}
        <label className="adm-field adm-span-full">
          Ghi chú
          <textarea
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <button className="adm-btn adm-primary" disabled={busy}>
          {busy ? "Đang lưu…" : "Ghi nhận liên hệ"}
        </button>
      </form>
      {error && (
        <p className="adm-error-text" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
