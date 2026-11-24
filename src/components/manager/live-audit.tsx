"use client";
import { eventLabel } from "@/lib/event-labels";
import { DateInput } from "@/components/advisor/date-input";
import { useEffect, useState } from "react";
import { request } from "@/lib/api/client";
import { stationTime } from "@/lib/api/types";
import { stationToday } from "@/lib/public-booking/mock";
import { PageHeading } from "@/components/admin/primitives";
import { ManagerPanel, ManagerField, ManagerTable } from "./manager-ui";
type Audit = {
  id: string;
  actor: { name: string } | string;
  action: string;
  entityType: string;
  summary: string;
  occurredAt: string;
  correlationId: string;
};
const entityLabels: Record<string, string> = {
  user: "Tài khoản",
  staff: "Nhân sự",
  booking: "Lịch hẹn",
  visit: "Phiếu dịch vụ",
  quote: "Báo giá",
  cms: "Nội dung website",
  cms_asset: "Ảnh website",
  notification: "Thông báo",
  stock_document: "Chứng từ kho",
  legacy_batch: "Dữ liệu cũ",
};
export function LiveAudit() {
  const [from, setFrom] = useState(stationToday),
    [to, setTo] = useState(stationToday),
    [cursor, setCursor] = useState(""),
    [previous, setPrevious] = useState<string[]>([]);
  const [rows, setRows] = useState<Audit[]>([]),
    [next, setNext] = useState<string | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    request<Audit[]>(
      `admin/audit-logs?from=${from}&to=${to}&limit=20${cursor ? "&cursor=" + encodeURIComponent(cursor) : ""}`,
      { signal: c.signal },
    )
      .then((r) => {
        setRows(r.data);
        setNext(r.page?.nextCursor || null);
        setError("");
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => c.abort();
  }, [from, to, cursor]);
  return (
    <>
      <PageHeading title="Nhật ký hoạt động" />
      <ManagerPanel title="Lịch sử thao tác">
        <div className="mgr-form-columns">
          <ManagerField label="Từ ngày">
            <DateInput
              value={from}
              onValueChange={(v) => {
                setFrom(v);
                setCursor("");
                setPrevious([]);
              }}
            />
          </ManagerField>
          <ManagerField label="Đến ngày">
            <DateInput
              value={to}
              onValueChange={(v) => {
                setTo(v);
                setCursor("");
                setPrevious([]);
              }}
            />
          </ManagerField>
        </div>
        {error && (
          <p role="alert" className="adm-error-text">
            {error}
          </p>
        )}
        <div className="mgr-table-scroll">
          <ManagerTable className="mgr-table">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Nhân viên</th>
                <th>Thao tác</th>
                <th>Đối tượng</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    {stationTime(r.occurredAt)
                      .slice(0, 16)
                      .replace(/^(\d{4})-(\d{2})-(\d{2})T/, "$3/$2/$1 ")}
                  </td>
                  <td>
                    {typeof r.actor === "string" ? "Hệ thống" : r.actor.name}
                  </td>
                  <td>{eventLabel(r.summary)}</td>
                  <td>{entityLabels[r.entityType] || r.entityType}</td>
                </tr>
              ))}
            </tbody>
          </ManagerTable>
        </div>
        <div className="adm-action-row">
          <button
            className="adm-btn"
            disabled={!previous.length}
            onClick={() => {
              setCursor(previous.at(-1) || "");
              setPrevious(previous.slice(0, -1));
            }}
          >
            Trang trước
          </button>
          <button
            className="adm-btn"
            disabled={!next}
            onClick={() => {
              setPrevious([...previous, cursor]);
              setCursor(next || "");
            }}
          >
            Trang sau
          </button>
        </div>
      </ManagerPanel>
    </>
  );
}
