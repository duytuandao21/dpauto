"use client";
import { formatPhone } from "@/lib/advisor/formats";
import Link from "next/link";
import { useEffect, useState } from "react";
import { request, collection } from "@/lib/api/client";
import {
  quoteLabels,
  vnd,
  workflowTime,
  type QuoteRevision,
} from "@/lib/api/workflow";
import { AdminLoading, PageHeading } from "@/components/admin/primitives";
import {
  ManagerPanel,
  ManagerSearch,
  FilterSelect,
  ManagerFilters,
  ManagerTable,
  ManagerEmpty,
} from "./manager-ui";
import { PageButtons } from "./live-stock";
type Row = {
  id: string;
  visitId: string;
  visitCode: string;
  revisionNo: number;
  kind: string;
  status: QuoteRevision["status"];
  total: string;
  customer: { name: string; phone: string };
  vehicle: { plate: string | null; model: string | null };
  createdAt: string;
};
export function LiveQuotes() {
  const [values, setValues] = useState<Row[]>([]),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [cursor, setCursor] = useState(""),
    [previous, setPrevious] = useState<string[]>([]),
    [next, setNext] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    const a = new AbortController();
    setLoading(true);
    setValues([]);
    const q = new URLSearchParams({ limit: "20" });
    if (query) q.set("q", query);
    if (status) q.set("status", status);
    if (cursor) q.set("cursor", cursor);
    const timer = setTimeout(() => {
      request<Row[]>("admin/quotes?" + q, { signal: a.signal })
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
    }, 200);
    return () => {
      a.abort();
      clearTimeout(timer);
    };
  }, [query, status, cursor]);
  function reset() {
    setCursor("");
    setPrevious([]);
  }
  return (
    <>
      <PageHeading
        title="Báo giá"
        description="Theo dõi từng bản báo giá và quyết định của khách."
      />
      <ManagerPanel title="Danh sách báo giá">
        <div className="adm-search-row">
          <ManagerSearch
            value={query}
            onChange={(value) => {
              setQuery(value);
              reset();
            }}
            placeholder="Mã phiếu, khách hàng, biển số…"
          />
          <ManagerFilters
            active={!!status}
            onReset={() => {
              setStatus("");
              reset();
            }}
          >
          <FilterSelect
            label="Trạng thái báo giá"
            value={status}
            onChange={(value) => {
              setStatus(value);
              reset();
            }}
          >
            <option value="">Tất cả</option>
            {Object.entries(quoteLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </FilterSelect>
          </ManagerFilters>
        </div>
        {error && (
          <p className="adm-error-text" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <AdminLoading />
        ) : !values.length ? (
          !error && <ManagerEmpty message="Không có báo giá phù hợp" />
        ) : (
          <div className="mgr-table-scroll">
            <ManagerTable className="mgr-table">
              <thead>
                <tr>
                  <th>Phiếu / phiên bản</th>
                  <th>Khách hàng</th>
                  <th>Phương tiện</th>
                  <th>Trạng thái</th>
                  <th>Giá trị báo giá</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {values.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link
                        className="mgr-id-link"
                        href={
                          "/dieu-hanh/phieu-dich-vu/" +
                          r.visitId +
                          "?tab=bao-gia&revision=" +
                          r.id
                        }
                      >
                        {r.visitCode}
                      </Link>
                      <small>
                        Bản {r.revisionNo}
                        {r.kind === "CHANGE_ORDER" ? " · Phát sinh" : ""}
                      </small>
                      <small>{workflowTime(r.createdAt)}</small>
                    </td>
                    <td>
                      {r.customer.name}
                      <small>
                        <a href={"tel:" + r.customer.phone}>
                          {formatPhone(r.customer.phone)}
                        </a>
                      </small>
                    </td>
                    <td>
                      {r.vehicle.plate || "Chưa có biển số"}
                      <small>{r.vehicle.model}</small>
                    </td>
                    <td>
                      <span
                        className={
                          "mgr-pill mgr-pill-" +
                          (r.status === "APPROVED"
                            ? "success"
                            : r.status === "REJECTED"
                              ? "danger"
                              : "warning")
                        }
                      >
                        {quoteLabels[r.status]}
                      </span>
                    </td>
                    <td>
                      <strong>{vnd(r.total)}</strong>
                    </td>
                    <td>
                      <Link
                        className="adm-btn"
                        href={
                          "/dieu-hanh/phieu-dich-vu/" +
                          r.visitId +
                          "?tab=bao-gia&revision=" +
                          r.id
                        }
                      >
                        Xem chi tiết
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </ManagerTable>
          </div>
        )}
        <PageButtons
          manager
          page={{
            loading,
            canPrevious: !!previous.length,
            canNext: !!next && !error,
            data: values,
            back: () => {
              setCursor(previous.at(-1) || "");
              setPrevious(previous.slice(0, -1));
            },
            forward: () => {
              setPrevious([...previous, cursor]);
              setCursor(next || "");
            },
          }}
        />
      </ManagerPanel>
    </>
  );
}

type Conflict = {
  id: string;
  resourceName: string;
  occupiedByVisitId: string;
  bookingId: string | null;
  conflictingVisitId: string | null;
  startsAt: string;
  expectedReleaseAt: string;
};
export function ResourceConflicts() {
  const [values, setValues] = useState<Conflict[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    const a = new AbortController();
    const load = () =>
      collection<Conflict>("admin/resource-conflicts", a.signal)
        .then((values) => {
          if (!a.signal.aborted) {
            setValues(values);
            setError("");
          }
        })
        .catch((e) => {
          if (!a.signal.aborted) {
            setValues([]);
            setError(e.message);
          }
        });
    void load();
    window.addEventListener("focus", load);
    window.addEventListener("dpauto-data-updated", load);
    return () => {
      a.abort();
      window.removeEventListener("focus", load);
      window.removeEventListener("dpauto-data-updated", load);
    };
  }, []);
  if (!values.length && !error) return null;
  return (
    <section className="adm-panel">
      <h2>Tài nguyên cần điều phối</h2>
      {error && (
        <p className="adm-error-text" role="alert">
          {error}
        </p>
      )}
      {values.map((c) => (
        <article className="adm-booking-card" key={c.id}>
          <strong>{c.resourceName}</strong>
          <p>Trùng thời gian {workflowTime(c.startsAt)} với xe đang sử dụng.</p>
          <div className="adm-action-row">
            <Link
              className="adm-btn"
              href={`/dieu-hanh/phieu-dich-vu/${c.occupiedByVisitId}?tab=thi-cong`}
            >
              Xe đang thi công
            </Link>
            {c.bookingId ? (
              <Link
                className="adm-btn"
                href={`/dieu-hanh/lich-hen?selected=${c.bookingId}`}
              >
                Điều chỉnh lịch hẹn
              </Link>
            ) : (
              <Link
                className="adm-btn"
                href={`/dieu-hanh/phieu-dich-vu/${c.conflictingVisitId}`}
              >
                Mở phiếu liên quan
              </Link>
            )}
          </div>
        </article>
      ))}
    </section>
  );
}
