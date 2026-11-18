"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { request, command, collection, ApiFailure } from "@/lib/api/client";
import type { ApiService, ApiStaff } from "@/lib/api/types";
import type { VisitDetail } from "@/lib/api/visits";
import {
  vnd,
  workflowTime,
  type Workflow,
  type RunWorkflow,
  type Evidence,
} from "@/lib/api/workflow";
import { useSession } from "@/components/admin/auth-gate";
import { AdminLoading } from "@/components/admin/primitives";
import { WorkflowQuote, EvidenceFields } from "./workflow-quote";
import { WorkflowWork } from "./workflow-work";
import { VisitSettlement } from "./visit-settlement";
import { OrderPerson } from "./order-common";
import { ServiceWorkflowPanel } from "./service-workflow-panel";

export function LiveWorkflow(props: {
  vehicleContent?: ReactNode;
  historyContent?: ReactNode;
  visit: VisitDetail;
  root: string;
  onCommitted: () => void;
  onDirty: (v: boolean) => void;
}) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <WorkflowContent {...props} />
    </Suspense>
  );
}
function WorkflowContent({
  vehicleContent,
  historyContent,
  visit,
  root,
  onCommitted,
  onDirty,
}: {
  vehicleContent?: ReactNode;
  historyContent?: ReactNode;
  visit: VisitDetail;
  root: string;
  onCommitted: () => void;
  onDirty: (v: boolean) => void;
}) {
  const params = useSearchParams(),
    path = usePathname(),
    session = useSession()!;
  const tab = ["bao-gia", "thi-cong", "nghiem-thu", "doi-soat"].includes(
      params.get("tab") || "",
    )
      ? params.get("tab")!
      : "tong-quan",
    revisionId = params.get("revision");
  const [data, setData] = useState<Workflow | null>(null),
    [services, setServices] = useState<ApiService[]>([]),
    [staff, setStaff] = useState<ApiStaff[]>([]);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [reload, setReload] = useState(0),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    const a = new AbortController();
    setLoading(true);
    const load = async () => {
      const [w, s, t] = await Promise.all([
        request<Workflow>(`admin/service-visits/${visit.id}/workflow`, {
          signal: a.signal,
        }),
        collection<ApiService>("admin/services", a.signal),
        collection<ApiStaff>(
          "admin/staff?jobRole=TECHNICIAN&active=true",
          a.signal,
        ),
      ]);
      if (!a.signal.aborted) {
        setData(w.data);
        setServices(s);
        setStaff(t);
        setError("");
      }
    };
    load()
      .catch((e) => {
        if (!a.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!a.signal.aborted) setLoading(false);
      });
    return () => a.abort();
  }, [visit.id, visit.version, reload]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    const link = (e: MouseEvent) => {
      const target = e.target;
      if (target instanceof Element && target.closest("a[href]")) {
        if (!window.confirm("Rời phần này và bỏ thay đổi chưa lưu?"))
          e.preventDefault();
        else markDirty(false);
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", link, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", link, true);
    };
  }, [dirty]);
  const markDirty = (v: boolean) => {
    setDirty(v);
    onDirty(v);
  };
  const run: RunWorkflow = async (p, body = {}, method = "POST") => {
    if (!data || busy) return false;
    setBusy(true);
    setError("");
    try {
      await command(
        p,
        {
          expectedVersion: data.version,
          reason: "Cập nhật phiếu dịch vụ",
          ...body,
        },
        method,
      );
      markDirty(false);
      onCommitted();
      window.dispatchEvent(new Event("dpauto-data-updated"));
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể lưu.");
      if (e instanceof ApiFailure && [401, 403, 404].includes(e.status)) {
        setData(null);
        markDirty(false);
        onCommitted();
      }
      return false;
    } finally {
      setBusy(false);
    }
  };
  const tabs = [
    ["tong-quan", root === "/co-van" ? "Tổng quan" : "Tiếp nhận"],
    ["bao-gia", "Báo giá"],
    ["thi-cong", "Thi công"],
    ["doi-soat", "Phụ tùng & thu tiền"],
    ["nghiem-thu", "Nghiệm thu & bàn giao"],
  ];
  if (loading) return <AdminLoading />;
  if (!data)
    return (
      <section className="adm-panel">
        <p className="adm-error-text" role="alert">
          {error}
        </p>
        <button className="adm-btn" onClick={() => setReload((n) => n + 1)}>
          Tải lại quy trình
        </button>
      </section>
    );
  const selected =
      data.quotes.find((q) => q.id === revisionId) || data.quotes.at(-1),
    closed = !data.allowedActions.length;
  if (data.workflowVersion === 2)
    return (
      <ServiceWorkflowPanel
        vehicleContent={vehicleContent}
        historyContent={historyContent}
        visit={visit}
        root={root}
        data={data}
        services={services}
        staff={staff}
        run={run}
        busy={busy}
        onDirty={markDirty}
        error={error}
        onReload={onCommitted}
      />
    );
  return (
    <div className="adv-stack">
      <nav className="adv-tabs" aria-label="Quy trình phiếu dịch vụ">
        {tabs.map(([id, label]) => (
          <Link
            key={id}
            href={`${path}?tab=${id}`}
            className={tab === id ? "is-active" : ""}
            aria-current={tab === id ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      {error && (
        <p className="adm-error-text" role="alert">
          {error}{" "}
          <button
            className="adm-btn"
            disabled={busy}
            onClick={() => {
              if (
                !dirty ||
                window.confirm("Tải dữ liệu mới và bỏ thay đổi chưa lưu?")
              ) {
                markDirty(false);
                onCommitted();
              }
            }}
          >
            Tải lại dữ liệu
          </button>
        </p>
      )}
      {tab === "tong-quan" && (
        <>
          {root === "/co-van" && (
            <OrderPerson
              customer={{ id: visit.customerId, ...visit.customer }}
              vehicle={visit.vehicle}
            />
          )}
          <section
            className={`adm-panel ${root === "/co-van" ? "adv-summary" : ""}`}
          >
            {root === "/co-van" ? (
              <dl className="adm-info-grid">
                <div>
                  <dt>Dịch vụ</dt>
                  <dd>{visit.services.map((s) => s.name).join(", ")}</dd>
                </div>
                <div>
                  <dt>Nguồn tiếp nhận</dt>
                  <dd>
                    {visit.origin === "WALK_IN"
                      ? "Khách đến trực tiếp"
                      : "Lịch hẹn"}
                  </dd>
                </div>
                {visit.bookingId && (
                  <div>
                    <dt>Lịch hẹn</dt>
                    <dd>
                      <Link
                        className="adm-text-link"
                        href={`${root}/lich-hen/${visit.bookingId}`}
                      >
                        Xem lịch hẹn
                      </Link>
                    </dd>
                  </div>
                )}
                {visit.followUpOfVisitId && (
                  <div>
                    <dt>Lần tiếp nhận trước</dt>
                    <dd>
                      <Link
                        className="adm-text-link"
                        href={`${root}/phieu-dich-vu/${visit.followUpOfVisitId}`}
                      >
                        Phiếu của lần trước
                      </Link>
                    </dd>
                  </div>
                )}
                <div>
                  <dt>Phiếu dịch vụ</dt>
                  <dd>{visit.code}</dd>
                </div>
                <div>
                  <dt>Cố vấn</dt>
                  <dd>{visit.assignedAdvisor.name}</dd>
                </div>
                <div>
                  <dt>Tiếp nhận</dt>
                  <dd>{workflowTime(visit.receivedAt)}</dd>
                </div>
                <div>
                  <dt>Tiến độ</dt>
                  <dd>
                    {data.work
                      ? `${data.work.items.filter((i) => i.status === "DONE").length}/${data.work.items.filter((i) => i.status !== "SKIPPED").length} công việc hoàn tất`
                      : "Chưa lập công việc thi công"}
                  </dd>
                </div>
                <div>
                  <dt>Phải thu sau điều chỉnh</dt>
                  <dd>
                    {data.obligation.assessed
                      ? vnd(data.obligation.total!)
                      : "Chưa xác định"}
                  </dd>
                </div>
                <div>
                  <dt>Đã thu sau hoàn / đảo</dt>
                  <dd>{vnd(data.settlement.netReceived)}</dd>
                </div>
                <div>
                  <dt>Còn phải thu</dt>
                  <dd>
                    {data.settlement.outstanding !== null
                      ? vnd(data.settlement.outstanding)
                      : "Chờ xác nhận báo giá"}
                  </dd>
                </div>
              </dl>
            ) : (
              <>
                <h2>Quy trình dịch vụ</h2>
                <p>
                  {data.work
                    ? `${data.work.items.filter((i) => i.status === "DONE").length}/${data.work.items.length} công việc hoàn tất`
                    : "Chưa lập công việc thi công"}
                </p>
                <p>
                  Phải thu sau điều chỉnh:{" "}
                  {data.obligation.assessed
                    ? vnd(data.obligation.total!)
                    : "Chưa xác định"}
                </p>
              </>
            )}
            <div className="adv-actions adv-toolbar">
              <Link className="adm-btn" href={`${path}?tab=bao-gia`}>
                Mở báo giá
              </Link>
              <Link className="adm-btn" href={`${path}?tab=thi-cong`}>
                Mở công việc
              </Link>
            </div>
          </section>
        </>
      )}
      {tab === "doi-soat" && (
        <VisitSettlement
          data={data}
          run={run}
          busy={busy}
          onDirty={markDirty}
        />
      )}
      {tab === "bao-gia" && (
        <>
          <section className="adm-panel">
            <h2>Các bản báo giá</h2>
            <div className="adm-action-row">
              {data.quotes.map((q) => (
                <Link
                  className={`adm-btn ${q.id === selected?.id ? "adm-primary" : ""}`}
                  key={q.id}
                  href={`${path}?tab=bao-gia&revision=${q.id}`}
                >
                  Bản {q.revisionNo}
                  {q.kind === "CHANGE_ORDER" ? " · Phát sinh" : ""}
                </Link>
              ))}
            </div>
            {!closed &&
              !data.quotes.some((q) =>
                ["DRAFT", "SUBMITTED"].includes(q.status),
              ) && (
                <button
                  className="adm-btn adm-primary"
                  disabled={busy}
                  onClick={() =>
                    void run(`admin/service-visits/${visit.id}/quotes`, {
                      baseRevisionId: data.quotes.at(-1)?.id,
                      reason: data.quotes.length
                        ? "Lập bản báo giá tiếp theo"
                        : "Lập báo giá dịch vụ",
                    })
                  }
                >
                  {data.quotes.some((q) => q.status === "APPROVED")
                    ? "Thêm báo giá phát sinh"
                    : data.quotes.length
                      ? "Lập lại báo giá"
                      : "Tạo báo giá"}
                </button>
              )}
          </section>
          {selected && (
            <WorkflowQuote
              key={selected.id}
              revision={selected}
              services={services}
              run={run}
              busy={busy}
              root={root}
              visitId={visit.id}
              closed={closed}
              onDirty={markDirty}
              customerName={visit.customer.name}
              media={visit.media}
            />
          )}
          {!closed && session.permissions.includes("work.exempt") && (
            <FreeWork
              data={data}
              run={run}
              busy={busy}
              onDirty={markDirty}
              customerName={visit.customer.name}
            />
          )}
        </>
      )}
      {tab === "thi-cong" && (
        <WorkflowWork
          data={data}
          technicians={staff}
          run={run}
          busy={busy}
          onDirty={markDirty}
        />
      )}
      {tab === "nghiem-thu" && (
        <Quality
          data={data}
          staff={[
            {
              id: session.staff.id,
              name: session.staff.name,
              jobRole: session.staff.jobRole,
              active: true,
              version: 1,
            },
            ...staff,
          ]}
          run={run}
          busy={busy}
          root={root}
          onDirty={markDirty}
          customerName={visit.customer.name}
        />
      )}
    </div>
  );
}
export function FreeWork({
  data,
  run,
  busy,
  onDirty,
  customerName,
}: {
  data: Workflow;
  run: RunWorkflow;
  busy: boolean;
  onDirty: (v: boolean) => void;
  customerName: string;
}) {
  const [mode, setMode] = useState("NO_QUOTE_FREE"),
    [scope, setScope] = useState(""),
    [reason, setReason] = useState(""),
    [evidence, setEvidence] = useState<Evidence>({
      customerName,
      channel: "IN_PERSON",
      note: "",
    });
  return (
    <section className="adm-panel">
      <details>
        <summary className="adm-btn">
          Duyệt công việc miễn phí / không lập báo giá
        </summary>
        <form
          className="adm-booking-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run(`admin/service-visits/${data.visitId}/work-exemptions`, {
              mode,
              scope,
              reason,
              evidence,
            });
          }}
        >
          <fieldset className="adv-stack adv-checks" disabled={busy}>
            <legend>Quản lý xác nhận phạm vi miễn phí</legend>
            <label className="adm-field">
              Hình thức
              <select
                value={mode}
                onChange={(e) => {
                  setMode(e.target.value);
                  onDirty(true);
                }}
              >
                <option value="NO_QUOTE_FREE">
                  Toàn phiếu miễn phí, không lập báo giá
                </option>
                <option value="FREE_TASKS">Một số công việc miễn phí</option>
              </select>
            </label>
            <label className="adm-field">
              Phạm vi công việc *
              <textarea
                required
                maxLength={2000}
                rows={3}
                value={scope}
                onChange={(e) => {
                  setScope(e.target.value);
                  onDirty(true);
                }}
              />
            </label>
            <label className="adm-field">
              Lý do duyệt miễn phí *
              <input
                required
                maxLength={400}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  onDirty(true);
                }}
              />
            </label>
            <EvidenceFields
              value={evidence}
              onChange={(e) => {
                setEvidence(e);
                onDirty(true);
              }}
            />
            <button className="adm-btn adm-primary">Duyệt miễn phí</button>
          </fieldset>
        </form>
      </details>
    </section>
  );
}
export function Quality({
  data,
  staff,
  run,
  busy,
  root,
  onDirty,
  customerName,
}: {
  data: Workflow;
  staff: ApiStaff[];
  run: RunWorkflow;
  busy: boolean;
  root: string;
  onDirty: (v: boolean) => void;
  customerName: string;
}) {
  const session = useSession()!,
    [inspector, setInspector] = useState(""),
    [result, setResult] = useState(""),
    [note, setNote] = useState(""),
    [checks, setChecks] = useState<Record<string, boolean>>({});
  const [recipient, setRecipient] = useState(customerName),
    [proof, setProof] = useState(""),
    [moved, setMoved] = useState(false),
    [reason, setReason] = useState("");
  const stockPending = !data.stock.fulfilled;
  const collectOnHandover = root === "/co-van" && data.workflowVersion === 2;
  const closed = !data.allowedActions.length,
    items = data.work?.items.filter((i) => i.status !== "SKIPPED") || [];
  return (
    <div className="adv-stack">
      {!closed &&
        data.stage === "QUALITY_CHECK" &&
        data.work?.status === "FINISHED" && (
          <section className="adm-panel">
            <h2>Nghiệm thu chất lượng</h2>
            <form
              className="adm-booking-form"
              onSubmit={(e) => {
                e.preventDefault();
                void run(`admin/service-visits/${data.visitId}/acceptances`, {
                  inspectorId: inspector,
                  result,
                  note,
                  reason: "Ghi nhận kết quả nghiệm thu thực tế",
                  checks: items.map((i) => ({
                    workItemId: i.id,
                    passed: !!checks[i.id],
                    note: "",
                  })),
                });
              }}
            >
              <fieldset className="adv-stack adv-checks" disabled={busy}>
                <legend>Kết quả kiểm tra</legend>
                <label className="adm-field">
                  Người kiểm tra *
                  <select
                    required
                    value={inspector}
                    onChange={(e) => {
                      setInspector(e.target.value);
                      onDirty(true);
                    }}
                  >
                    <option value="">Chọn người kiểm tra</option>
                    {staff
                      .filter(
                        (s, i, a) => a.findIndex((x) => x.id === s.id) === i,
                      )
                      .map((s) => (
                        <option value={s.id} key={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </label>
                <div className="adv-check-grid">
                  {items.map((i) => (
                    <label key={i.id}>
                      <input
                        type="checkbox"
                        checked={!!checks[i.id]}
                        onChange={(e) => {
                          setChecks({ ...checks, [i.id]: e.target.checked });
                          onDirty(true);
                        }}
                      />
                      {i.label} đạt yêu cầu
                    </label>
                  ))}
                </div>
                <label className="adm-field">
                  Kết quả *
                  <select
                    required
                    value={result}
                    onChange={(e) => {
                      setResult(e.target.value);
                      onDirty(true);
                    }}
                  >
                    <option value="">Chọn kết quả</option>
                    <option value="PASSED">Đạt</option>
                    <option value="NEEDS_WORK">Cần làm lại</option>
                  </select>
                </label>
                <label className="adm-field">
                  Nhận xét *
                  <textarea
                    required
                    maxLength={2000}
                    rows={3}
                    value={note}
                    onChange={(e) => {
                      setNote(e.target.value);
                      onDirty(true);
                    }}
                  />
                </label>
                <button className="adm-btn adm-primary">Lưu nghiệm thu</button>
              </fieldset>
            </form>
          </section>
        )}
      <section className="adm-panel">
        <h2>Lịch sử nghiệm thu</h2>
        {data.acceptances.length ? (
          data.acceptances.map((a) => (
            <article className="adm-booking-card" key={a.id}>
              <div className="adm-card-top">
                <strong>
                  {a.result === "PASSED" ? "Đạt yêu cầu" : "Cần làm lại"}
                </strong>
                <span>{a.inspector.name}</span>
              </div>
              <p>
                {workflowTime(a.checkedAt)} · {a.note}
              </p>
              {data.work && a.scopeVersion !== data.work.scopeVersion && (
                <p className="adm-muted">
                  Phạm vi công việc đã thay đổi sau lần kiểm tra này.
                </p>
              )}
              <Link
                className="adm-btn"
                target="_blank"
                href={`${root}/phieu-dich-vu/${data.visitId}/in-nghiem-thu?acceptance=${a.id}`}
              >
                In / lưu biên bản
              </Link>
            </article>
          ))
        ) : (
          <p>Chưa có kết quả nghiệm thu.</p>
        )}
        {!closed &&
          data.stage === "QUALITY_CHECK" &&
          data.acceptances[0]?.result === "PASSED" &&
          data.acceptances[0]?.scopeVersion === data.work?.scopeVersion && (
            <button
              className="adm-btn adm-primary"
              disabled={busy}
              onClick={() =>
                void run(`admin/service-visits/${data.visitId}/ready`, {
                  reason: "Nghiệm thu đạt, xe sẵn sàng bàn giao",
                })
              }
            >
              Đánh dấu xe sẵn sàng
            </button>
          )}
      </section>
      {["READY", "HANDOVER"].includes(data.stage) &&
        session.permissions.includes("visits.handover") && (
          <section className="adm-panel">
            <h2>Bàn giao xe</h2>
            {!data.obligation.assessed ? (
              <p className="adm-error-text">
                Chưa xác định nghĩa vụ theo báo giá.
              </p>
            ) : collectOnHandover ? (
              <p className="adm-muted">
                Bấm Hoàn thành phiếu xác nhận khách đã thanh toán đủ 100% chi
                phí. Hệ thống ghi nhận phần còn phải thu khi hoàn thành.
              </p>
            ) : data.settlement.outstanding !== "0" ? (
              <p className="adm-error-text">
                Phiếu còn phải thu {vnd(data.settlement.outstanding!)}. Cần thu
                đủ và phân bổ tiền trước khi bàn giao.
              </p>
            ) : null}
            {stockPending && (
              <p className="adm-error-text">
                Cần đối soát phụ tùng trước khi bàn giao.
              </p>
            )}
            <form
              className="adm-booking-form"
              onSubmit={(e) => {
                e.preventDefault();
                void run(`admin/service-visits/${data.visitId}/handover`, {
                  recipientName: recipient,
                  evidenceNote: proof,
                  vehicleMoved: moved,
                  ...(collectOnHandover ? { paymentReceived: true } : {}),
                  paymentBasis:
                    data.settlement.total === "0" &&
                    data.settlement.netReceived === "0"
                      ? "NO_CHARGE"
                      : "SETTLED",
                  reason: "Bàn giao xe sau nghiệm thu và đối soát",
                });
              }}
            >
              <fieldset disabled={busy} className="adv-stack adv-checks">
                <legend>Xác nhận giao xe thực tế</legend>
                <label className="adm-field">
                  Người nhận xe *
                  <input
                    required
                    maxLength={100}
                    value={recipient}
                    onChange={(e) => {
                      setRecipient(e.target.value);
                      onDirty(true);
                    }}
                  />
                </label>
                <label className="adm-field">
                  Ghi nhận bàn giao *
                  <textarea
                    required
                    maxLength={2000}
                    rows={3}
                    value={proof}
                    onChange={(e) => {
                      setProof(e.target.value);
                      onDirty(true);
                    }}
                  />
                </label>
                <label className="adv-checks">
                  <input
                    required
                    type="checkbox"
                    checked={moved}
                    onChange={(e) => {
                      setMoved(e.target.checked);
                      onDirty(true);
                    }}
                  />{" "}
                  Đã kiểm tra xe và sẵn sàng bàn giao
                </label>
                <button
                  className="adm-btn adm-primary"
                  disabled={
                    !data.obligation.assessed ||
                    (!collectOnHandover &&
                      data.settlement.outstanding !== "0") ||
                    stockPending
                  }
                >
                  {data.workflowVersion === 2
                    ? "Hoàn thành phiếu"
                    : "Hoàn tất bàn giao"}
                </button>
              </fieldset>
            </form>
          </section>
        )}
      {data.handover && (
        <section className="adm-panel">
          <h2>Đã bàn giao</h2>
          <p>
            {data.handover.recipientName} ·{" "}
            {workflowTime(data.handover.handedOverAt)}
          </p>
          <p>{data.handover.evidenceNote}</p>
        </section>
      )}
      {!closed && session.permissions.includes("visits.abort") && (
        <section className="adm-panel">
          <details>
            <summary className="adm-btn adm-subtle-danger">
              Dừng phiếu dịch vụ
            </summary>
            <form
              className="adm-booking-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (
                  window.confirm(
                    "Dừng phiếu sau khi đã đưa xe ra khỏi khu vực thi công?",
                  )
                )
                  void run(`admin/service-visits/${data.visitId}/abort`, {
                    reason,
                    evidenceNote: proof,
                    vehicleMoved: moved,
                  });
              }}
            >
              <label className="adm-field">
                Lý do dừng *
                <textarea
                  required
                  maxLength={400}
                  rows={2}
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    onDirty(true);
                  }}
                />
              </label>
              <label className="adm-field">
                Căn cứ xử lý *
                <textarea
                  required
                  maxLength={2000}
                  rows={3}
                  value={proof}
                  onChange={(e) => {
                    setProof(e.target.value);
                    onDirty(true);
                  }}
                />
              </label>
              <label className="adv-checks">
                <input
                  required
                  type="checkbox"
                  checked={moved}
                  onChange={(e) => {
                    setMoved(e.target.checked);
                    onDirty(true);
                  }}
                />{" "}
                Đã đưa xe ra khỏi khu vực thi công
              </label>
              <button className="adm-btn adm-danger" disabled={busy}>
                Xác nhận dừng phiếu
              </button>
            </form>
          </details>
        </section>
      )}
    </div>
  );
}
