"use client";
import { useEffect, useState } from "react";
import { request } from "@/lib/api/client";
import { workflowTime } from "@/lib/api/workflow";
import { AdminLoading } from "@/components/admin/primitives";
import { AdminIcon } from "@/components/admin/admin-icon";

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
            <p>Nhận phụ trách {workflowTime(v.assignedAt)}</p>
            {v.endedAt && <p>Chuyển cố vấn {workflowTime(v.endedAt)}</p>}
          </article>
        ))
      ) : (
        <p>Chưa có lịch sử phụ trách phiếu.</p>
      )}
      <nav
        className="adv-pagination"
        aria-label="Phân trang lịch sử phụ trách phiếu"
      >
        <button
          className="adm-btn"
          type="button"
          aria-label="Trang trước"
          disabled={loading || !previous.length}
          onClick={() => {
            setCursor(previous.at(-1) || "");
            setPrevious(previous.slice(0, -1));
          }}
        >
          <AdminIcon name="back" />
          Trước
        </button>
        <span
          className="adv-pagination-current"
          aria-current="page"
          aria-live="polite"
        >
          Trang {previous.length + 1}
        </span>
        <button
          className="adm-btn"
          type="button"
          aria-label="Trang sau"
          disabled={loading || !!error || !next}
          onClick={() => {
            setPrevious([...previous, cursor]);
            setCursor(next || "");
          }}
        >
          Tiếp
          <AdminIcon name="back" />
        </button>
      </nav>
    </section>
  );
}
