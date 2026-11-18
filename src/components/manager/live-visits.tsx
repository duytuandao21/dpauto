"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { collection } from "@/lib/api/client";
import { useApiPage } from "@/lib/api/use-page";
import { visitStages, serviceStage, type Visit, type VisitStage } from "@/lib/api/visits";
import { workflowTime } from "@/lib/api/workflow";
import { PageHeading, AdminLoading } from "@/components/admin/primitives";
import { VisitStageBadge } from "@/components/advisor/order-common";
import {
  ManagerPanel,
  ManagerSearch,
  FilterSelect,
  ManagerEmpty,
  ManagerTable,
} from "./manager-ui";
import { PageButtons } from "./live-stock";
import { useManager } from "./manager-provider";
import { managerVisitStage } from "@/lib/api/manager-presentation";

export function LiveManagerVisits({
  board = false,
  customerId,
}: {
  board?: boolean;
  customerId?: string;
}) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <VisitsContent board={board} customerId={customerId} />
    </Suspense>
  );
}
function VisitsContent({
  board,
  customerId,
}: {
  board: boolean;
  customerId?: string;
}) {
  const params = useSearchParams(),
    { data, today, setRange } = useManager();
  const [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [stage, setStage] = useState<string>(
      managerVisitStage(params.get("stage")),
    ),
    [advisor, setAdvisor] = useState(params.get("advisor") || ""),
    [from, setFrom] = useState(params.get("from") || ""),
    [to, setTo] = useState(params.get("to") || ""),
    [reload, setReload] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query), 200);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    if (board) setRange?.(today);
  }, [board, today, setRange]);
  useEffect(() => {
    const update = () => setReload((n) => n + 1);
    window.addEventListener("focus", update);
    window.addEventListener("dpauto-data-updated", update);
    return () => {
      window.removeEventListener("focus", update);
      window.removeEventListener("dpauto-data-updated", update);
    };
  }, []);
  const q = new URLSearchParams();
  if (board) q.set("activeOnly", "true");
  if (customerId) q.set("customerId", customerId);
  if (search) q.set("q", search);
  if (stage) q.set("stage", stage);
  if (advisor) q.set("advisorId", advisor);
  if (from || to) {
    q.set("from", from || to);
    q.set("to", to || from);
  }
  const path = "admin/service-visits?" + q;
  return (
    <>
      {!customerId && (
        <PageHeading
          title={board ? "Điều phối xe toàn trạm" : "Phiếu dịch vụ"}
          description="Theo dõi xe, người phụ trách và tiến độ trong phạm vi toàn trạm."
        >
          <Link
            className="adm-btn adm-primary"
            href="/dieu-hanh/tiep-nhan/truc-tiep"
          >
            Tiếp nhận xe trực tiếp
          </Link>
        </PageHeading>
      )}
      <ManagerPanel
        title={
          customerId
            ? "Lịch sử dịch vụ"
            : board
              ? "Theo dõi theo giai đoạn"
              : "Danh sách phiếu dịch vụ"
        }
      >
        {!customerId && (
          <div className="mgr-toolbar">
            <ManagerSearch
              value={query}
              onChange={setQuery}
              placeholder="Tìm mã phiếu, biển số, khách, SĐT…"
            />
            <FilterSelect
              label="Trạng thái xe"
              value={stage}
              onChange={setStage}
            >
              <option value="">Tất cả</option>
              {Object.entries(visitStages)
                .filter(
                  ([key]) =>
                    ["QUOTING","WAITING_FOR_WORK","IN_PROGRESS","HANDOVER","COMPLETED","ABORTED"].includes(key) && (!board || !["COMPLETED","ABORTED"].includes(key)),
                )
                .map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
            </FilterSelect>
            <FilterSelect label="CVDV" value={advisor} onChange={setAdvisor}>
              <option value="">Tất cả cố vấn</option>
              {data.staff
                .filter((s) => s.role === "advisor")
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </FilterSelect>
            <label className="mgr-filter">
              Từ ngày
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label className="mgr-filter">
              Đến ngày
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
            <button
              className="adm-btn"
              onClick={() => {
                setQuery("");
                setStage("");
                setAdvisor("");
                setFrom("");
                setTo("");
              }}
            >
              Xóa lọc
            </button>
          </div>
        )}
        {board ? (
          <VisitBoard path={path} reload={reload} />
        ) : (
          <VisitTable path={path} reload={reload} />
        )}
      </ManagerPanel>
    </>
  );
}
function VisitTable({ path, reload }: { path: string; reload: number }) {
  const p = useApiPage<Visit>(path, reload);
  return (
    <>
      {p.error && (
        <p className="adm-error-text" role="alert">
          {p.error}
        </p>
      )}
      {p.loading ? (
        <AdminLoading />
      ) : !p.data.length ? (
        !p.error && <ManagerEmpty message="Không có phiếu phù hợp bộ lọc" />
      ) : (
        <div className="mgr-table-scroll">
          <ManagerTable className="mgr-table">
            <thead>
              <tr>
                <th>Phiếu / xe</th>
                <th>Khách hàng</th>
                <th>Phụ trách</th>
                <th>Vận hành</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {p.data.map((v) => (
                <tr key={v.id}>
                  <td>
                    <Link
                      className="mgr-id-link"
                      href={`/dieu-hanh/phieu-dich-vu/${v.id}`}
                    >
                      {v.code}
                    </Link>
                    <strong>{v.vehicle.plate || v.vehicle.model}</strong>
                    <small>Tiếp nhận {workflowTime(v.receivedAt)}</small>
                  </td>
                  <td>
                    {v.customer.name}
                    <small>
                      <a href={`tel:${v.customer.phone}`}>{v.customer.phone}</a>
                    </small>
                  </td>
                  <td>
                    {v.assignedAdvisor.name}
                    <small>
                      KTV: {v.work?.technicians.join(", ") || "Chưa phân công"}
                    </small>
                  </td>
                  <td>
                    <VisitStageBadge stage={v.stage} />
                    <small>
                      {v.work
                        ? `${v.work.done}/${v.work.total} công việc hoàn tất`
                        : "Chưa lập công việc"}
                    </small>
                    {v.work?.dueAt && (
                      <small>Dự kiến {workflowTime(v.work.dueAt)}</small>
                    )}
                  </td>
                  <td>
                    <Link
                      className="adm-btn"
                      href={`/dieu-hanh/phieu-dich-vu/${v.id}`}
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
      <PageButtons manager page={p} />
    </>
  );
}
function VisitBoard({ path, reload }: { path: string; reload: number }) {
  const [values, setValues] = useState<Visit[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const { data, today } = useManager();
  useEffect(() => {
    const a = new AbortController();
    setLoading(true);
    setValues([]);
    setError("");
    collection<Visit>(path, a.signal)
      .then((v) => {
        if (!a.signal.aborted) setValues(v);
      })
      .catch((e) => {
        if (!a.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!a.signal.aborted) setLoading(false);
      });
    return () => a.abort();
  }, [path, reload]);
  if (loading) return <AdminLoading />;
  if (error)
    return (
      <p className="adm-error-text" role="alert">
        {error}
      </p>
    );
  const waiting = data.bookings.filter(
    (b) => b.date === today && ["pending", "confirmed"].includes(b.status),
  );
  const groups = (Object.entries(visitStages) as [VisitStage, string][]).filter(
    ([s]) => ["QUOTING","WAITING_FOR_WORK","IN_PROGRESS","HANDOVER"].includes(s),
  );
  function card(v: Visit) {
    return (
      <article className="mgr-vehicle-card" key={v.id}>
        <strong>{v.vehicle.plate || v.vehicle.model}</strong>
        <p>
          {v.code} · {v.customer.name}
        </p>
        <VisitStageBadge stage={v.stage} />
        <p>CVDV: {v.assignedAdvisor.name}</p>
        <small>KTV: {v.work?.technicians.join(", ") || "Chưa phân công"}</small>
        {v.work && (
          <>
            <progress max={v.work.total || 1} value={v.work.done} />
            <small>
              {v.work.done}/{v.work.total} công việc hoàn tất
            </small>
          </>
        )}
        {v.work?.dueAt && <p>Dự kiến: {workflowTime(v.work.dueAt)}</p>}
        <div className="mgr-row-actions">
          <Link className="adm-btn" href={`/dieu-hanh/phieu-dich-vu/${v.id}`}>
            Chi tiết
          </Link>
          <Link
            className="adm-text-link"
            href={`/dieu-hanh/phieu-dich-vu/${v.id}?tab=thi-cong`}
          >
            Tiến độ
          </Link>
        </div>
      </article>
    );
  }
  return (
    <>
      <div className="mgr-ops-board">
        <section className="mgr-board-column">
          <h3>
            Đặt lịch hôm nay <small>{waiting.length}</small>
          </h3>
          {waiting.map((b) => (
            <article className="mgr-vehicle-card" key={b.id}>
              <strong>
                {b.vehicleSnapshot?.plate ||
                  b.vehicleSnapshot?.model ||
                  b.customerSnapshot?.name}
              </strong>
              <p>
                {b.time} · {b.customerSnapshot?.name}
              </p>
              <Link
                className="adm-btn"
                href={`/dieu-hanh/lich-hen?selected=${b.id}&date=${b.date}`}
              >
                {b.code || b.id}
              </Link>
            </article>
          ))}
          <Link className="adm-text-link" href="/dieu-hanh/lich-hen">
            Xem lịch hẹn
          </Link>
        </section>
        {groups.map(([stage, label]) => (
          <section className="mgr-board-column" key={stage}>
            <h3>
              {label}
              <small>{values.filter((v) => serviceStage(v) === stage).length}</small>
            </h3>
            {values.filter((v) => serviceStage(v) === stage).map(card)}
            {!values.some((v) => serviceStage(v) === stage) && (
              <p className="adm-muted">Không có xe</p>
            )}
          </section>
        ))}
      </div>
      <div className="mgr-ops-mobile">
        <Link className="adm-btn" href="/dieu-hanh/lich-hen">
          Xem lịch hẹn
        </Link>
        {values.map(card)}
        {!values.length && <ManagerEmpty message="Chưa có xe đang xử lý" />}
      </div>
    </>
  );
}
