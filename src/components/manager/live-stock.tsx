"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { collection, request, command, newRequestKey } from "@/lib/api/client";
import { useApiPage } from "@/lib/api/use-page";
import {
  stockKinds,
  stockDraftBody,
  type Part,
  type Warehouse,
  type StockBalance,
  type StockDocument,
  type StockLine,
} from "@/lib/api/stock-finance";
import { vnd, workflowTime } from "@/lib/api/workflow";
import { useSession } from "@/components/admin/auth-gate";
import { AdminLoading, PageHeading } from "@/components/admin/primitives";
import { ManagerTable, ManagerEmpty, ManagerDeleteButton } from "./manager-ui";
import { AdminIcon } from "@/components/admin/admin-icon";

export function LiveInventory() {
  return (
    <Suspense fallback={<AdminLoading />}>
      <InventoryContent />
    </Suspense>
  );
}
function InventoryContent() {
  const params = useSearchParams(),
    session = useSession()!,
    [parts, setParts] = useState<Part[]>([]),
    [warehouses, setWarehouses] = useState<Warehouse[]>([]),
    [tab, setTab] = useState(params.has("requestId") ? "soan" : "ton"),
    [reload, setReload] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<StockDocument | null>(null),
    [query, setQuery] = useState(""),
    [warehouse, setWarehouse] = useState("");
  const [initial, setInitial] = useState({
    warehouseId: params.get("warehouseId") || "",
    kind:
      params.has("requestId") ||
      !session.permissions.includes("inventory.cost.read")
        ? "ISSUE"
        : "RECEIPT",
    lines: [
      {
        partId: params.get("partId") || "",
        quantity: params.get("quantity") || "1",
        requestId: params.get("requestId") || undefined,
      },
    ] as StockLine[],
  });
  useEffect(() => {
    const a = new AbortController();
    Promise.all([
      collection<Part>("admin/stock/parts", a.signal),
      collection<Warehouse>("admin/stock/warehouses", a.signal),
    ])
      .then(([p, w]) => {
        if (!a.signal.aborted) {
          setParts(p);
          setWarehouses(w);
        }
      })
      .catch((e) => {
        if (!a.signal.aborted) setError(e.message);
      });
    return () => a.abort();
  }, [reload]);
  useEffect(() => {
    const refresh = () => setReload((n) => n + 1);
    window.addEventListener("dpauto-data-updated", refresh);
    return () => window.removeEventListener("dpauto-data-updated", refresh);
  }, []);
  async function run(path: string, body: unknown, method = "POST") {
    if (busy) return null;
    setBusy(true);
    setError("");
    try {
      const r = await command<{ id: string }>(path, body, method);
      setReload((n) => n + 1);
      window.dispatchEvent(new Event("dpauto-data-updated"));
      return r.data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể lưu.");
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function open(id: string) {
    try {
      const d = (await request<StockDocument>("admin/stock/documents/" + id))
        .data;
      setSelected(d);
      setTab("chung-tu");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được chứng từ.");
    }
  }
  const manage = session.permissions.includes("inventory.manage"),
    cost = session.permissions.includes("inventory.cost.read");
  return (
    <div className="adv-stack">
      <PageHeading
        title="Kho phụ tùng"
        description="Tồn thực tế, giữ hàng và chứng từ nhập/xuất."
      />
      <nav className="mgr-tabs" aria-label="Quản lý kho">
        {[
          ["ton", "Tồn kho"],
          ["chung-tu", "Chứng từ"],
          ["bien-dong", "Sổ kho"],
          ["doi-soat", "Đối soát"],
          ["danh-muc", "Danh mục"],
          ...(manage ? [["soan", "Lập chứng từ"]] : []),
        ].map(([v, l]) => (
          <button
            aria-pressed={tab === v}
            key={v}
            onClick={() => {
              if (tab !== "soan" || window.confirm("Rời chứng từ đang soạn?"))
                setTab(v);
            }}
          >
            {l}
          </button>
        ))}
      </nav>
      {error && (
        <p role="alert" className="adm-error-text">
          {error}
        </p>
      )}
      {["ton", "chung-tu", "bien-dong"].includes(tab) && (
        <section className="adm-panel">
          <div className="adm-form-grid">
            <label className="adm-field">
              Kho
              <select
                value={warehouse}
                onChange={(e) => setWarehouse(e.target.value)}
              >
                <option value="">Tất cả kho</option>
                {warehouses.filter((w) => !w.deletedAt).map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
            {tab === "ton" && (
              <label className="adm-field">
                Phụ tùng
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tên hoặc mã phụ tùng"
                />
              </label>
            )}
          </div>
          {tab === "ton" ? (
            <BalanceList
              path={`admin/stock/balances?${new URLSearchParams({ ...(warehouse ? { warehouseId: warehouse } : {}), ...(query ? { q: query } : {}) })}`}
              reload={reload}
            />
          ) : tab === "chung-tu" ? (
            <DocumentList
              warehouse={warehouse}
              reload={reload}
              open={open}
              manage={manage}
            />
          ) : (
            <LedgerList warehouse={warehouse} reload={reload} />
          )}
        </section>
      )}
      {tab === "doi-soat" && <StockReconciliation reload={reload} />}
      {tab === "danh-muc" && (
        <StockCatalog
          parts={parts}
          warehouses={warehouses}
          run={run}
          busy={busy}
          manage={manage}
        />
      )}
      {tab === "soan" && manage && (
        <StockEditor
          key={JSON.stringify(initial)}
          initial={initial}
          parts={parts}
          warehouses={warehouses}
          busy={busy}
          cost={cost}
          adjust={session.permissions.includes("inventory.adjust")}
          run={run}
          onSaved={(id) => void open(id)}
        />
      )}
      {tab === "chung-tu" && selected && (
        <>
          <section className="adm-panel">
            <h2>
              {stockKinds[selected.kind as keyof typeof stockKinds]} ·{" "}
              {selected.status === "POSTED" ? "Đã ghi sổ" : "Bản nháp"}
            </h2>
            <p>{selected.id}</p>
            {selected.status === "POSTED" ? (
              <>
                <p>
                  {selected.reason} ·{" "}
                  {selected.postedAt ? workflowTime(selected.postedAt) : ""}
                </p>
                {selected.lines.map((l) => (
                  <article className="adm-booking-card" key={l.id}>
                    <strong>{l.part?.name}</strong>
                    <p>
                      {l.quantity} {l.part?.unit}
                    </p>
                    {cost &&
                      l.valueDelta !== undefined &&
                      l.valueDelta !== null && (
                        <p>Giá trị biến động {vnd(l.valueDelta)}</p>
                      )}
                    {manage && selected.kind === "ISSUE" && (
                      <button
                        className="adm-btn"
                        onClick={() => {
                          setInitial({
                            warehouseId: selected.warehouseId,
                            kind: "RETURN",
                            lines: [
                              {
                                partId: l.partId,
                                quantity: l.quantity,
                                originalLineId: l.id,
                                returnCondition: "RESTOCK",
                              },
                            ],
                          });
                          setTab("soan");
                        }}
                      >
                        Lập chứng từ trả hàng
                      </button>
                    )}
                  </article>
                ))}
              </>
            ) : manage ? (
              <StockEditor
                key={selected.id + ":" + selected.version}
                document={selected}
                parts={parts}
                warehouses={warehouses}
                busy={busy}
                cost={cost}
                adjust={session.permissions.includes("inventory.adjust")}
                run={run}
                onSaved={(id) => void open(id)}
              />
            ) : (
              <p>{selected.reason}</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
type Run = (
  path: string,
  body: unknown,
  method?: string,
) => Promise<{ id: string } | null>;
function StockEditor({
  document: d,
  initial,
  parts,
  warehouses,
  busy,
  cost,
  adjust,
  run,
  onSaved,
}: {
  document?: StockDocument;
  initial?: { warehouseId: string; kind: string; lines: StockLine[] };
  parts: Part[];
  warehouses: Warehouse[];
  busy: boolean;
  cost: boolean;
  adjust: boolean;
  run: Run;
  onSaved: (id: string) => void;
}) {
  const [commandId] = useState(newRequestKey),
    [kind, setKind] = useState(
      d?.kind || initial?.kind || (cost ? "RECEIPT" : "ISSUE"),
    ),
    [warehouse, setWarehouse] = useState(
      d?.warehouseId || initial?.warehouseId || "",
    ),
    [lines, setLines] = useState<StockLine[]>(
      d?.lines || initial?.lines || [{ partId: "", quantity: "1" }],
    ),
    [reason, setReason] = useState(d?.reason || ""),
    [counterparty, setCounterparty] = useState(d?.counterparty || ""),
    [dirty, setDirty] = useState(false),
    [lookupError, setLookupError] = useState("");
  useEffect(() => {
    if (!dirty) return;
    const f = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, [dirty]);
  function edit(i: number, l: Partial<StockLine>) {
    setLines((v) => v.map((old, n) => (i === n ? { ...old, ...l } : old)));
    setDirty(true);
  }
  return (
    <form
      className="adm-booking-form"
      onChange={() => setDirty(true)}
      onSubmit={async (e) => {
        e.preventDefault();
        const body = stockDraftBody({
          warehouseId: warehouse,
          kind,
          reason,
          counterparty,
          lines,
        });
        const r = await run(
          d ? "admin/stock/documents/" + d.id : "admin/stock/documents",
          d ? { ...body, expectedVersion: d.version } : { ...body, commandId },
          d ? "PATCH" : "POST",
        );
        if (r) {
          setDirty(false);
          onSaved(r.id);
        }
      }}
    >
      <fieldset disabled={busy} className="adv-stack adv-checks">
        <legend>{d ? "Chỉnh chứng từ chưa ghi sổ" : "Chứng từ mới"}</legend>
        <div className="adm-form-grid">
          <label className="adm-field">
            Loại chứng từ
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setLines([{ partId: "", quantity: "1" }]);
              }}
            >
              {Object.entries(stockKinds)
                .filter(
                  ([k]) =>
                    ["ISSUE", "RETURN"].includes(k) ||
                    (cost && (k === "RECEIPT" || adjust)),
                )
                .map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
            </select>
          </label>
          <label className="adm-field">
            Kho *
            <select
              required
              value={warehouse}
              onChange={(e) => {
                setWarehouse(e.target.value);
                setLines(
                  lines.map((l) => ({
                    ...l,
                    expectedBalanceVersion: undefined,
                  })),
                );
              }}
            >
              <option value="">Chọn kho</option>
              {warehouses
                .filter((w) => w.active)
                .map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="adm-field">
            Đối tác / nguồn nhập
            <input
              maxLength={200}
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
            />
          </label>
        </div>
        {lines.map((l, i) => (
          <article className="adv-line" key={i}>
            <div className="adm-form-grid">
              <label className="adm-field">
                Phụ tùng *
                <select
                  required
                  value={l.partId}
                  onChange={(e) =>
                    edit(i, {
                      partId: e.target.value,
                      expectedBalanceVersion: undefined,
                    })
                  }
                >
                  <option value="">Chọn mã phụ tùng</option>
                  {parts
                    .filter((p) => p.active)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code} · {p.name} ({p.unit})
                      </option>
                    ))}
                </select>
              </label>
              <label className="adm-field">
                {kind === "STOCKTAKE" ? "Số đếm thực tế *" : "Số lượng *"}
                <input
                  required
                  type="number"
                  step="0.001"
                  min={
                    kind === "ADJUSTMENT"
                      ? undefined
                      : kind === "STOCKTAKE"
                        ? "0"
                        : "0.001"
                  }
                  value={l.quantity}
                  onChange={(e) => edit(i, { quantity: e.target.value })}
                />
              </label>
              {["RECEIPT", "ADJUSTMENT", "STOCKTAKE"].includes(kind) &&
                cost && (
                  <label className="adm-field">
                    Giá vốn đơn vị (VND)
                    <input
                      required={
                        kind === "RECEIPT" ||
                        kind === "STOCKTAKE" ||
                        !l.quantity.startsWith("-")
                      }
                      inputMode="numeric"
                      pattern="[0-9]{1,15}"
                      value={l.unitCost || ""}
                      onChange={(e) =>
                        edit(i, { unitCost: e.target.value || undefined })
                      }
                    />
                  </label>
                )}
              {kind === "ISSUE" && (
                <label className="adm-field">
                  Yêu cầu từ phiếu dịch vụ *
                  <input required readOnly value={l.requestId || ""} />
                  {!l.requestId && (
                    <small>
                      Mở phiếu dịch vụ → Phụ tùng & thu tiền → Lập phiếu xuất
                      kho.
                    </small>
                  )}
                </label>
              )}
              {kind === "RETURN" && (
                <>
                  <label className="adm-field">
                    Dòng xuất gốc *
                    <input required readOnly value={l.originalLineId || ""} />
                  </label>
                  <label className="adm-field">
                    Tình trạng trả
                    <select
                      value={l.returnCondition || "RESTOCK"}
                      onChange={(e) =>
                        edit(i, { returnCondition: e.target.value })
                      }
                    >
                      <option value="RESTOCK">Nhập lại kho</option>
                      <option value="SCRAP">Hỏng, không nhập lại tồn</option>
                    </select>
                  </label>
                </>
              )}
              {kind === "STOCKTAKE" && (
                <label className="adm-field">
                  Đối chiếu tồn trước đếm
                  <button
                    type="button"
                    className="adm-btn"
                    disabled={!warehouse || !l.partId}
                    onClick={async () => {
                      try {
                        const r = await request<StockBalance[]>(
                          `admin/stock/balances?warehouseId=${warehouse}&partId=${l.partId}`,
                        );
                        edit(i, {
                          expectedBalanceVersion: r.data[0]?.version || 1,
                        });
                        setLookupError("");
                      } catch (e) {
                        setLookupError(
                          e instanceof Error
                            ? e.message
                            : "Không thể đối chiếu tồn kho.",
                        );
                      }
                    }}
                  >
                    Chốt mốc tồn
                  </button>
                  <span>
                    {l.expectedBalanceVersion
                      ? "Đã ghi mốc kiểm kê"
                      : "Chưa ghi mốc kiểm kê"}
                  </span>
                </label>
              )}
            </div>
            <button
              type="button"
              className="adm-btn adm-subtle-danger"
              onClick={() => {
                setLines(lines.filter((_, n) => i !== n));
                setDirty(true);
              }}
            >
              Bỏ dòng
            </button>
          </article>
        ))}
        {!["ISSUE", "RETURN"].includes(kind) && (
          <button
            type="button"
            className="adm-btn"
            onClick={() => {
              setLines([...lines, { partId: "", quantity: "1" }]);
              setDirty(true);
            }}
          >
            Thêm dòng
          </button>
        )}
        <label className="adm-field">
          Lý do / căn cứ *
          <textarea
            required
            maxLength={400}
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        {lookupError && (
          <p role="alert" className="adm-error-text">
            {lookupError}
          </p>
        )}
        <div className="adm-action-row">
          <button className="adm-btn adm-primary" disabled={!lines.length}>
            Lưu bản nháp
          </button>
          {d && (
            <button
              type="button"
              className="adm-btn adm-confirm"
              disabled={dirty}
              onClick={async () => {
                if (
                  window.confirm(
                    "Xác nhận số lượng thực tế và ghi sổ chứng từ?",
                  )
                ) {
                  const r = await run(`admin/stock/documents/${d.id}/post`, {
                    expectedVersion: d.version,
                    reason,
                  });
                  if (r) onSaved(d.id);
                }
              }}
            >
              Ghi sổ chứng từ
            </button>
          )}
        </div>
      </fieldset>
    </form>
  );
}
function BalanceList({ path, reload }: { path: string; reload: number }) {
  const page = useApiPage<StockBalance>(path, reload);
  return (
    <>
      {page.error && <p role="alert">{page.error}</p>}
      {page.loading ? (
        <AdminLoading />
      ) : (
        <div className="mgr-table-scroll">
          <ManagerTable className="mgr-table">
            <thead>
              <tr>
                <th>Phụ tùng</th>
                <th>Kho</th>
                <th>Tồn thực</th>
                <th>Đang giữ</th>
                <th>Có thể xuất</th>
                <th>Giá trị tồn</th>
              </tr>
            </thead>
            <tbody>
              {page.data.map((b) => (
                <tr key={b.warehouseId + b.partId}>
                  <td>
                    {b.code}
                    <br />
                    {b.name} · {b.unit}
                  </td>
                  <td>{b.warehouseName}</td>
                  <td>{b.onHand}</td>
                  <td>{b.reserved}</td>
                  <td>
                    <strong>{b.available}</strong>
                  </td>
                  <td>
                    {b.carryingValue !== undefined ? vnd(b.carryingValue) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </ManagerTable>
          {!page.data.length && <ManagerEmpty message="Chưa có tồn kho phù hợp" />}
        </div>
      )}
      <PageButtons manager page={page} />
    </>
  );
}
function DocumentList({
  warehouse,
  reload,
  open,
  manage,
}: {
  warehouse: string;
  reload: number;
  open: (id: string) => void;
  manage: boolean;
}) {
  const p = useApiPage<StockDocument>(
    "admin/stock/documents" + (warehouse ? "?warehouseId=" + warehouse : ""),
    reload,
  );
  return (
    <>
      {p.error && <p role="alert">{p.error}</p>}
      {p.loading ? (
        <AdminLoading />
      ) : (
        <div className="mgr-table-scroll">
          <ManagerTable className="mgr-table">
            <thead>
              <tr>
                <th>Loại chứng từ</th>
                <th>Kho</th>
                <th>Trạng thái</th>
                <th>Ngày lập</th>
                <th>Nội dung</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {p.data.map((d) => (
                <tr key={d.id}>
                  <td>{stockKinds[d.kind as keyof typeof stockKinds]}</td>
                  <td>{d.warehouseName}</td>
                  <td>
                    <span className={`mgr-pill mgr-pill-${d.status === "POSTED" ? "success" : "warning"}`}>
                      {d.status === "POSTED" ? "Đã ghi sổ" : "Bản nháp"}
                    </span>
                  </td>
                  <td>{workflowTime(d.createdAt)}</td>
                  <td>{d.reason}</td>
                  <td>
                    <div className="mgr-row-actions">
                      <button className="adm-btn" onClick={() => open(d.id)}>
                        Chi tiết
                      </button>
                      {manage && d.status === "DRAFT" && (
                        <ManagerDeleteButton
                          path={`admin/stock/documents/${d.id}`}
                          version={d.version}
                          message="Xóa phiếu kho nháp này? Phiếu chưa ghi sổ nên tồn kho không thay đổi."
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </ManagerTable>
          {!p.error && !p.data.length && (
            <ManagerEmpty message="Chưa có chứng từ phù hợp" />
          )}
        </div>
      )}
      <PageButtons manager page={p} />
    </>
  );
}
type Ledger = {
  id: string;
  name: string;
  kind: string;
  quantityDelta: string;
  valueDelta?: string;
  occurredAt: string;
  unit: string;
};
function LedgerList({
  warehouse,
  reload,
}: {
  warehouse: string;
  reload: number;
}) {
  const p = useApiPage<Ledger>(
    "admin/stock/ledger" + (warehouse ? "?warehouseId=" + warehouse : ""),
    reload,
  );
  return (
    <>
      {p.error && <p role="alert">{p.error}</p>}
      {p.loading ? (
        <AdminLoading />
      ) : (
        <ol className="adm-timeline">
          {p.data.map((l) => (
            <li key={l.id}>
              <i />
              <div>
                <strong>
                  {l.name} · {stockKinds[l.kind as keyof typeof stockKinds]}
                </strong>
                <p>
                  {l.quantityDelta} {l.unit}
                  {l.valueDelta !== undefined ? " · " + vnd(l.valueDelta) : ""}
                </p>
                <time>{workflowTime(l.occurredAt)}</time>
              </div>
            </li>
          ))}
        </ol>
      )}
      <PageButtons manager page={p} />
    </>
  );
}
export function PageButtons({
  page,
  manager = false,
}: {
  manager?: boolean;
  page: {
    loading: boolean;
    canPrevious: boolean;
    canNext: boolean;
    back: () => void;
    forward: () => void;
    data?: readonly unknown[];
    pageNumber?: number;
  };
}) {
  if (!page.canPrevious && !page.canNext) return null;
  const controls = (
    <>
      <button
        type="button"
        className="adm-btn"
        aria-label="Trang trước"
        disabled={page.loading || !page.canPrevious}
        onClick={page.back}
      >
        {!manager && <AdminIcon name="back" />}
        {manager ? "Trang trước" : "Trước"}
      </button>
      {!manager && (
        <span
          className="adv-pagination-current"
          aria-current="page"
          aria-live="polite"
        >
          Trang {page.pageNumber || 1}
        </span>
      )}
      <button
        type="button"
        className="adm-btn"
        aria-label="Trang sau"
        disabled={page.loading || !page.canNext}
        onClick={page.forward}
      >
        {manager ? "Trang sau" : "Tiếp"}
        {!manager && <AdminIcon name="back" />}
      </button>
    </>
  );
  return manager ? (
    <div className="mgr-pagination">
      <span>
        {page.data
          ? `${page.data.length} kết quả trên trang này`
          : "Phân trang"}
      </span>
      <div>{controls}</div>
    </div>
  ) : (
    <nav className="adv-pagination" aria-label="Phân trang danh sách">
      {controls}
    </nav>
  );
}
type Difference = {
  id: string;
  name: string;
  code: string;
  warehouseId: string;
  onHand: string;
  reserved: string;
  ledgerQuantity: string;
  ledgerReserved: string;
  carryingValue?: string;
  ledgerValue?: string;
};
function StockReconciliation({ reload }: { reload: number }) {
  const p = useApiPage<Difference>("admin/stock/reconciliation", reload);
  return (
    <section className="adm-panel">
      <h2>Đối soát tồn và sổ kho</h2>
      {p.error && <p role="alert">{p.error}</p>}
      {p.loading ? (
        <AdminLoading />
      ) : p.data.length ? (
        p.data.map((d) => (
          <article className="adm-booking-card" key={d.id}>
            <strong>
              {d.code} · {d.name}
            </strong>
            <p>
              Tồn thực {d.onHand} / sổ kho {d.ledgerQuantity}
            </p>
            <p>
              Giữ hàng {d.reserved} / lịch sử giữ {d.ledgerReserved}
            </p>
            {d.carryingValue !== undefined && (
              <p>
                Giá trị tồn {vnd(d.carryingValue)} / sổ {vnd(d.ledgerValue!)}
              </p>
            )}
          </article>
        ))
      ) : !p.error ? (
        <p>Không phát hiện chênh lệch giữa tồn hiện tại và sổ kho.</p>
      ) : null}
      <PageButtons manager page={p} />
    </section>
  );
}
function StockCatalog({
  parts,
  warehouses,
  manage,
  busy,
  run,
}: {
  parts: Part[];
  warehouses: Warehouse[];
  manage: boolean;
  busy: boolean;
  run: Run;
}) {
  const [part, setPart] = useState({ code: "", name: "", unit: "" }),
    [warehouse, setWarehouse] = useState({ code: "", name: "" });
  return (
    <section className="adm-panel">
      <h2>Danh mục phụ tùng và kho</h2>
      {manage && (
        <>
          <form
            className="adm-booking-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await run("admin/stock/parts", part))
                setPart({ code: "", name: "", unit: "" });
            }}
          >
            <h3>Phụ tùng mới</h3>
            <div className="adm-form-grid">
              {(["code", "name", "unit"] as const).map((k) => (
                <label className="adm-field" key={k}>
                  {
                    {
                      code: "Mã phụ tùng",
                      name: "Tên phụ tùng",
                      unit: "Đơn vị tính",
                    }[k]
                  }{" "}
                  *
                  <input
                    required
                    maxLength={k === "name" ? 160 : k === "code" ? 50 : 30}
                    pattern={k === "code" ? "[A-Z0-9_-]{2,50}" : undefined}
                    value={part[k]}
                    onChange={(e) => setPart({ ...part, [k]: e.target.value })}
                  />
                </label>
              ))}
            </div>
            <button disabled={busy} className="adm-btn">
              Thêm phụ tùng
            </button>
          </form>
          <form
            className="adm-booking-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await run("admin/stock/warehouses", warehouse))
                setWarehouse({ code: "", name: "" });
            }}
          >
            <h3>Kho mới</h3>
            <div className="adm-form-grid">
              <label className="adm-field">
                Mã kho *
                <input
                  required
                  pattern="[A-Z0-9_-]{2,50}"
                  value={warehouse.code}
                  onChange={(e) =>
                    setWarehouse({ ...warehouse, code: e.target.value })
                  }
                />
              </label>
              <label className="adm-field">
                Tên kho *
                <input
                  required
                  maxLength={120}
                  value={warehouse.name}
                  onChange={(e) =>
                    setWarehouse({ ...warehouse, name: e.target.value })
                  }
                />
              </label>
            </div>
            <button className="adm-btn" disabled={busy}>
              Thêm kho
            </button>
          </form>
        </>
      )}
      {[
        ["parts", parts],
        ["warehouses", warehouses],
      ].map(([kind, items]) => (
        <div className="adv-lines" key={kind as string}>
          {(items as (Part | Warehouse)[]).filter((p) => !p.deletedAt).map((p) => (
            <article className="adv-line" key={p.id}>
              <strong>
                {p.code} · {p.name}
              </strong>
              <p>
                {"unit" in p ? p.unit : "Kho"} ·{" "}
                {p.active ? "Đang hoạt động" : "Ngừng sử dụng"}
              </p>
              {manage && (
                <div className="adm-action-row">
                  <button
                    className="adm-btn"
                    disabled={busy}
                    onClick={() => {
                      const name = window.prompt("Tên mới", p.name);
                      if (name?.trim())
                        void run(
                          `admin/stock/${kind}/${p.id}`,
                          {
                            expectedVersion: p.version,
                            name,
                            reason: "Cập nhật tên danh mục",
                          },
                          "PATCH",
                        );
                    }}
                  >
                    Đổi tên
                  </button>
                  <button
                    className="adm-btn"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        `admin/stock/${kind}/${p.id}`,
                        {
                          expectedVersion: p.version,
                          active: !p.active,
                          reason: p.active
                            ? "Ngừng sử dụng danh mục"
                            : "Mở lại danh mục",
                        },
                        "PATCH",
                      )
                    }
                  >
                    {p.active ? "Ngừng sử dụng" : "Mở lại"}
                  </button>
                  <ManagerDeleteButton
                    path={`admin/stock/${kind}/${p.id}`}
                    version={p.version}
                    message={`Xóa ${"unit" in p ? "phụ tùng" : "kho"} ${p.code} · ${p.name}? Chỉ xóa được khi không còn tồn kho, phiếu nháp hoặc yêu cầu xuất kho. Chứng từ cũ vẫn giữ tên.`}
                  />
                </div>
              )}
            </article>
          ))}
        </div>
      ))}
    </section>
  );
}
