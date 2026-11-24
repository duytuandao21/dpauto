"use client";
import { formatPhone, formatPlate } from "@/lib/advisor/formats";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useSession } from "@/components/admin/auth-gate";
import {
  visitStages,
  visitStageTone,
  type VisitDetail,
} from "@/lib/api/visits";
import type { ApiService, ApiStaff } from "@/lib/api/types";
import {
  vnd,
  formatQuantity,
  workflowTime,
  type Workflow,
  type RunWorkflow,
} from "@/lib/api/workflow";
import { WorkflowQuote } from "./workflow-quote";
import { WorkflowWork } from "./workflow-work";
import { VisitSettlement } from "./visit-settlement";
import { FreeWork, Quality } from "./live-workflow";

const stages = [
  ["QUOTING", "Báo giá"],
  ["WAITING_FOR_WORK", "Chờ thi công"],
  ["IN_PROGRESS", "Đang thi công"],
  ["HANDOVER", "Bàn giao"],
  ["COMPLETED", "Hoàn thành"],
];
export function ServiceWorkflowPanel({
  visit,
  root,
  data,
  services,
  staff,
  run,
  busy,
  onDirty,
  error,
  onReload,
  vehicleContent,
  historyContent,
}: {
  vehicleContent?: ReactNode;
  historyContent?: ReactNode;
  visit: VisitDetail;
  root: string;
  data: Workflow;
  services: ApiService[];
  staff: ApiStaff[];
  run: RunWorkflow;
  busy: boolean;
  onDirty: (v: boolean) => void;
  error: string;
  onReload: () => void;
}) {
  const params = useSearchParams(),
    path = usePathname(),
    session = useSession()!;
  const workspace = root === "/co-van";
  const [completionOpen, setCompletionOpen] = useState(false);
  const stage = data.stage as VisitDetail["stage"];
  const raw = params.get("tab"),
    area =
      raw === "tong-quan"
        ? "vehicle"
        : ["doi-soat", "nghiem-thu"].includes(raw || "")
          ? "payment"
          : raw === "thi-cong" && workspace
            ? "work"
            : !raw &&
                (["HANDOVER", "COMPLETED"].includes(data.stage) ||
                  (workspace && data.stage === "ABORTED"))
              ? "payment"
              : !raw &&
                  workspace &&
                  ["WAITING_FOR_WORK", "IN_PROGRESS"].includes(data.stage)
                ? "work"
                : "cost";
  const selected =
      data.quotes.find((q) =>
        ["DRAFT", "SUBMITTED", "PENDING_APPROVAL"].includes(q.status),
      ) ||
      data.quotes.filter((q) => q.status === "APPROVED").at(-1) ||
      data.quotes.at(-1),
    closed = !data.allowedActions.length;
  const can = (permission: string) =>
    !closed && session.permissions.includes(permission);
  const open = data.quotes.some((q) =>
    ["DRAFT", "SUBMITTED", "PENDING_APPROVAL"].includes(q.status),
  );
  const create = () =>
    void run(`admin/service-visits/${visit.id}/quotes`, {
      baseRevisionId: data.quotes.at(-1)?.id,
      reason:
        data.stage === "IN_PROGRESS"
          ? "Lập báo giá phát sinh"
          : "Lập báo giá dịch vụ",
    });
  const historyQuotes = data.quotes.filter((q) =>
    workspace
      ? ["APPROVED", "REJECTED", "VOIDED"].includes(q.status)
      : q.id !== selected?.id && q.status !== "DRAFT",
  );
  const quoteHistory = !!historyQuotes.length && (
    <details className="adm-panel">
      <summary>Lịch sử xác nhận và hủy hạng mục</summary>
      <div className="adv-stack">
        {historyQuotes.map((q) => (
          <details key={q.id}>
            <summary>
              {q.kind === "CHANGE_ORDER"
                ? "Hạng mục bổ sung"
                : "Hạng mục ban đầu"}
              {q.decision ? ` · ${workflowTime(q.decision.recordedAt)}` : ""}
            </summary>
            <WorkflowQuote
              workflowV2
              detailsOnly
              revision={q}
              services={services}
              run={run}
              busy={busy}
              root={root}
              visitId={visit.id}
              closed={closed || data.stage === "HANDOVER"}
              onDirty={onDirty}
              customerName={visit.customer.name}
              media={visit.media}
            />
          </details>
        ))}
      </div>
    </details>
  );
  return (
    <div
      className={`adv-stack adv-workflow-v2 ${workspace ? "adv-service-workspace" : ""}`}
    >
      <div
        className={workspace ? "adv-service-sticky" : "adv-workflow-heading"}
      >
        {workspace ? (
          <header className="adm-panel adv-service-header">
            <div className="adm-section-line">
              <div>
                <p className="adm-muted adv-service-code">
                  Phiếu dịch vụ · {visit.code}
                </p>
                <h1>
                  {visit.vehicle.model || "Chưa ghi dòng xe"} ·{" "}
                  {formatPlate(visit.vehicle.plate) || "Chưa có biển số"}
                </h1>
                <p>
                  {visit.customer.name} ·{" "}
                  <a
                    className="adm-text-link"
                    href={`tel:${formatPhone(visit.customer.phone)}`}
                  >
                    {formatPhone(visit.customer.phone)}
                  </a>
                </p>
              </div>
              <span
                className={`adm-badge adm-status-${data.isPaused ? "pending" : visitStageTone[stage]}`}
              >
                {data.isPaused ? "Tạm dừng thi công" : visitStages[stage]}
              </span>
            </div>
            <div className="adv-service-meta">
              <span>Cố vấn: {visit.assignedAdvisor.name}</span>
              <span>Tiếp nhận: {workflowTime(visit.receivedAt)}</span>
              {/* Actions apart from the info text: list = secondary, follow-up = primary. */}
              <span className="adv-service-actions">
                <Link className="adm-btn" href={`${root}/phieu-dich-vu`}>
                  Danh sách phiếu
                </Link>
                {["COMPLETED", "ABORTED"].includes(data.stage) && (
                  <Link
                    className="adm-btn adm-primary"
                    href={`${root}/tiep-nhan/truc-tiep?followUp=${visit.id}`}
                  >
                    Tiếp nhận xe quay lại
                  </Link>
                )}
              </span>
            </div>
            <dl className="adv-service-totals">
              <div>
                <dt>Giá trị đã duyệt</dt>
                <dd>
                  {data.obligation.assessed
                    ? vnd(
                        data.quoteTotals
                          ? String(
                              BigInt(data.quoteTotals.original) +
                                BigInt(data.quoteTotals.extras),
                            )
                          : data.obligation.total!,
                      )
                    : "Chưa chốt"}
                </dd>
              </div>
              {data.quoteTotals && (!data.obligation.assessed || open) && (
                <div>
                  <dt>Tổng dự kiến</dt>
                  <dd>{vnd(data.quoteTotals.proposed)}</dd>
                </div>
              )}
              <div>
                <dt>Còn phải thu</dt>
                <dd>
                  {data.settlement.outstanding == null
                    ? "Chưa xác định"
                    : vnd(data.settlement.outstanding)}
                </dd>
              </div>
            </dl>
            {data.stage !== "ABORTED" && (
              <ol
                className="adv-service-progress"
                aria-label="Giai đoạn phiếu dịch vụ"
              >
                {stages.map(([id, label], index) => (
                  <li
                    key={id}
                    aria-label={label}
                    className={
                      index <= stages.findIndex(([key]) => key === data.stage)
                        ? "is-active"
                        : ""
                    }
                    aria-current={id === data.stage ? "step" : undefined}
                  >
                    <span>{index + 1}</span>
                    <span className="adv-service-progress-label">{label}</span>
                  </li>
                ))}
              </ol>
            )}
          </header>
        ) : (
          <section className="adm-panel">
            <div className="adm-section-line">
              <div>
                <strong>{visit.customer.name}</strong>
                <p>
                  <a href={`tel:${formatPhone(visit.customer.phone)}`}>
                    {formatPhone(visit.customer.phone)}
                  </a>{" "}
                  · {formatPlate(visit.vehicle.plate) || "Chưa có biển số"} ·{" "}
                  {visit.vehicle.model}
                </p>
              </div>
              <span>Cố vấn: {visit.assignedAdvisor.name}</span>
            </div>
            <dl className="adm-info-grid">
              <div>
                <dt>Giá trị đã duyệt</dt>
                <dd>
                  {data.obligation.assessed
                    ? vnd(
                        data.quoteTotals
                          ? String(
                              BigInt(data.quoteTotals.original) +
                                BigInt(data.quoteTotals.extras),
                            )
                          : data.obligation.total!,
                      )
                    : "Chưa chốt"}
                </dd>
              </div>
              <div>
                <dt>Còn phải thu</dt>
                <dd>
                  {data.settlement.outstanding == null
                    ? "Chưa xác định"
                    : vnd(data.settlement.outstanding)}
                </dd>
              </div>
            </dl>
            <ol
              className="adv-service-progress"
              aria-label="Giai đoạn phiếu dịch vụ"
            >
              {stages.map(([id, label], index) => (
                <li
                  key={id}
                  className={
                    index <= stages.findIndex(([key]) => key === data.stage)
                      ? "is-active"
                      : ""
                  }
                  aria-current={id === data.stage ? "step" : undefined}
                >
                  <span>{index + 1}</span>
                  {label}
                </li>
              ))}
            </ol>
            {data.isPaused && (
              <p className="adm-feedback" role="status">
                <strong>Đang tạm dừng:</strong> {data.pauseReason}
                {data.pausedAt ? ` · ${workflowTime(data.pausedAt)}` : ""}
              </p>
            )}
            {data.stage === "ABORTED" && (
              <p className="adm-error-text">Phiếu đã dừng.</p>
            )}
          </section>
        )}
        <nav className="adv-tabs" aria-label="Nội dung phiếu dịch vụ">
          {[
            ...(workspace ? [["work", "thi-cong", "Công việc"]] : []),
            [
              "cost",
              "bao-gia",
              workspace ? "Báo giá & Phát sinh" : "Hạng mục & Chi phí",
            ],
            [
              "vehicle",
              "tong-quan",
              workspace ? "Thông tin xe" : "Thông tin xe & Kiểm tra",
            ],
            ["payment", "doi-soat", "Thanh toán & Lịch sử"],
          ].map(([key, tab, label]) => (
            <Link
              key={key}
              href={`${path}?tab=${tab}`}
              scroll={false}
              className={area === key ? "is-active" : ""}
              aria-current={area === key ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
      {workspace && data.isPaused && (
        <p className="adm-feedback" role="status">
          <strong>Đang tạm dừng:</strong> {data.pauseReason}
          {data.pausedAt ? ` · ${workflowTime(data.pausedAt)}` : ""}
        </p>
      )}
      {workspace && data.stage === "ABORTED" && (
        <p className="adm-feedback" role="status">
          Phiếu đã dừng. Bạn có thể tra cứu báo giá, thông tin xe và lịch sử xử
          lý.
        </p>
      )}
      {error && (
        <p className="adm-error-text" role="alert">
          {error}{" "}
          <button
            className="adm-btn"
            disabled={busy}
            onClick={() => {
              if (
                window.confirm("Tải dữ liệu mới và bỏ các thay đổi chưa lưu?")
              ) {
                onDirty(false);
                onReload();
              }
            }}
          >
            Tải lại dữ liệu
          </button>
        </p>
      )}
      {area === "cost" && (
        <>
          {!workspace && (
            <>
              {["WAITING_FOR_WORK", "IN_PROGRESS"].includes(data.stage) && (
                <section className="adm-panel">
                  <h2>Thi công</h2>
                  {can("work.write") && data.stage === "WAITING_FOR_WORK" && (
                    <button
                      className="adm-btn adm-primary"
                      disabled={busy}
                      onClick={() =>
                        void run(
                          `admin/service-visits/${visit.id}/work/start`,
                          {
                            reason: "Bắt đầu thi công các hạng mục đã duyệt",
                          },
                        )
                      }
                    >
                      Bắt đầu thi công
                    </button>
                  )}
                  {can("work.write") && data.stage === "IN_PROGRESS" && (
                    <div className="adm-action-row">
                      <button
                        className={`adm-btn ${data.isPaused ? "adm-primary" : ""}`}
                        disabled={busy}
                        onClick={() => {
                          const reason = data.isPaused
                            ? "Tiếp tục thi công sau khi xử lý lý do tạm dừng"
                            : window.prompt("Lý do tạm dừng thi công?");
                          if (reason?.trim())
                            void run(
                              `admin/service-visits/${visit.id}/work/${data.isPaused ? "resume" : "pause"}`,
                              { reason: reason.trim() },
                            );
                        }}
                      >
                        {data.isPaused ? "Tiếp tục thi công" : "Tạm dừng"}
                      </button>
                      {!data.isPaused && (
                        <a
                          className="adm-btn adm-primary"
                          href="#hoan-tat-thi-cong"
                        >
                          Hoàn tất thi công
                        </a>
                      )}
                    </div>
                  )}
                </section>
              )}
            </>
          )}
          {!open && (
            <section className="adm-panel">
              <div className="adm-section-line">
                <h2>Báo giá · {visit.code}</h2>
                {can("quotes.write") &&
                  !open &&
                  ["QUOTING", "WAITING_FOR_WORK", "IN_PROGRESS"].includes(
                    data.stage,
                  ) && (
                    <button
                      className="adm-btn adm-primary"
                      disabled={busy}
                      onClick={create}
                    >
                      {data.quotes.some((q) => q.status === "APPROVED")
                        ? "+ Thêm hạng mục phát sinh"
                        : data.quotes.length
                          ? "Tiếp tục lập báo giá"
                          : "Lập báo giá"}
                    </button>
                  )}
              </div>
              {!selected && (
                <p className="adm-muted">
                  Lập danh sách dịch vụ và phụ tùng, sau đó chốt báo giá khi
                  khách đã đồng ý.
                </p>
              )}
            </section>
          )}
          {selected && (
            <WorkflowQuote
              key={selected.id}
              showDecision={!workspace}
              workflowV2
              revision={selected}
              previousQuotes={data.quotes.filter(
                (q) => q.id !== selected.id && q.status === "APPROVED",
              )}
              approvedAmount={
                data.obligation.assessed ? data.obligation.total : null
              }
              services={services}
              run={run}
              busy={busy}
              root={root}
              visitId={visit.id}
              closed={closed || data.stage === "HANDOVER"}
              onDirty={onDirty}
              customerName={visit.customer.name}
              media={visit.media}
            />
          )}
          {!workspace && quoteHistory}
          {can("work.exempt") && data.stage === "QUOTING" && (
            <FreeWork
              data={data}
              run={run}
              busy={busy}
              onDirty={onDirty}
              customerName={visit.customer.name}
            />
          )}
          {!workspace && (
            <>
              {can("work.write") &&
                ["WAITING_FOR_WORK", "IN_PROGRESS"].includes(data.stage) && (
                  <details className="adm-panel">
                    <summary>Công việc & Kỹ thuật viên</summary>
                    <WorkflowWork
                      data={data}
                      technicians={staff}
                      run={run}
                      busy={busy}
                      onDirty={onDirty}
                    />
                  </details>
                )}
              {data.stage === "IN_PROGRESS" &&
                !data.isPaused &&
                can("acceptance.record") && (
                  <CompletionForm
                    data={data}
                    run={run}
                    busy={busy}
                    onDirty={onDirty}
                    canFinish={can("work.write")}
                  />
                )}
            </>
          )}
        </>
      )}
      {area === "work" && (
        <>
          <section className="adm-panel adv-service-work-head">
            <div className="adm-section-line">
              <div>
                <h2>
                  {data.stage === "IN_PROGRESS"
                    ? "Công việc đang thực hiện"
                    : "Hạng mục thực hiện"}
                </h2>
              </div>
              <div className="adm-action-row">
                {can("work.write") && data.stage === "WAITING_FOR_WORK" && (
                  <button
                    className="adm-btn adm-primary"
                    disabled={busy}
                    onClick={() =>
                      void run(`admin/service-visits/${visit.id}/work/start`, {
                        reason: "Bắt đầu thi công các hạng mục đã duyệt",
                      })
                    }
                  >
                    Bắt đầu thi công
                  </button>
                )}
                {can("work.write") && data.stage === "IN_PROGRESS" && (
                  <button
                    className={`adm-btn ${data.isPaused ? "adm-primary" : ""}`}
                    disabled={busy}
                    onClick={() => {
                      const reason = data.isPaused
                        ? "Tiếp tục thi công sau khi xử lý lý do tạm dừng"
                        : window.prompt("Lý do tạm dừng thi công?");
                      if (reason?.trim())
                        void run(
                          `admin/service-visits/${visit.id}/work/${data.isPaused ? "resume" : "pause"}`,
                          { reason: reason.trim() },
                        );
                    }}
                  >
                    {data.isPaused ? "Tiếp tục thi công" : "Tạm dừng"}
                  </button>
                )}
                <Link
                  className="adm-btn"
                  href={`${path}?tab=bao-gia`}
                  scroll={false}
                >
                  {open ? "Xem báo giá đang xử lý" : "Báo giá & Phát sinh"}
                </Link>
                {data.stage === "IN_PROGRESS" &&
                  !data.isPaused &&
                  can("acceptance.record") && (
                    <button
                      type="button"
                      className={`adm-btn ${can("work.write") && !completionOpen ? "adm-primary" : ""}`}
                      disabled={busy}
                      aria-expanded={completionOpen}
                      aria-controls="hoan-tat-thi-cong"
                      onClick={() => setCompletionOpen(!completionOpen)}
                    >
                      {can("work.write")
                        ? "Hoàn tất thi công"
                        : "Ghi nhận kiểm tra chất lượng"}
                    </button>
                  )}
              </div>
            </div>
          </section>
          {data.stage === "IN_PROGRESS" &&
            !data.isPaused &&
            can("acceptance.record") && (
              <div
                className="adm-panel adv-service-completion"
                hidden={!completionOpen}
              >
                <CompletionForm
                  data={data}
                  run={run}
                  busy={busy}
                  onDirty={onDirty}
                  canFinish={can("work.write")}
                />
              </div>
            )}
          <section className="adm-panel">
            <h2>Phạm vi đã duyệt</h2>
            {data.approvedLines?.length ? (
              <div className="adv-lines">
                {data.approvedLines.map((line) => (
                  <div className="adm-section-line" key={line.id}>
                    <div>
                      <strong>{line.name}</strong>
                      <p className="adm-muted">
                        {formatQuantity(line.quantity)} {line.unit}
                      </p>
                    </div>
                    <strong>{vnd(line.total)}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="adm-muted">Chưa có hạng mục báo giá được duyệt.</p>
            )}
            {data.exemptions.map((item) => (
              <p key={item.id}>Miễn phí · {item.scope}</p>
            ))}
          </section>
          {data.stage === "QUOTING" && (
            <p className="adm-feedback">
              Chốt các hạng mục hoặc phê duyệt công việc miễn phí tại{" "}
              <Link
                className="adm-text-link"
                href={`${path}?tab=bao-gia`}
                scroll={false}
              >
                Báo giá & Phát sinh
              </Link>{" "}
              trước khi bắt đầu thi công.
            </p>
          )}
        </>
      )}
      {area === "vehicle" && (
        <>
          {vehicleContent}
          <section className="adm-panel">
            <h2>Kiểm tra chất lượng</h2>
            {data.requiredChecks?.length ? (
              <ul>
                {data.requiredChecks.map((c) => (
                  <li key={c.key}>{c.label}</li>
                ))}
              </ul>
            ) : (
              <p>Xác nhận hoàn tất công việc trước khi bàn giao.</p>
            )}
            <p>Các kết quả kiểm tra được lưu cùng lịch sử phiếu.</p>
          </section>
        </>
      )}
      {area === "payment" && (
        <>
          {["HANDOVER", "COMPLETED"].includes(data.stage) && (
            <section className="adm-panel">
              <h2>Hạng mục đã thực hiện</h2>
              <div className="adv-lines">
                {data.approvedLines?.map((line) => (
                  <div className="adm-section-line" key={line.id}>
                    <span>
                      {line.name} · {formatQuantity(line.quantity)} {line.unit}
                    </span>
                    <strong>{vnd(line.total)}</strong>
                  </div>
                ))}
              </div>
            </section>
          )}
          <section className="adm-panel">
            <h2>Tổng hợp chi phí</h2>
            <dl className="adm-info-grid">
              {[
                ["Báo giá gốc đã duyệt", data.quoteTotals?.original],
                ["Phát sinh đã duyệt", data.quoteTotals?.extras],
                ["Phát sinh đang chờ", data.quoteTotals?.pending],
                [
                  "Điều chỉnh giảm",
                  data.financialCredits
                    .reduce((sum, c) => sum + BigInt(c.amount), BigInt(0))
                    .toString(),
                ],
                ["Tổng phải thu", data.settlement.total],
                ["Đã thanh toán ròng", data.settlement.netReceived],
                ["Còn phải thu", data.settlement.outstanding],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value == null ? "Chưa xác định" : vnd(value)}</dd>
                </div>
              ))}
            </dl>
          </section>
          <VisitSettlement
            data={data}
            run={run}
            busy={busy}
            onDirty={onDirty}
          />
          <Quality
            data={data}
            staff={staff}
            run={run}
            busy={busy}
            root={root}
            onDirty={onDirty}
            customerName={visit.customer.name}
          />
          {closed && (
            <button className="adm-btn" onClick={() => window.print()}>
              Xem / In phiếu
            </button>
          )}
          {workspace && quoteHistory}
          {historyContent}
        </>
      )}
    </div>
  );
}

function CompletionForm({
  data,
  run,
  busy,
  onDirty,
  canFinish,
}: {
  data: Workflow;
  run: RunWorkflow;
  busy: boolean;
  onDirty: (v: boolean) => void;
  canFinish: boolean;
}) {
  const session = useSession()!;
  const [result, setResult] = useState(""),
    [note, setNote] = useState(""),
    [complete, setComplete] = useState(false),
    [checks, setChecks] = useState<Record<string, boolean>>({});
  const items = data.work?.items.filter((i) => i.status !== "SKIPPED") || [];
  const unfinished = items.some((i) => i.status !== "DONE");
  const quality = {
    inspectorId: session.staff.id,
    result,
    note,
    completionConfirmed: complete,
    checks: items.map((i) => ({
      workItemId: i.id,
      passed: i.status === "DONE",
      note: "",
    })),
    qualityChecks: (data.requiredChecks || []).map((c) => ({
      key: c.key,
      passed: !!checks[c.key],
      note: "",
    })),
  };
  return (
    <section className="adm-panel" id="hoan-tat-thi-cong">
      <h2>Hoàn tất thi công</h2>
      {unfinished && (
        <p className="adm-feedback" role="status">
          Phiếu còn công việc chi tiết chưa hoàn tất. Quản lý cần cập nhật các
          công việc này trong Điều hành trước khi hoàn tất thi công.
        </p>
      )}
      <form
        className="adm-booking-form"
        onChange={() => onDirty(true)}
        onSubmit={(e) => {
          e.preventDefault();
          const finish =
            (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ===
            "finish";
          void run(
            `admin/service-visits/${data.visitId}/${finish ? "work/finish" : "acceptances"}`,
            {
              ...(finish ? { quality } : quality),
              reason: finish
                ? "Hoàn tất thi công và kiểm tra chất lượng"
                : "Ghi nhận kiểm tra chất lượng",
            },
          );
        }}
      >
        <fieldset className="adv-stack adv-checks" disabled={busy}>
          <legend>Người kiểm tra: {session.staff.name}</legend>
          {(data.requiredChecks || []).map((c) => (
            <label key={c.key}>
              <input
                type="checkbox"
                checked={!!checks[c.key]}
                onChange={(e) =>
                  setChecks({ ...checks, [c.key]: e.target.checked })
                }
              />{" "}
              {c.label}
            </label>
          ))}
          <label>
            <input
              type="checkbox"
              checked={complete}
              onChange={(e) => setComplete(e.target.checked)}
              required={result === "PASSED"}
            />{" "}
            Đã thực hiện đầy đủ hạng mục được duyệt, không còn vấn đề kỹ thuật
            hoặc an toàn chưa xử lý
          </label>
          <div className="adm-form-grid">
            <label className="adm-field">
              Kết quả *
              <select
                required
                value={result}
                onChange={(e) => setResult(e.target.value)}
              >
                <option value="">Chọn kết quả</option>
                <option value="PASSED">Đạt yêu cầu</option>
                <option value="NEEDS_WORK">Cần làm lại</option>
              </select>
            </label>
            <label className="adm-field">
              Nhận xét *
              <textarea
                required
                rows={3}
                maxLength={2000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
          </div>
          <div className="adm-action-row">
            <button className="adm-btn" value="record">
              Lưu kết quả kiểm tra
            </button>
            {canFinish && (
              <button
                className="adm-btn adm-primary"
                value="finish"
                disabled={result !== "PASSED" || !complete || unfinished}
              >
                Hoàn tất thi công
              </button>
            )}
          </div>
        </fieldset>
      </form>
    </section>
  );
}
