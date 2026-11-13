"use client";
import { useEffect, useState } from "react";
import { request } from "@/lib/api/client";
import { stationTime } from "@/lib/api/types";
import { AdminLoading } from "@/components/admin/primitives";

type Assignment = {
  id: string;
  visitId: string;
  assignedAt: string;
  endedAt: string | null;
  historicalSnapshot: {
    visitCode: string;
    receivedAt: string;
    stage: string;
  } | null;
};
export function VisitAssignmentHistory() {
  const [values, setValues] = useState<Assignment[]>([]),
    [cursor, setCursor] = useState(""),
    [previous, setPrevious] = useState<string[]>([]),
    [next, setNext] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    const a = new AbortController();
    setLoading(true);
    setValues([]);
    request<Assignment[]>(
      "admin/my-visit-history?limit=20" +
        (cursor ? "&cursor=" + encodeURIComponent(cursor) : ""),
      { signal: a.signal },
    )
      .then((r) => {
        if (!a.signal.aborted) {
          setValues(r.data);
          setNext(r.page?.nextCursor || null);
          setError("");
        }
      })
      .catch((e) => {
        if (!a.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!a.signal.aborted) setLoading(false);
      });
    return () => a.abort();
  }, [cursor]);
  return (
    <section className="adm-panel">
      <h2>Lịch sử phụ trách phiếu dịch vụ</h2>
      {error && (
        <p className="adm-error-text" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <AdminLoading />
      ) : values.length ? (
        values.map((v) => (
          <article className="adm-booking-card" key={v.id}>
            <strong>
              {v.historicalSnapshot?.visitCode || "Phiếu đang phụ trách"}
            </strong>
            <p>
              Nhận phụ trách{" "}
              {stationTime(v.assignedAt).slice(0, 16).replace("T", " ")}
            </p>
            {v.endedAt && (
              <p>
                Chuyển cố vấn{" "}
                {stationTime(v.endedAt).slice(0, 16).replace("T", " ")}
              </p>
            )}
          </article>
        ))
      ) : (
        <p>Chưa có lịch sử phụ trách phiếu.</p>
      )}
      <div className="adm-action-row">
        <button
          className="adm-btn"
          disabled={loading || !previous.length}
          onClick={() => {
            setCursor(previous.at(-1) || "");
            setPrevious(previous.slice(0, -1));
          }}
        >
          Trang trước
        </button>
        <button
          className="adm-btn"
          disabled={loading || !!error || !next}
          onClick={() => {
            setPrevious([...previous, cursor]);
            setCursor(next || "");
          }}
        >
          Trang sau
        </button>
      </div>
    </section>
  );
}
