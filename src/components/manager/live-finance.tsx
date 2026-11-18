"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { command, request, newRequestKey } from "@/lib/api/client";
import { useApiPage } from "@/lib/api/use-page";
import {
  cashKinds,
  methods,
  paymentLabels,
  type CashPayment,
  type Settlement,
} from "@/lib/api/stock-finance";
import { vnd, workflowTime } from "@/lib/api/workflow";
import { stationTime } from "@/lib/api/types";
import { useSession } from "@/components/admin/auth-gate";
import { AdminLoading, PageHeading } from "@/components/admin/primitives";
import { ManagerTable, ManagerEmpty } from "./manager-ui";
import { PageButtons } from "./live-stock";

type Run = (path: string, body: unknown) => Promise<boolean>;
type Subject = {
  id: string;
  code?: string;
  version: number;
  name?: string;
  phone?: string;
  customer?: { name: string; phone: string };
  vehicle?: { model?: string; plate?: string };
  stage?: string;
  status?: string;
  deletedAt?: string | null;
};
export function LiveFinance() {
  return (
    <Suspense fallback={<AdminLoading />}>
      <FinanceContent />
    </Suspense>
  );
}
function FinanceContent() {
  const params = useSearchParams(),
    session = useSession()!,
    [tab, setTab] = useState(
      params.has("bookingId") || params.has("customerId")
        ? "thu"
        : params.has("visitId")
          ? "phieu"
          : "so",
    ),
    [reload, setReload] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<CashPayment | null>(null),
    [query, setQuery] = useState("");
  const visitId = params.get("visitId") || "",
    read = session.permissions.includes("finance.read"),
    collect = session.permissions.includes("payments.collect"),
    refund = session.permissions.includes("payments.refund");
  async function run(path: string, body: unknown) {
    if (busy) return false;
    setBusy(true);
    setError("");
    try {
      await command(path, body);
      setSelected(null);
      setReload((n) => n + 1);
      window.dispatchEvent(new Event("dpauto-data-updated"));
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể ghi nhận.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function open(id: string) {
    try {
      const r = await request<CashPayment>("admin/finance/payments/" + id);
      setSelected(r.data);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Không tải được phiếu thu/chi.",
      );
    }
  }
  return (
    <div className="adv-stack">
      <PageHeading
        title="Tài chính & công nợ"
        description="Dòng tiền đã ghi nhận, phân bổ cọc và nghĩa vụ từng phiếu."
      />
      <nav className="mgr-tabs" aria-label="Tài chính">
        {(read
          ? [
              ["so", "Sổ thu/chi"],
              ["phieu", "Công nợ phiếu"],
              ["bao-cao", "Tổng hợp"],
            ]
          : []
        )
          .concat(collect ? [["thu", "Thu tiền / cọc"]] : [])
          .map(([k, l]) => (
            <button aria-pressed={tab === k} key={k} onClick={() => setTab(k)}>
              {l}
            </button>
          ))}
      </nav>
      {error && (
        <p role="alert" className="adm-error-text">
          {error}
        </p>
      )}
      {read && tab === "so" && (
        <section className="adm-panel">
          <label className="adm-field">
            Tìm người nộp / mã giao dịch
            <input value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <CashList
            query={query}
            visitId={visitId}
            reload={reload}
            open={open}
          />
        </section>
      )}
      {read && tab === "phieu" && (
        <AccountList
          visitId={visitId}
          reload={reload}
          refund={refund}
          run={run}
          busy={busy}
        />
      )}
      {read && tab === "bao-cao" && <FinanceReport reload={reload} />}
      {collect && (tab === "thu" || !read) && (
        <CollectForm
          key={reload}
          initialVisit={visitId}
          initialBooking={params.get("bookingId") || ""}
          initialCustomer={params.get("customerId") || ""}
          run={run}
          busy={busy}
        />
      )}
      {selected && read && (
        <section className="adm-panel">
          <div className="adm-section-line">
            <h2>
              {cashKinds[selected.kind as keyof typeof cashKinds]} ·{" "}
              {vnd(selected.amount)}
            </h2>
            <button className="adm-btn" onClick={() => setSelected(null)}>
              Đóng chi tiết
            </button>
          </div>
          <p>
            {selected.payerName} · {workflowTime(selected.occurredAt)}
          </p>
          <p>
            {selected.reference} · {selected.reason}
          </p>
          <Link
            className="adm-btn"
            target="_blank"
            href={`/dieu-hanh/tai-chinh/${selected.id}`}
          >
            In / lưu phiếu thu chi
          </Link>
          {selected.refundable !== null && (
            <>
              <p>Còn có thể hoàn: {vnd(selected.refundable)}</p>
              <p>Chưa phân bổ: {vnd(selected.available!)}</p>
              <dl className="adm-info-grid">
                {selected.allocations.map((a) => (
                  <div key={a.id}>
                    <dt>{a.visitCode}</dt>
                    <dd>
                      {vnd(a.amount)} · Còn hoàn {vnd(a.refundable)}
                    </dd>
                  </div>
                ))}
              </dl>
              {refund && selected.refundable !== "0" && (
                <RefundForm
                  key={selected.id}
                  payment={selected}
                  run={run}
                  busy={busy}
                />
              )}{" "}
              {collect && selected.available !== "0" && (
                <AllocateForm
                  key={selected.id + ":allocate"}
                  payment={selected}
                  run={run}
                  busy={busy}
                />
              )}
            </>
          )}
        </section>
      )}
      {!read && !collect && (
        <section className="adm-panel">
          <h2>Chưa được cấp quyền tài chính</h2>
          <p>
            Người quản trị tài khoản có thể cấp quyền tại Nhân sự → Quản lý →
            Quyền kho và tài chính.
          </p>
        </section>
      )}
    </div>
  );
}
function CashList({
  query,
  visitId,
  reload,
  open,
}: {
  query: string;
  visitId: string;
  reload: number;
  open: (id: string) => void;
}) {
  const p = useApiPage<CashPayment>(
    "admin/finance/payments?" +
      new URLSearchParams({
        ...(query ? { q: query } : {}),
        ...(visitId ? { visitId } : {}),
      }),
    reload,
  );
  return (
    <>
      {p.error && <p role="alert">{p.error}</p>}
      {p.loading ? (
        <AdminLoading />
      ) : !p.data.length ? (
        <ManagerEmpty message="Chưa có khoản thu/chi phù hợp" />
      ) : (
        <div className="mgr-table-scroll">
          <ManagerTable className="mgr-table">
            <thead>
              <tr>
                <th>Giao dịch</th>
                <th>Người nộp / tham chiếu</th>
                <th>Thời điểm</th>
                <th>Số tiền</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {p.data.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span
                      className={`mgr-pill mgr-pill-${["REFUND", "REVERSAL"].includes(r.kind) ? "danger" : "success"}`}
                    >
                      {cashKinds[r.kind as keyof typeof cashKinds]}
                    </span>
                  </td>
                  <td>
                    {r.payerName}
                    <small>{r.reference || "—"}</small>
                  </td>
                  <td>{workflowTime(r.occurredAt)}</td>
                  <td>
                    <strong>{vnd(r.amount)}</strong>
                  </td>
                  <td>
                    <button className="adm-btn" onClick={() => open(r.id)}>
                      Chi tiết
                    </button>
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
type Account = {
  id: string;
  code: string;
  version: number;
  stage: string;
  deletedAt?: string | null;
  customer: { name: string };
  vehicle: { plate: string; model: string };
  balance: Settlement;
};
function AccountList({
  visitId,
  reload,
  refund,
  run,
  busy,
}: {
  visitId: string;
  reload: number;
  refund: boolean;
  run: Run;
  busy: boolean;
}) {
  const [q, setQ] = useState(""),
    [only, setOnly] = useState(false),
    [credit, setCredit] = useState<Account | null>(null),
    [amount, setAmount] = useState(""),
    [reason, setReason] = useState(""),
    [evidence, setEvidence] = useState(""),
    [commandId, setCommandId] = useState(newRequestKey);
  const p = useApiPage<Account>(
    "admin/finance/accounts?" +
      new URLSearchParams({
        ...(visitId ? { visitId } : {}),
        ...(q ? { q } : {}),
        ...(only ? { outstandingOnly: "true" } : {}),
      }),
    reload,
  );
  return (
    <section className="adm-panel">
      <h2>Nghĩa vụ và phân bổ từng phiếu</h2>
      <div className="adm-form-grid">
        <label className="adm-field">
          Tìm phiếu / khách / biển số
          <input value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <label className="adm-toggle-row">
          <span>Chỉ còn phải thu</span>
          <input
            type="checkbox"
            checked={only}
            onChange={(e) => setOnly(e.target.checked)}
          />
        </label>
      </div>
      {p.error && <p role="alert">{p.error}</p>}
      {p.loading ? (
        <AdminLoading />
      ) : (
        <div className="mgr-table-scroll">
          <ManagerTable className="mgr-table">
            <thead>
              <tr>
                <th>Phiếu / khách</th>
                <th>Nghĩa vụ</th>
                <th>Đã thu ròng</th>
                <th>Còn phải thu</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {p.data.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link
                      className="adm-text-link"
                      href={
                        a.deletedAt
                          ? `/dieu-hanh/tai-chinh?visitId=${a.id}`
                          : `/dieu-hanh/phieu-dich-vu/${a.id}?tab=doi-soat`
                      }
                    >
                      {a.code}
                    </Link>
                    {a.deletedAt && <p className="adm-muted">Phiếu đã xóa</p>}
                    <p>
                      {a.customer.name} · {a.vehicle.plate || a.vehicle.model}
                    </p>
                  </td>
                  <td>
                    {a.balance.total !== null
                      ? vnd(a.balance.total)
                      : "Chưa xác định"}
                  </td>
                  <td>{vnd(a.balance.netReceived)}</td>
                  <td>
                    {a.balance.outstanding !== null
                      ? vnd(a.balance.outstanding)
                      : "—"}
                  </td>
                  <td>{paymentLabels[a.balance.paymentStatus]}</td>
                  <td>
                    <Link
                      className="adm-btn"
                      href={`/dieu-hanh/tai-chinh?visitId=${a.id}`}
                    >
                      Mở phiếu
                    </Link>
                    {refund &&
                      a.balance.assessed &&
                      a.balance.total !== "0" && (
                        <button
                          className="adm-btn"
                          onClick={() => {
                            setCredit(a);
                            setCommandId(newRequestKey());
                            setAmount("");
                            setEvidence("");
                            setReason("");
                          }}
                        >
                          Điều chỉnh giảm
                        </button>
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </ManagerTable>
          {!p.data.length && <p>Chưa có phiếu phù hợp.</p>}
        </div>
      )}
      <PageButtons manager page={p} />
      {credit && (
        <form
          className="adm-booking-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              window.confirm(
                "Ghi nhận giảm nghĩa vụ có căn cứ, giữ nguyên báo giá đã duyệt?",
              ) &&
              (await run(`admin/service-visits/${credit.id}/credits`, {
                commandId,
                expectedVersion: credit.version,
                amount,
                reason,
                evidence,
              }))
            )
              setCredit(null);
          }}
        >
          <h3>Điều chỉnh giảm · {credit.code}</h3>
          <label className="adm-field">
            Số tiền giảm (VND) *
            <input
              required
              inputMode="numeric"
              pattern="[0-9]{1,18}"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label className="adm-field">
            Lý do *
            <input
              required
              maxLength={400}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <label className="adm-field">
            Căn cứ và xác nhận của khách *
            <textarea
              required
              maxLength={2000}
              rows={3}
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
            />
          </label>
          <div className="adm-action-row">
            <button disabled={busy} className="adm-btn adm-primary">
              Ghi nhận điều chỉnh
            </button>
            <button
              className="adm-btn"
              type="button"
              onClick={() => setCredit(null)}
            >
              Đóng
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
function SubjectPicker({
  kind,
  value,
  onSelect,
}: {
  kind: string;
  value: Subject | null;
  onSelect: (s: Subject) => void;
}) {
  const session = useSession();
  const readAccounts =
    kind === "visit" && !!session?.permissions.includes("finance.read");
  const [query, setQuery] = useState(""),
    base =
      kind === "visit"
        ? readAccounts
          ? "admin/finance/accounts"
          : "admin/service-visits"
        : kind === "booking"
          ? "admin/bookings"
          : "admin/customers";
  const [date, setDate] = useState(() =>
    stationTime(new Date().toISOString()).slice(0, 10),
  );
  const p = useApiPage<Subject>(
    base +
      "?" +
      new URLSearchParams({
        ...(query ? { q: query } : {}),
        ...(kind === "booking"
          ? { from: date, to: date, status: "PENDING,CONFIRMED" }
          : kind === "visit" && !readAccounts
            ? { activeOnly: "true" }
            : {}),
      }),
    0,
  );
  const subjects = p.data.filter(
    (s) =>
      kind !== "visit" ||
      s.deletedAt ||
      !["HANDED_OVER", "COMPLETED", "ABORTED"].includes(s.stage || ""),
  );
  return (
    <div className="adm-form-grid">
      {kind === "booking" && (
        <label className="adm-field">
          Ngày hẹn
          <input
            required
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      )}
      <label className="adm-field">
        Tìm khách / phiếu
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tên khách, biển số hoặc mã phiếu"
        />
      </label>
      <label className="adm-field">
        Chọn đối tượng *
        <select
          required
          value={value?.id || ""}
          onChange={(e) => {
            const s = subjects.find((s) => s.id === e.target.value);
            if (s) onSelect(s);
          }}
        >
          <option value="">Chọn trong danh sách</option>
          {value && !subjects.some((s) => s.id === value.id) && (
            <option value={value.id}>
              {value.code || value.name || value.customer?.name}
              {value.deletedAt ? " · Phiếu đã xóa" : ""}
            </option>
          )}
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code || s.name} · {s.customer?.name || s.phone}
              {s.vehicle?.plate ? " · " + s.vehicle.plate : ""}
              {s.deletedAt ? " · Phiếu đã xóa" : ""}
            </option>
          ))}
        </select>
        {p.error && <small role="alert">{p.error}</small>}
      </label>
      <PageButtons manager page={p} />
    </div>
  );
}
function CollectForm({
  initialVisit,
  initialBooking,
  initialCustomer,
  run,
  busy,
}: {
  initialVisit: string;
  initialBooking: string;
  initialCustomer: string;
  run: Run;
  busy: boolean;
}) {
  const readAccounts = !!useSession()?.permissions.includes("finance.read");
  const [kind, setKind] = useState(
      initialBooking ? "booking" : initialCustomer ? "customer" : "visit",
    ),
    [subject, setSubject] = useState<Subject | null>(null),
    [amount, setAmount] = useState(""),
    [method, setMethod] = useState("CASH"),
    [reference, setReference] = useState(""),
    [payer, setPayer] = useState(""),
    [reason, setReason] = useState(""),
    [commandId] = useState(newRequestKey),
    [error, setError] = useState("");
  const [newCustomer, setNewCustomer] = useState(false),
    [customer, setCustomer] = useState({ name: "", phone: "" });
  useEffect(() => {
    const id = initialVisit || initialBooking || initialCustomer;
    if (!id) return;
    const a = new AbortController();
    const subjectRequest =
      initialVisit && readAccounts
        ? request<Subject[]>(
            `admin/finance/accounts?visitId=${encodeURIComponent(id)}`,
            { signal: a.signal },
          ).then((r) => r.data[0])
        : request<Subject>(
            (initialVisit
              ? "admin/service-visits/"
              : initialBooking
                ? "admin/bookings/"
                : "admin/customers/") + id,
            { signal: a.signal },
          ).then((r) => r.data);
    subjectRequest
      .then((subject) => {
        if (!subject) throw new Error("Không tìm thấy phiếu dịch vụ.");
        setSubject(subject);
        setPayer(subject.customer?.name || subject.name || "");
      })
      .catch((e) => {
        if (!a.signal.aborted) setError(e.message);
      });
    return () => a.abort();
  }, [initialVisit, initialBooking, initialCustomer, readAccounts]);
  return (
    <section className="adm-panel">
      <h2>{kind === "visit" ? "Thu tiền phiếu dịch vụ" : "Thu cọc"}</h2>
      {error && <p role="alert">{error}</p>}
      <form
        className="adm-booking-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!subject && !(kind === "customer" && newCustomer)) return;
          if (
            window.confirm("Xác nhận đã thực nhận và đối chiếu khoản tiền này?")
          )
            void run("admin/finance/payments", {
              commandId,
              expectedVersion: subject?.version || 1,
              ...(kind === "customer" && newCustomer
                ? { customer }
                : {
                    [kind === "visit"
                      ? "visitId"
                      : kind === "booking"
                        ? "bookingId"
                        : "customerId"]: subject!.id,
                  }),
              kind: kind === "visit" ? "COLLECT" : "DEPOSIT",
              amount,
              method,
              reference,
              payerName: payer,
              reason,
            });
        }}
      >
        <fieldset disabled={busy} className="adv-stack adv-checks">
          <legend>Khoản tiền thực tế</legend>
          <label className="adm-field">
            Gắn khoản thu với
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setSubject(null);
                setNewCustomer(false);
              }}
            >
              <option value="visit">Phiếu dịch vụ</option>
              <option value="booking">Lịch hẹn chưa tiếp nhận</option>
              <option value="customer">Khách hàng, chưa gắn lịch</option>
            </select>
          </label>
          {kind === "customer" && (
            <label className="adm-toggle-row">
              <span>Khách hàng mới</span>
              <input
                type="checkbox"
                checked={newCustomer}
                onChange={(e) => {
                  setNewCustomer(e.target.checked);
                  setSubject(null);
                }}
              />
            </label>
          )}
          {kind === "customer" && newCustomer ? (
            <div className="adm-form-grid">
              <label className="adm-field">
                Tên khách hàng *
                <input
                  required
                  maxLength={100}
                  value={customer.name}
                  onChange={(e) => {
                    setCustomer({ ...customer, name: e.target.value });
                    setPayer(e.target.value);
                  }}
                />
              </label>
              <label className="adm-field">
                Số điện thoại *
                <input
                  required
                  type="tel"
                  maxLength={30}
                  value={customer.phone}
                  onChange={(e) =>
                    setCustomer({ ...customer, phone: e.target.value })
                  }
                />
              </label>
            </div>
          ) : (
            <SubjectPicker
              kind={kind}
              value={subject}
              onSelect={(s) => {
                setSubject(s);
                setPayer(s.customer?.name || s.name || "");
              }}
            />
          )}
          <div className="adm-form-grid">
            <label className="adm-field">
              Số tiền (VND) *
              <input
                required
                inputMode="numeric"
                pattern="[0-9]{1,18}"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label className="adm-field">
              Phương thức
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                {Object.entries(methods).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="adm-field">
              Người nộp tiền *
              <input
                required
                maxLength={100}
                value={payer}
                onChange={(e) => setPayer(e.target.value)}
              />
            </label>
            <label className="adm-field">
              Mã giao dịch / căn cứ thu *
              <input
                required
                maxLength={160}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </label>
          </div>
          <label className="adm-field">
            Nội dung thu *
            <textarea
              required
              maxLength={400}
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <button
            className="adm-btn adm-primary"
            disabled={!subject && !(kind === "customer" && newCustomer)}
          >
            Ghi nhận đã thu
          </button>
        </fieldset>
      </form>
    </section>
  );
}
function RefundForm({
  payment: p,
  run,
  busy,
}: {
  payment: CashPayment;
  run: Run;
  busy: boolean;
}) {
  const [kind, setKind] = useState("REFUND"),
    [amount, setAmount] = useState(""),
    [allocation, setAllocation] = useState(""),
    [method, setMethod] = useState(p.method),
    [reference, setReference] = useState(""),
    [reason, setReason] = useState(""),
    [commandId] = useState(newRequestKey);
  return (
    <form
      className="adm-booking-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (
          window.confirm(
            "Xác nhận hoàn/đảo khoản tiền, giữ nguyên chứng từ gốc?",
          )
        )
          void run(`admin/finance/payments/${p.id}/refund`, {
            commandId,
            kind,
            amount: kind === "REVERSAL" ? p.refundable : amount,
            expectedRefundable: p.refundable,
            allocationId:
              kind === "REVERSAL" ? undefined : allocation || undefined,
            method,
            reference,
            reason,
          });
      }}
    >
      <h3>Hoàn / đảo khoản thu</h3>
      <div className="adm-form-grid">
        <label className="adm-field">
          Thao tác
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="REFUND">Hoàn một phần / toàn bộ</option>
            <option value="REVERSAL">Đảo toàn bộ phần còn lại</option>
          </select>
        </label>
        {kind === "REFUND" && (
          <>
            <label className="adm-field">
              Phần tiền hoàn
              <select
                value={allocation}
                onChange={(e) => setAllocation(e.target.value)}
              >
                <option value="">
                  Tiền chưa phân bổ ({vnd(p.available!)})
                </option>
                {p.allocations.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.visitCode} · {vnd(a.refundable)}
                  </option>
                ))}
              </select>
            </label>
            <label className="adm-field">
              Số tiền hoàn (VND) *
              <input
                required
                pattern="[0-9]{1,18}"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
          </>
        )}
        <label className="adm-field">
          Phương thức
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            {Object.entries(methods).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="adm-field">
          Mã giao dịch / căn cứ *
          <input
            required
            maxLength={160}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </label>
        <label className="adm-field">
          Lý do *
          <input
            required
            maxLength={400}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
      </div>
      <button className="adm-btn adm-danger" disabled={busy}>
        Xác nhận {kind === "REFUND" ? "hoàn tiền" : "đảo khoản thu"}
      </button>
    </form>
  );
}
function AllocateForm({
  payment: p,
  run,
  busy,
}: {
  payment: CashPayment;
  run: Run;
  busy: boolean;
}) {
  const [subject, setSubject] = useState<Subject | null>(null),
    [amount, setAmount] = useState(""),
    [commandId] = useState(newRequestKey);
  return (
    <form
      className="adm-booking-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (subject)
          void run(`admin/finance/payments/${p.id}/allocate`, {
            commandId,
            expectedVersion: subject.version,
            visitId: subject.id,
            amount,
            expectedAvailable: p.available,
            reason: "Phân bổ cọc đã thu cho phiếu cùng khách",
          });
      }}
    >
      <h3>Phân bổ tiền đã thu</h3>
      <SubjectPicker kind="visit" value={subject} onSelect={setSubject} />
      <label className="adm-field">
        Số tiền phân bổ (VND) *
        <input
          required
          pattern="[0-9]{1,18}"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </label>
      <button className="adm-btn" disabled={busy || !subject}>
        Phân bổ vào phiếu
      </button>
    </form>
  );
}
type Report = {
  cashIn: string;
  cashOut: string;
  netCash: string;
  approvedQuotes: string;
  outstanding: string;
  asOf: string;
};
function FinanceReport({ reload }: { reload: number }) {
  const today = stationTime(new Date().toISOString()).slice(0, 10),
    [from, setFrom] = useState(today),
    [to, setTo] = useState(today),
    [data, setData] = useState<Report | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    if (!from || !to) return;
    const a = new AbortController();
    setData(null);
    request<Report>(`admin/finance/summary?from=${from}&to=${to}`, {
      signal: a.signal,
    })
      .then((r) => {
        setData(r.data);
        setError("");
      })
      .catch((e) => {
        if (!a.signal.aborted) setError(e.message);
      });
    return () => a.abort();
  }, [from, to, reload]);
  return (
    <section className="adm-panel">
      <h2>Thu chi theo ngày ghi nhận</h2>
      <div className="adm-form-grid">
        <label className="adm-field">
          Từ ngày
          <input
            type="date"
            required
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="adm-field">
          Đến ngày
          <input
            type="date"
            required
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </div>
      {error && <p role="alert">{error}</p>}
      {data && (
        <dl className="adm-info-grid">
          {(
            [
              ["cashIn", "Thu thực tế trong kỳ"],
              ["cashOut", "Hoàn/đảo trong kỳ"],
              ["netCash", "Thu ròng trong kỳ"],
              ["approvedQuotes", "Báo giá được duyệt trong kỳ"],
              ["outstanding", "Còn phải thu toàn trạm tại thời điểm hiện tại"],
            ] as const
          ).map(([k, l]) => (
            <div key={k}>
              <dt>{l}</dt>
              <dd>
                <strong>{vnd(data[k])}</strong>
              </dd>
            </div>
          ))}
          <div>
            <dt>Cập nhật lúc</dt>
            <dd>{workflowTime(data.asOf)}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}
