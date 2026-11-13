"use client";
import { useEffect, useState } from "react";
import { request } from "@/lib/api/client";
import { stationTime } from "@/lib/api/types";
import { stationToday, addDays } from "@/lib/public-booking/mock";
import { PageHeading, AdminLoading } from "./primitives";
type Assignment = {
  assignmentId: string;
  bookingId: string;
  bookingCode: string;
  serviceNames: string[];
  startAtSnapshot: string;
  endedAt: string;
  statusAtTransfer: string;
  ownEventCount: number;
};
export function AssignmentHistory() {
  const [from, setFrom] = useState(() => addDays(stationToday(), -6)),
    [to, setTo] = useState(stationToday);
  const [cursor, setCursor] = useState(""),
    [previous, setPrevious] = useState<string[]>([]),
    [next, setNext] = useState<string | null>(null);
  const [data, setData] = useState<Assignment[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    request<Assignment[]>(
      `admin/my-history?from=${from}&to=${to}&limit=20${cursor ? "&cursor=" + encodeURIComponent(cursor) : ""}`,
      { signal: c.signal },
    )
      .then((r) => {
        setData(r.data);
        setNext(r.page?.nextCursor || null);
        setError("");
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [from, to, cursor]);
  return (
    <>
      <PageHeading
        title="Lịch đã bàn giao"
        description="Các lịch bạn từng phụ trách trước khi chuyển cố vấn."
      />
      <section className="adm-panel">
        <div className="adm-form-grid">
          <label className="adm-field">
            Từ ngày
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setCursor("");
                setPrevious([]);
              }}
            />
          </label>
          <label className="adm-field">
            Đến ngày
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setCursor("");
                setPrevious([]);
              }}
            />
          </label>
        </div>
        {error && (
          <p className="adm-error-text" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <AdminLoading />
        ) : data.length ? (
          data.map((a) => (
            <article key={a.assignmentId} className="adm-booking-card">
              <h3>{a.bookingCode}</h3>
              <p>{a.serviceNames.join(", ")}</p>
              <p>
                Giờ hẹn khi bàn giao:{" "}
                {stationTime(a.startAtSnapshot).slice(0, 16).replace("T", " ")}
              </p>
              <p>
                Bàn giao:{" "}
                {stationTime(a.endedAt).slice(0, 16).replace("T", " ")}
              </p>
              <p>{a.ownEventCount} thao tác của bạn</p>
            </article>
          ))
        ) : (
          <p>Chưa có lịch đã bàn giao trong khoảng này.</p>
        )}
        <div className="adm-action-row">
          <button
            className="adm-btn"
            disabled={!previous.length || loading}
            onClick={() => {
              setCursor(previous.at(-1) || "");
              setPrevious(previous.slice(0, -1));
            }}
          >
            Trang trước
          </button>
          <button
            className="adm-btn"
            disabled={!next || loading}
            onClick={() => {
              setPrevious([...previous, cursor]);
              setCursor(next || "");
            }}
          >
            Trang sau
          </button>
        </div>
      </section>
    </>
  );
}
