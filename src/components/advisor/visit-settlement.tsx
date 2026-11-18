"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { collection } from "@/lib/api/client";
import type {
  Part,
  Warehouse,
  StockRequirement,
} from "@/lib/api/stock-finance";
import { paymentLabels } from "@/lib/api/stock-finance";
import {
  vnd,
  formatQuantity,
  type Workflow,
  type RunWorkflow,
} from "@/lib/api/workflow";
import { useSession } from "@/components/admin/auth-gate";

export function VisitSettlement({
  data,
  run,
  busy,
  onDirty,
}: {
  data: Workflow;
  run: RunWorkflow;
  busy: boolean;
  onDirty: (v: boolean) => void;
}) {
  const session = useSession()!,
    [parts, setParts] = useState<Part[]>([]),
    [warehouses, setWarehouses] = useState<Warehouse[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    if (!session.permissions.includes("inventory.manage")) return;
    const a = new AbortController();
    Promise.all([
      collection<Part>("admin/stock/parts", a.signal),
      collection<Warehouse>("admin/stock/warehouses", a.signal),
    ])
      .then(([p, w]) => {
        setParts(p);
        setWarehouses(w);
      })
      .catch((e) => {
        if (!a.signal.aborted) setError(e.message);
      });
    return () => a.abort();
  }, [session]);
  const s = data.settlement;
  return (
    <div className="adv-stack">
      <section className="adm-panel">
        <div className="adm-section-line">
          <h2>Thu tiền và công nợ</h2>
          <span
            className={`adm-badge adm-status-${s.paymentStatus === "SETTLED" ? "completed" : s.paymentStatus === "PARTIAL" ? "confirmed" : "pending"}`}
          >
            {paymentLabels[s.paymentStatus]}
          </span>
        </div>
        <dl className="adm-info-grid">
          <div>
            <dt>Phải thu sau điều chỉnh</dt>
            <dd>{s.assessed ? vnd(s.total!) : "Chưa xác định"}</dd>
          </div>
          <div>
            <dt>Đã thu ròng / phân bổ</dt>
            <dd>{vnd(s.netReceived)}</dd>
          </div>
          <div>
            <dt>Còn phải thu</dt>
            <dd>
              {s.outstanding !== null ? vnd(s.outstanding) : "Chưa xác định"}
            </dd>
          </div>
          <div>
            <dt>Thu dư</dt>
            <dd>{s.credit !== null ? vnd(s.credit) : "Chưa xác định"}</dd>
          </div>
        </dl>
        {session.roles.includes("MANAGER") && (
          <Link
            className="adm-btn"
            href={`/dieu-hanh/tai-chinh?visitId=${data.visitId}`}
          >
            Mở sổ tiền của phiếu
          </Link>
        )}
      </section>
      <section className="adm-panel">
        <h2>Phụ tùng theo báo giá đã duyệt</h2>
        {error && (
          <p className="adm-error-text" role="alert">
            {error}
          </p>
        )}
        {data.stock.lines.length ? (
          data.stock.lines.map((l) => (
            <StockRequest
              key={l.quoteLineId}
              line={l}
              data={data}
              parts={parts}
              warehouses={warehouses}
              run={run}
              busy={busy}
              onDirty={onDirty}
            />
          ))
        ) : (
          <p>Phiếu không có phụ tùng phải xuất.</p>
        )}
      </section>
      {!!data.financialCredits?.length && (
        <section className="adm-panel">
          <h2>Điều chỉnh giảm nghĩa vụ</h2>
          {data.financialCredits.map((c) => (
            <article className="adm-booking-card" key={c.id}>
              <strong>{vnd(c.amount)}</strong>
              <p>{c.reason}</p>
              <p>{c.evidence}</p>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
function StockRequest({
  line: l,
  data,
  parts,
  warehouses,
  run,
  busy,
  onDirty,
}: {
  line: StockRequirement;
  data: Workflow;
  parts: Part[];
  warehouses: Warehouse[];
  run: RunWorkflow;
  busy: boolean;
  onDirty: (v: boolean) => void;
}) {
  const session = useSession()!,
    [part, setPart] = useState(""),
    [warehouse, setWarehouse] = useState(""),
    [qty, setQty] = useState(""),
    [action, setAction] = useState("RESERVE");
  const allowed =
      session.permissions.includes("inventory.manage") &&
      !!data.allowedActions.length,
    r = l.request;
  return (
    <article className="adm-booking-card">
      <h3>{l.name}</h3>
      <p>
        Yêu cầu {formatQuantity(l.quantity)} {l.unit}
      </p>
      {r ? (
        <>
          <p>
            {r.code} · {r.warehouseName}
          </p>
          <dl className="adm-info-grid">
            <div>
              <dt>Đang giữ</dt>
              <dd>{formatQuantity(r.reserved)}</dd>
            </div>
            <div>
              <dt>Đã xuất ròng</dt>
              <dd>{formatQuantity(r.issued)}</dd>
            </div>
            <div>
              <dt>Chưa xuất</dt>
              <dd>{formatQuantity(r.outstanding)}</dd>
            </div>
          </dl>
          {allowed && (
            <form
              className="adm-booking-form"
              onSubmit={(e) => {
                e.preventDefault();
                void run(`admin/stock/requests/${r.id}/reservation`, {
                  expectedVersion: r.version,
                  action,
                  quantity: qty,
                  reason:
                    action === "RESERVE"
                      ? "Giữ phụ tùng cho phiếu"
                      : "Trả giữ phụ tùng",
                });
              }}
            >
              <div className="adm-form-grid">
                <label className="adm-field">
                  Thao tác
                  <select
                    value={action}
                    onChange={(e) => {
                      setAction(e.target.value);
                      onDirty(true);
                    }}
                  >
                    <option value="RESERVE">Giữ hàng</option>
                    <option value="RELEASE">Trả giữ hàng</option>
                  </select>
                </label>
                <label className="adm-field">
                  Số lượng *
                  <input
                    required
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={qty}
                    onChange={(e) => {
                      setQty(e.target.value);
                      onDirty(true);
                    }}
                  />
                </label>
              </div>
              <div className="adm-action-row">
                <button className="adm-btn" disabled={busy}>
                  Xác nhận
                </button>
                <Link
                  className="adm-btn"
                  href={`/dieu-hanh/kho?requestId=${r.id}&partId=${r.partId}&warehouseId=${r.warehouseId}&quantity=${r.outstanding}`}
                >
                  Lập phiếu xuất kho
                </Link>
              </div>
            </form>
          )}
        </>
      ) : allowed ? (
        <form
          className="adm-booking-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run(`admin/service-visits/${data.visitId}/stock-requests`, {
              quoteLineId: l.quoteLineId,
              partId: part,
              warehouseId: warehouse,
              reason: "Đối chiếu phụ tùng và đơn vị theo báo giá",
            });
          }}
        >
          <div className="adm-form-grid">
            <label className="adm-field">
              Phụ tùng kho *
              <select
                required
                value={part}
                onChange={(e) => {
                  setPart(e.target.value);
                  onDirty(true);
                }}
              >
                <option value="">Chọn mã phụ tùng</option>
                {parts
                  .filter((p) => p.active)
                  .map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.code} · {p.name} ({p.unit})
                    </option>
                  ))}
              </select>
            </label>
            <label className="adm-field">
              Kho cấp phát *
              <select
                required
                value={warehouse}
                onChange={(e) => {
                  setWarehouse(e.target.value);
                  onDirty(true);
                }}
              >
                <option value="">Chọn kho</option>
                {warehouses
                  .filter((w) => w.active)
                  .map((w) => (
                    <option value={w.id} key={w.id}>
                      {w.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <button className="adm-btn" disabled={busy}>
            Tạo yêu cầu phụ tùng
          </button>
        </form>
      ) : (
        <p className="adm-muted">Chờ kho đối chiếu mã phụ tùng và đơn vị.</p>
      )}
    </article>
  );
}
