"use client";
import { PartnerName } from "@/components/advisor/partner-picker";
import { PartnerTicketsBar, thisMonth } from "@/components/advisor/partner-tickets-bar";
import { monthRange } from "@/lib/csv";
import { DateInput } from "@/components/advisor/date-input";
import { formatPhone, formatPlate } from "@/lib/advisor/formats";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { collection } from "@/lib/api/client";
import { visitDeleteMessage } from "@/lib/api/delete";
import { useSession } from "@/components/admin/auth-gate";
import { useApiPage } from "@/lib/api/use-page";
import { visitStages, serviceStage, type Visit, type VisitStage } from "@/lib/api/visits";
import { workflowTime } from "@/lib/api/workflow";
import { PageHeading, AdminLoading } from "@/components/admin/primitives";
import { VisitStageBadge } from "@/components/advisor/order-common";
import {
  ManagerPanel,
  ManagerSearch,
  FilterSelect,
  ManagerFilters,
  ManagerEmpty,
  ManagerTable,
  ManagerDeleteButton,
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
    [reload, setReload] = useState(0),
    [partnerTab, setPartnerTab] = useState(params.get("tab") === "doi-tac"),
    [month, setMonth] = useState(thisMonth),
    [partnerSale, setPartnerSale] = useState("");
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
  const partnerView = partnerTab && !board && !customerId;
  if (partnerView) {
    // Partner tab: one month of partner cars, optionally one sale.
    const range = monthRange(month);
    q.set("partner", "true");
    q.set("from", range.from);
    q.set("to", range.to);
    if (partnerSale) q.set("partnerSaleId", partnerSale);
  } else if (from || to) {
    q.set("from", from || to);
    q.set("to", to || from);
  }
  const path = "admin/service-visits?" + q;
  return (
    <>
      {!customerId && (
        <PageHeading
          title={board ? "Điều phối xe" : "Phiếu dịch vụ"}
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
        {!customerId && !board && (
          <div className="adm-quick-filters" aria-label="Nhóm phiếu">
            <button
              aria-pressed={!partnerTab}
              className={!partnerTab ? "is-active" : ""}
              onClick={() => setPartnerTab(false)}
            >
              Tất cả phiếu
            </button>
            <button
              aria-pressed={partnerTab}
              className={partnerTab ? "is-active" : ""}
              onClick={() => setPartnerTab(true)}
            >
              Đối tác
            </button>
          </div>
        )}
        {partnerView && (
          <PartnerTicketsBar
            month={month}
            saleId={partnerSale}
            onMonth={setMonth}
            onSale={setPartnerSale}
          />
        )}
        {!customerId && (
          <div className="adm-search-row">
            <ManagerSearch
              value={query}
              onChange={setQuery}
              placeholder="Tìm mã phiếu, biển số, khách, SĐT…"
            />
            <ManagerFilters
              active={!!(stage || advisor || from || to)}
              onReset={() => {
                setStage("");
                setAdvisor("");
                setFrom("");
                setTo("");
              }}
            >
              <FilterSelect label="Trạng thái xe" value={stage} onChange={setStage}>
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
              <FilterSelect label="Cố vấn phụ trách" value={advisor} onChange={setAdvisor}>
                <option value="">Tất cả cố vấn</option>
                {data.staff
                  .filter((s) => s.role === "advisor" && !s.deleted)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </FilterSelect>
              {!partnerView && (
                <div className="adv-ticket-filter-dates">
                  <label className="mgr-filter">
                    Từ ngày
                    <DateInput value={from} onValueChange={(v) => setFrom(v)} />
                  </label>
                  <label className="mgr-filter">
                    Đến ngày
                    <DateInput value={to} onValueChange={(v) => setTo(v)} />
                  </label>
                </div>
              )}
            </ManagerFilters>
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
  const canDelete = !!useSession()?.permissions.includes("visits.update");
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
                    <strong>{formatPlate(v.vehicle.plate) || v.vehicle.model}</strong>
                    <small>Tiếp nhận {workflowTime(v.receivedAt)}</small>
                  </td>
                  <td>
                    {v.partner ? (
                      <PartnerName sale={v.partner.saleName} />
                    ) : (
                      v.customer.name
                    )}
                    {!v.partner && (
                      <small>
                        <a href={`tel:${v.customer.phone}`}>{formatPhone(v.customer.phone)}</a>
                      </small>
                    )}
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
                    <div className="mgr-row-actions">
                      <Link
                        className="adm-btn"
                        href={`/dieu-hanh/phieu-dich-vu/${v.id}`}
                      >
                        Xem chi tiết
                      </Link>
                      {canDelete && v.canDelete && (
                        <ManagerDeleteButton
                          path={`admin/service-visits/${encodeURIComponent(v.id)}`}
                          version={v.version}
                          message={visitDeleteMessage(v)}
                        />
                      )}
                    </div>
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
  // Columns follow the workflow order, not the label map's key order.
  const groups = (
    ["QUOTING", "WAITING_FOR_WORK", "IN_PROGRESS", "HANDOVER"] as VisitStage[]
  ).map((s) => [s, visitStages[s]] as const);
  // Compact board card: the whole card opens the ticket; the column already names the stage.
  function card(v: Visit) {
    return (
      <Link
        className="mgr-vehicle-card"
        key={v.id}
        href={`/dieu-hanh/phieu-dich-vu/${v.id}`}
      >
        <strong>{formatPlate(v.vehicle.plate) || v.vehicle.model}</strong>
        <p>
          {v.code} · {v.partner ? v.partner.saleName : v.customer.name}
          {v.partner && <span className="adv-partner-badge">Toàn Trung</span>}
        </p>
        {v.isPaused && <VisitStageBadge stage={v.stage} />}
        <small>
          CVDV: {v.assignedAdvisor.name}
          <br />
          KTV: {v.work?.technicians.join(", ") || "Chưa phân công"}
        </small>
        {!!v.work?.total && (
          <>
            <progress max={v.work.total} value={v.work.done} />
            <small>
              {v.work.done}/{v.work.total} công việc hoàn tất
            </small>
          </>
        )}
        {v.work?.dueAt && <small>Dự kiến: {workflowTime(v.work.dueAt)}</small>}
      </Link>
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
            <Link
              className="mgr-vehicle-card"
              key={b.id}
              href={`/dieu-hanh/lich-hen?selected=${b.id}&date=${b.date}`}
            >
              <strong>
                {b.vehicleSnapshot?.plate ||
                  b.vehicleSnapshot?.model ||
                  b.customerSnapshot?.name}
              </strong>
              <p>
                {b.time} · {b.customerSnapshot?.name}
              </p>
              <small>{b.code || b.id}</small>
            </Link>
          ))}
          {!waiting.length && <p className="adm-muted">Không có lịch</p>}
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
