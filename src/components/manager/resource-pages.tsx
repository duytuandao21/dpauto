"use client";
import { useState } from "react";
import { PageHeading } from "@/components/admin/primitives";
import { formatMoney } from "@/lib/advisor/seed";
import { orderAmounts, paymentLabel } from "@/lib/manager/operations";
import { useManager } from "./manager-provider";
import {
  FilterSelect,
  ManagerEmpty,
  ManagerPanel,
  ManagerSearch,
} from "./manager-ui";
import { ManagerOrderDrawer, OperationTime } from "./order-drawer";

export function ManagerFinancePage() {
  const { data } = useManager();
  const [query, setQuery] = useState("");
  const [advisor, setAdvisor] = useState("");
  const [debtOnly, setDebtOnly] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState("");
  const orders = data.orders.filter((o) => {
    const c = data.customers.find((c) => c.id === o.customerId);
    return (
      o.quote.status === "confirmed" &&
      (!advisor || o.advisorId === advisor) &&
      (!debtOnly || (orderAmounts(o).debt || 0) > 0) &&
      (!from || o.openedAt.slice(0, 10) >= from) &&
      (!to || o.openedAt.slice(0, 10) <= to) &&
      `${o.id} ${c?.name} ${c?.plate}`
        .toLowerCase()
        .includes(query.toLowerCase())
    );
  });
  const sum = (key: "total" | "received" | "debt") =>
    orders.reduce((n, o) => n + (orderAmounts(o)[key] || 0), 0);
  const lines = orders.flatMap((o) =>
    o.quote.lines.map((l) => ({
      ...l,
      discount:
        100 - (1 - l.discount / 100) * (1 - o.quote.discount / 100) * 100,
    })),
  );
  const value = (kind: string) =>
    lines
      .filter((l) => l.kind === kind)
      .reduce(
        (n, l) =>
          n + l.price * l.quantity * (1 - l.discount / 100) * (1 + l.vat / 100),
        0,
      );
  return (
    <>
      <PageHeading
        title="Tài chính & công nợ"
        description="Giá trị báo giá đã xác nhận, tiền cọc, khoản đã thu và số còn phải thu. Không thay thế sổ kế toán."
      />
      <ManagerPanel title="Bộ lọc tài chính">
        <div className="mgr-toolbar">
          <ManagerSearch
            value={query}
            onChange={setQuery}
            placeholder="Tìm phiếu, biển số, khách…"
          />
          <FilterSelect label="CVDV" value={advisor} onChange={setAdvisor}>
            <option value="">Tất cả</option>
            {data.staff
              .filter((s) => s.role === "advisor")
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </FilterSelect>
          <label className="mgr-filter">
            Tiếp nhận từ
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="mgr-filter">
            Đến
            <input
              type="date"
              min={from}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <label className="adm-toggle-row">
            <input
              type="checkbox"
              checked={debtOnly}
              onChange={(e) => setDebtOnly(e.target.checked)}
            />{" "}
            Chỉ phiếu chưa thu đủ
          </label>
        </div>
        {from && to && from > to && (
          <p role="alert" className="adm-error-text">
            Ngày kết thúc phải từ ngày bắt đầu trở đi.
          </p>
        )}
      </ManagerPanel>
      <div className="mgr-finance-metrics">
        {[
          ["Giá trị đã chốt", sum("total")],
          ["Tiền cọc", orders.reduce((n, o) => n + o.finance.deposit, 0)],
          ["Đã thu thêm", orders.reduce((n, o) => n + o.finance.collected, 0)],
          ["Còn phải thu", sum("debt")],
        ].map(([label, v]) => (
          <article className="adm-panel mgr-panel" key={label}>
            <span className="adm-muted">{label}</span>
            <strong>{formatMoney(Number(v))}</strong>
          </article>
        ))}
      </div>
      <ManagerPanel title="Phiếu đã xác nhận báo giá">
        <div className="mgr-table-scroll">
          <table className="mgr-table mgr-record-table">
            <thead>
              <tr>
                <th>Phiếu / khách / xe</th>
                <th>Giá trị đã chốt</th>
                <th>Cọc / thu thêm</th>
                <th>Còn phải thu</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const c = data.customers.find((c) => c.id === o.customerId),
                  a = orderAmounts(o);
                return (
                  <tr key={o.id}>
                    <td data-label="Phiếu / khách / xe">
                      <strong>{o.id}</strong>
                      {c?.name}
                      <small>{c?.plate}</small>
                    </td>
                    <td data-label="Giá trị đã chốt">{formatMoney(a.total)}</td>
                    <td data-label="Cọc / thu thêm">
                      {formatMoney(o.finance.deposit)}
                      <small>{formatMoney(o.finance.collected)}</small>
                    </td>
                    <td data-label="Còn phải thu">
                      <strong>{formatMoney(a.debt || 0)}</strong>
                      <span
                        className={`mgr-pill ${(a.debt || 0) > 0 ? "mgr-pill-warning" : "mgr-pill-success"}`}
                      >
                        {paymentLabel(o)}
                      </span>
                    </td>
                    <td>
                      <button
                        className="adm-btn"
                        onClick={() => setSelected(o.id)}
                      >
                        Xem phiếu
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!orders.length && <ManagerEmpty />}
      </ManagerPanel>
      <div className="mgr-settings-grid">
        <ManagerPanel title="Cơ cấu giá trị báo giá">
          <div className="mgr-summary-row">
            <span>Dịch vụ, sau CK và VAT</span>
            <strong>{formatMoney(value("service"))}</strong>
          </div>
          <div className="mgr-summary-row">
            <span>Phụ tùng, sau CK và VAT</span>
            <strong>{formatMoney(value("part"))}</strong>
          </div>
        </ManagerPanel>
        <ManagerPanel title="Theo cố vấn dịch vụ">
          {data.staff
            .filter((s) => s.role === "advisor")
            .map((s) => (
              <div key={s.id} className="mgr-summary-row">
                <span>{s.name}</span>
                <strong>
                  {formatMoney(
                    orders
                      .filter((o) => o.advisorId === s.id)
                      .reduce((n, o) => n + orderAmounts(o).total, 0),
                  )}
                </strong>
              </div>
            ))}
        </ManagerPanel>
      </div>
      {selected && (
        <ManagerOrderDrawer id={selected} onClose={() => setSelected("")} />
      )}
    </>
  );
}

export function ManagerInventoryPage() {
  const { data } = useManager();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("parts");
  const [low, setLow] = useState(false);
  const [selected, setSelected] = useState("");
  const parts = data.parts.filter(
    (p) =>
      (!low || p.stock < p.minimum) &&
      `${p.id} ${p.name} ${p.supplier}`
        .toLocaleLowerCase("vi")
        .includes(query.toLocaleLowerCase("vi")),
  );
  return (
    <>
      <PageHeading
        title="Kho & phụ tùng"
        description="Giám sát tồn, định mức và vật tư theo phiếu dịch vụ."
      />
      <ManagerPanel title="Nguồn lực vật tư">
        <div className="mgr-tabs">
          {Object.entries({
            parts: "Tồn kho",
            movements: "Phiếu nhập / xuất",
            requests: "Nhu cầu theo phiếu",
          }).map(([v, l]) => (
            <button key={v} aria-pressed={tab === v} onClick={() => setTab(v)}>
              {l}
            </button>
          ))}
        </div>
        <div className="mgr-toolbar">
          <ManagerSearch
            value={query}
            onChange={setQuery}
            placeholder="Tìm mã, phụ tùng, nhà cung cấp…"
          />
          {tab === "parts" && (
            <label className="adm-toggle-row">
              <input
                type="checkbox"
                checked={low}
                onChange={(e) => setLow(e.target.checked)}
              />{" "}
              Dưới định mức
            </label>
          )}
        </div>
        {tab === "parts" && (
          <>
            <div className="mgr-table-scroll">
              <table className="mgr-table mgr-record-table">
                <thead>
                  <tr>
                    <th>Phụ tùng</th>
                    <th>Tồn / tối thiểu</th>
                    <th>Nhà cung cấp</th>
                    <th>Tình trạng</th>
                  </tr>
                </thead>
                <tbody>
                  {parts.map((p) => (
                    <tr key={p.id}>
                      <td data-label="Phụ tùng">
                        <strong>{p.name}</strong>
                        <small>{p.id}</small>
                      </td>
                      <td data-label="Tồn / tối thiểu">
                        {p.stock} / {p.minimum} {p.unit}
                      </td>
                      <td data-label="Nhà cung cấp">{p.supplier}</td>
                      <td data-label="Tình trạng">
                        <span
                          className={`mgr-pill ${p.stock < p.minimum ? "mgr-pill-warning" : "mgr-pill-success"}`}
                        >
                          {p.stock < p.minimum ? "⚠ Dưới định mức" : "Đủ tồn"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!parts.length && <ManagerEmpty />}
          </>
        )}
        {tab === "movements" && (
          <div className="mgr-line-list">
            {data.movements
              .filter((m) => parts.some((p) => p.id === m.partId))
              .map((m) => (
                <article key={m.id}>
                  <strong>
                    {m.id} · {m.kind === "in" ? "Nhập kho" : "Xuất kho"}
                  </strong>
                  <p>
                    {data.parts.find((p) => p.id === m.partId)?.name} ·{" "}
                    {m.quantity}{" "}
                    {data.parts.find((p) => p.id === m.partId)?.unit} ·{" "}
                    {m.warehouse}
                  </p>
                  <p>
                    <OperationTime value={m.at} />
                  </p>
                  {m.orderId && (
                    <button
                      className="adm-text-link"
                      onClick={() => setSelected(m.orderId)}
                    >
                      {m.orderId} ↗
                    </button>
                  )}
                </article>
              ))}
            {!data.movements.some((m) =>
              parts.some((p) => p.id === m.partId),
            ) && <ManagerEmpty />}
          </div>
        )}
        {tab === "requests" && (
          <div className="mgr-line-list">
            {data.orders.flatMap((o) =>
              o.quote.lines
                .filter(
                  (l) =>
                    l.kind === "part" && parts.some((p) => p.id === l.code),
                )
                .map((l) => {
                  const issued = data.movements
                    .filter(
                      (m) =>
                        m.orderId === o.id &&
                        m.partId === l.code &&
                        m.kind === "out",
                    )
                    .reduce((n, m) => n + m.quantity, 0);
                  return (
                    <article key={`${o.id}-${l.id}`}>
                      <button
                        className="mgr-id-link"
                        onClick={() => setSelected(o.id)}
                      >
                        {o.id} ↗
                      </button>
                      <strong>{l.name}</strong>
                      <p>
                        Cần {l.quantity} · Đã xuất {issued} · Còn cần{" "}
                        {Math.max(0, l.quantity - issued)} {l.unit}
                      </p>
                      <p>
                        Tồn kho{" "}
                        {data.parts.find((p) => p.id === l.code)?.stock ??
                          "Chưa xác định"}
                      </p>
                    </article>
                  );
                }),
            )}
            {!data.orders.some((o) =>
              o.quote.lines.some(
                (l) => l.kind === "part" && parts.some((p) => p.id === l.code),
              ),
            ) && <ManagerEmpty message="Không có nhu cầu vật tư phù hợp" />}
          </div>
        )}
      </ManagerPanel>
      {selected && (
        <ManagerOrderDrawer
          id={selected}
          initialTab="quote"
          onClose={() => setSelected("")}
        />
      )}
    </>
  );
}
