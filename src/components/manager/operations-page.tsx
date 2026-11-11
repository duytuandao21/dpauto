"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AdminLoading, PageHeading } from "@/components/admin/primitives";
import { formatMoney } from "@/lib/advisor/seed";
import {
  operationStages,
  quoteStatuses,
  orderAmounts,
  paymentLabel,
  type ManagerOrder,
} from "@/lib/manager/operations";
import { useManager } from "./manager-provider";
import {
  FilterSelect,
  ManagerEmpty,
  ManagerPanel,
  ManagerSearch,
  ManagerPager,
} from "./manager-ui";
import {
  ManagerOrderDrawer,
  OperationBadge,
  OperationTime,
} from "./order-drawer";
import { ManagerBookingDetail } from "./booking-list";

type Mode = "board" | "orders" | "quotes";
export function ManagerOperationsPage({ mode }: { mode: Mode }) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <OperationsContent mode={mode} />
    </Suspense>
  );
}
function OperationsContent({ mode }: { mode: Mode }) {
  const params = useSearchParams();
  const { data, now, today } = useManager();
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState(params.get("stage") || "");
  const [advisor, setAdvisor] = useState(params.get("advisor") || "");
  const [technician, setTechnician] = useState(params.get("technician") || "");
  const [from, setFrom] = useState(params.get("from") || "");
  const [to, setTo] = useState(params.get("to") || "");
  const [date, setDate] = useState(mode === "board" ? today : "");
  const [urgency, setUrgency] = useState(params.get("urgency") || "");
  const [quote, setQuote] = useState(params.get("quote") || "");
  const [selected, setSelected] = useState(params.get("selected") || "");
  const [booking, setBooking] = useState("");
  const [page, setPage] = useState(1);
  const [detailTab, setDetailTab] = useState(
    mode === "quotes" ? "quote" : "overview",
  );
  const orders = data.orders.filter((o) => {
    const c = data.customers.find((c) => c.id === o.customerId);
    return (
      (!stage || o.stage === stage) &&
      (!advisor || o.advisorId === advisor) &&
      (!technician || o.work.technician === technician) &&
      (!date || o.openedAt.startsWith(date)) &&
      (!from || o.openedAt.slice(0, 10) >= from) &&
      (!to || o.openedAt.slice(0, 10) <= to) &&
      (!quote ||
        (quote === "changed"
          ? o.quoteHistory.length > 0
          : o.quote.status === quote)) &&
      (!urgency ||
        (urgency === "overdue"
          ? o.stage !== "done" && o.work.dueAt && Date.parse(o.work.dueAt) < now
          : urgency === "unassigned"
            ? !o.advisorId || !o.work.technician
            : o.priority || !!o.holdReason)) &&
      `${o.id} ${o.quote.id} ${c?.name} ${c?.phone} ${c?.plate}`
        .toLocaleLowerCase("vi")
        .includes(query.toLocaleLowerCase("vi"))
    );
  });
  const waitingBookings = data.bookings.filter(
    (b) =>
      ["pending", "confirmed"].includes(b.status) &&
      (!date || b.date === date) &&
      (!advisor || b.advisorId === advisor) &&
      !technician &&
      !urgency &&
      !stage &&
      `${b.id} ${data.customers.find((c) => c.id === b.customerId)?.plate} ${data.customers.find((c) => c.id === b.customerId)?.name} ${data.customers.find((c) => c.id === b.customerId)?.phone}`
        .toLocaleLowerCase("vi")
        .includes(query.toLocaleLowerCase("vi")),
  );
  function open(
    o: ManagerOrder,
    tab = mode === "quotes" ? "quote" : "overview",
  ) {
    setDetailTab(tab);
    setSelected(o.id);
  }
  const filter = (setter: (s: string) => void) => (s: string) => {
    setter(s);
    setPage(1);
  };
  function card(o: ManagerOrder) {
    const c = data.customers.find((c) => c.id === o.customerId);
    return (
      <article className="mgr-vehicle-card" key={o.id}>
        <div className="mgr-section-toolbar">
          <strong>{c?.plate}</strong>
          <OperationBadge stage={o.stage} />
        </div>
        <button className="mgr-id-link" onClick={() => open(o)}>
          {o.id} · {c?.model}
        </button>
        <p>{c?.name}</p>
        <p>
          CVDV:{" "}
          {data.staff.find((s) => s.id === o.advisorId)?.name ||
            "Chưa phân công"}
        </p>
        <p>
          KTV:{" "}
          {data.staff.find((s) => s.id === o.work.technician)?.name ||
            "Chưa phân công"}
        </p>
        <progress max={100} value={o.work.progress} />
        <small>
          Tiến độ {o.work.progress}% · {paymentLabel(o)}
        </small>
        <p>
          Dự kiến: <OperationTime value={o.work.dueAt} />
        </p>
        {o.stage !== "done" &&
          o.work.dueAt &&
          Date.parse(o.work.dueAt) < now && (
            <span className="mgr-pill mgr-pill-danger">
              ⚠ Quá thời gian dự kiến
            </span>
          )}
        {o.holdReason && <p className="mgr-warning-text">⚠ {o.holdReason}</p>}
        <div className="mgr-row-actions">
          <button className="adm-btn" onClick={() => open(o)}>
            Chi tiết
          </button>
          <button className="adm-text-link" onClick={() => open(o, "work")}>
            Tiến độ
          </button>
        </div>
      </article>
    );
  }
  return (
    <>
      <PageHeading
        title={
          mode === "board"
            ? "Điều phối xe toàn trạm"
            : mode === "quotes"
              ? "Giám sát báo giá"
              : "Phiếu dịch vụ"
        }
        description="Theo dõi người phụ trách, tiến độ, thời gian dự kiến và thanh toán độc lập."
      />
      {(from || to) && (
        <p className="mgr-session-notice">
          Kỳ tiếp nhận: {from || "Từ đầu"} → {to || "Hiện tại"}
        </p>
      )}
      <ManagerPanel
        title={`${orders.length} ${mode === "quotes" ? "báo giá" : "phiếu dịch vụ"}`}
      >
        <div className="mgr-toolbar">
          <ManagerSearch
            value={query}
            onChange={filter(setQuery)}
            placeholder="Tìm mã phiếu, biển số, khách, SĐT…"
          />
          <FilterSelect
            label="Trạng thái xe"
            value={stage}
            onChange={filter(setStage)}
          >
            <option value="">Tất cả</option>
            {Object.entries(operationStages).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            label="CVDV"
            value={advisor}
            onChange={filter(setAdvisor)}
          >
            <option value="">Tất cả</option>
            {data.staff
              .filter((s) => s.role === "advisor")
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </FilterSelect>
          <FilterSelect
            label="KTV"
            value={technician}
            onChange={filter(setTechnician)}
          >
            <option value="">Tất cả</option>
            {data.staff
              .filter((s) => s.role === "technician")
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </FilterSelect>
          <label className="mgr-filter">
            Ngày tiếp nhận
            <input
              type="date"
              value={date}
              onChange={(e) => filter(setDate)(e.target.value)}
            />
          </label>
          <FilterSelect
            label="Ưu tiên"
            value={urgency}
            onChange={filter(setUrgency)}
          >
            <option value="">Tất cả</option>
            <option value="overdue">Quá deadline</option>
            <option value="priority">Ưu tiên / đình trệ</option>
            <option value="unassigned">Chưa đủ phân công</option>
          </FilterSelect>
          {mode === "quotes" && (
            <FilterSelect
              label="Trạng thái báo giá"
              value={quote}
              onChange={filter(setQuote)}
            >
              <option value="">Tất cả</option>
              {Object.entries(quoteStatuses).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
              <option value="changed">Có điều chỉnh</option>
            </FilterSelect>
          )}
          <button
            className="adm-btn"
            onClick={() => {
              setQuery("");
              setFrom("");
              setTo("");
              setStage("");
              setAdvisor("");
              setTechnician("");
              setDate("");
              setUrgency("");
              setQuote("");
              setPage(1);
            }}
          >
            Xóa lọc
          </button>
        </div>
        {mode === "board" ? (
          <>
            <div className="mgr-ops-board">
              <section className="mgr-board-column">
                <h3>
                  Đặt lịch <small>{waitingBookings.length}</small>
                </h3>
                {waitingBookings.slice(0, 8).map((b) => (
                  <article className="mgr-vehicle-card" key={b.id}>
                    <strong>
                      {data.customers.find((c) => c.id === b.customerId)?.plate}
                    </strong>
                    <p>
                      {b.time} · {b.date}
                    </p>
                    <button
                      className="adm-btn"
                      onClick={() => setBooking(b.id)}
                    >
                      {b.id}
                    </button>
                  </article>
                ))}
                <Link className="adm-text-link" href="/dieu-hanh/lich-hen">
                  Xem toàn bộ lịch hẹn
                </Link>
              </section>
              {Object.entries(operationStages).map(([s, label]) => (
                <section className="mgr-board-column" key={s}>
                  <h3>
                    {label}{" "}
                    <small>{orders.filter((o) => o.stage === s).length}</small>
                  </h3>
                  {orders.filter((o) => o.stage === s).map(card)}
                  {!orders.some((o) => o.stage === s) && (
                    <p className="adm-muted">Không có xe</p>
                  )}
                </section>
              ))}
            </div>
            <div className="mgr-ops-mobile">
              <Link className="adm-btn" href="/dieu-hanh/lich-hen">
                Xem lịch hẹn
              </Link>
              {orders.map(card)}
            </div>
          </>
        ) : (
          <>
            <div className="mgr-table-scroll">
              <table className="mgr-table mgr-record-table">
                <thead>
                  <tr>
                    <th>Phiếu / xe</th>
                    <th>Khách hàng</th>
                    <th>Phụ trách</th>
                    <th>{mode === "quotes" ? "Báo giá" : "Vận hành"}</th>
                    <th>Giá trị / thanh toán</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice((page - 1) * 8, page * 8).map((o) => {
                    const c = data.customers.find((c) => c.id === o.customerId);
                    return (
                      <tr key={o.id}>
                        <td data-label="Phiếu / xe">
                          <button
                            className="mgr-id-link"
                            onClick={() => open(o)}
                          >
                            {o.id}
                          </button>
                          <strong>{c?.plate}</strong>
                          <small>
                            Tiếp nhận <OperationTime value={o.openedAt} />
                          </small>
                        </td>
                        <td data-label="Khách hàng">
                          {c?.name}
                          <small>{c?.phone}</small>
                        </td>
                        <td data-label="Phụ trách">
                          {data.staff.find((s) => s.id === o.advisorId)?.name ||
                            "Chưa có CVDV"}
                          <small>
                            KTV:{" "}
                            {data.staff.find((s) => s.id === o.work.technician)
                              ?.name || "Chưa có"}
                          </small>
                        </td>
                        <td
                          data-label={
                            mode === "quotes" ? "Báo giá" : "Vận hành"
                          }
                        >
                          {mode === "quotes" ? (
                            <>
                              <span
                                className={`mgr-pill ${o.quote.status === "confirmed" ? "mgr-pill-success" : "mgr-pill-warning"}`}
                              >
                                {quoteStatuses[o.quote.status]}
                              </span>
                              <small>
                                {o.quote.id} · {o.quoteHistory.length} điều
                                chỉnh
                              </small>
                            </>
                          ) : (
                            <>
                              <OperationBadge stage={o.stage} />
                              <small>
                                {o.work.progress}% · Dự kiến{" "}
                                <OperationTime value={o.work.dueAt} />
                              </small>
                            </>
                          )}
                        </td>
                        <td data-label="Giá trị / thanh toán">
                          <strong>{formatMoney(orderAmounts(o).total)}</strong>
                          <small>{paymentLabel(o)}</small>
                        </td>
                        <td>
                          <button className="adm-btn" onClick={() => open(o)}>
                            Xem chi tiết
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ManagerPager
              page={page}
              size={8}
              total={orders.length}
              onChange={setPage}
            />
          </>
        )}
        {!orders.length && (
          <ManagerEmpty message="Không có phiếu phù hợp bộ lọc" />
        )}
      </ManagerPanel>
      {selected && (
        <ManagerOrderDrawer
          key={`${selected}-${detailTab}`}
          id={selected}
          initialTab={detailTab}
          onClose={() => setSelected("")}
        />
      )}{" "}
      {booking && (
        <ManagerBookingDetail id={booking} onClose={() => setBooking("")} />
      )}
    </>
  );
}
