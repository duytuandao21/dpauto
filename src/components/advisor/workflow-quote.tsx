"use client";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { collection } from "@/lib/api/client";
import type { Part } from "@/lib/api/stock-finance";
import { useSession } from "@/components/admin/auth-gate";
import { quotePreview } from "@/lib/advisor/quote-preview";
import type { ApiService } from "@/lib/api/types";
import { QuoteItems } from "./quote-items";
import {
  quoteDraftBody,
  quoteLabels,
  vnd,
  formatQuantity,
  workflowTime,
  type QuoteRevision,
  type QuoteLine,
  type RunWorkflow,
  type Evidence,
} from "@/lib/api/workflow";

export function EvidenceFields({
  value,
  onChange,
  media = [],
}: {
  value: Evidence;
  onChange: (e: Evidence) => void;
  media?: { id: string; name: string }[];
}) {
  return (
    <div className="adm-form-grid">
      <label className="adm-field">
        Người xác nhận *
        <input
          required
          maxLength={100}
          value={value.customerName}
          onChange={(e) => onChange({ ...value, customerName: e.target.value })}
        />
      </label>
      <label className="adm-field">
        Kênh xác nhận
        <select
          value={value.channel}
          onChange={(e) => onChange({ ...value, channel: e.target.value })}
        >
          {[
            ["IN_PERSON", "Trực tiếp"],
            ["PHONE", "Điện thoại"],
            ["ZALO", "Zalo"],
            ["OTHER", "Khác"],
          ].map(([v, l]) => (
            <option value={v} key={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <label className="adm-field adm-span-full">
        Nội dung xác nhận / căn cứ *
        <textarea
          required
          maxLength={2000}
          rows={3}
          value={value.note}
          onChange={(e) => onChange({ ...value, note: e.target.value })}
        />
      </label>
      {media.length > 0 && (
        <label className="adm-field">
          Ảnh làm căn cứ
          <select
            value={value.mediaId || ""}
            onChange={(e) =>
              onChange({ ...value, mediaId: e.target.value || undefined })
            }
          >
            <option value="">Không đính kèm</option>
            {media.map((m) => (
              <option value={m.id} key={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
type EditableLine = Omit<
  QuoteLine,
  "id" | "subtotal" | "discountTotal" | "taxTotal" | "total"
>;
export function WorkflowQuote({
  revision,
  services,
  run,
  busy,
  root,
  visitId,
  closed,
  onDirty,
  customerName,
  media,
  workflowV2 = false,
  previousQuotes = [],
  approvedAmount,
  detailsOnly = false,
  showDecision = true,
}: {
  revision: QuoteRevision;
  services: ApiService[];
  run: RunWorkflow;
  busy: boolean;
  root: string;
  visitId: string;
  closed: boolean;
  onDirty: (v: boolean) => void;
  customerName: string;
  media: { id: string; name: string }[];
  workflowV2?: boolean;
  previousQuotes?: QuoteRevision[];
  approvedAmount?: string | null;
  detailsOnly?: boolean;
  showDecision?: boolean;
}) {
  const [lines, setLines] = useState<EditableLine[]>(
      revision.lines.map((line) => ({
        ...line,
        quantity: Number(line.quantity).toString(),
      })),
    ),
    [discount, setDiscount] = useState(revision.discountPercent),
    [note, setNote] = useState(revision.note),
    [dirty, setDirty] = useState(false);
  const [decision, setDecision] = useState(""),
    [evidence, setEvidence] = useState<Evidence>({
      customerName,
      channel: "IN_PERSON",
      note: "",
    });
  const permissions = useSession()?.permissions || [];
  const [accepted, setAccepted] = useState<string[]>(
    revision.lines.map((l) => l.id),
  );
  const [voidLines, setVoidLines] = useState<string[]>([]),
    [voidReason, setVoidReason] = useState("");
  const [customerAgreed, setCustomerAgreed] = useState(false);
  const editable =
    revision.status === "DRAFT" &&
    !closed &&
    permissions.includes("quotes.write");
  const [parts, setParts] = useState<Part[]>([]),
    [partsLoading, setPartsLoading] = useState(false),
    [partsError, setPartsError] = useState(""),
    [partsReload, setPartsReload] = useState(0);
  useEffect(() => {
    if (!workflowV2 || !editable) return;
    const controller = new AbortController();
    setPartsLoading(true);
    setPartsError("");
    collection<Part>("admin/stock/parts", controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setParts(value);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setPartsError(error.message || "Không tải được danh mục phụ tùng.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setPartsLoading(false);
      });
    return () => controller.abort();
  }, [editable, workflowV2, partsReload]);
  const draftTotals = editable ? quotePreview(lines, discount) : null;
  const totals = draftTotals || revision;
  const mayCancelApproved =
    permissions.includes("visits.abort") &&
    ((revision.approvedTotal ?? revision.total) === "0" ||
      permissions.includes("payments.refund"));
  const change = () => {
    setDirty(true);
    setCustomerAgreed(false);
    onDirty(true);
  };
  function edit(index: number, patch: Partial<EditableLine>) {
    setLines((v) => v.map((l, i) => (i === index ? { ...l, ...patch } : l)));
    change();
  }
  function add(kind: "SERVICE" | "PART") {
    setLines((v) => [
      ...v,
      {
        kind,
        name: "",
        description: "",
        code: "",
        unit: kind === "SERVICE" ? "Lần" : "",
        quantity: "1",
        unitPrice: "",
        discountPercent: "0",
        vatPercent: "",
      },
    ]);
    change();
  }
  const formId = useId();
  const printButton = (!dirty || !editable) && (
    <Link
      className="adm-btn"
      href={`${root}/phieu-dich-vu/${visitId}/in-bao-gia${workflowV2 ? "" : `?revision=${revision.id}`}`}
      target="_blank"
    >
      In / lưu PDF báo giá
    </Link>
  );
  const cancelButton = workflowV2 &&
    !closed &&
    permissions.includes("quotes.write") &&
    !["REJECTED", "VOIDED"].includes(revision.status) &&
    (revision.status !== "APPROVED" || mayCancelApproved) && (
      <button
        type="button"
        className="adm-btn adm-subtle-danger"
        disabled={busy}
        onClick={() => {
          const reason = window.prompt(
            "Lý do hủy báo giá/phạm vi chưa thực hiện?",
          );
          if (
            reason?.trim() &&
            (revision.status !== "APPROVED" ||
              window.confirm(
                "Xác nhận toàn bộ hạng mục trong báo giá này chưa được thực hiện?",
              ))
          )
            void run(`admin/quote-revisions/${revision.id}/void`, {
              reason: reason.trim(),
              ...(revision.status === "APPROVED"
                ? { unperformedConfirmed: true }
                : {}),
            });
        }}
      >
        {revision.kind === "CHANGE_ORDER"
          ? "Hủy hạng mục bổ sung"
          : "Hủy báo giá"}
      </button>
    );
  return (
    <div className="adv-stack">
      {detailsOnly && (
        <QuoteItems
          revision={revision}
          lines={revision.lines}
          discount={revision.discountPercent}
          services={services}
          editable={false}
          edit={edit}
          remove={() => {}}
          add={add}
        />
      )}
      {!detailsOnly && (
        <section className="adm-panel adv-quote-editor">
          {partsLoading && (
            <p className="adm-muted" role="status">
              Đang tải danh mục phụ tùng…
            </p>
          )}
          {partsError && (
            <p className="adm-error-text" role="alert">
              {partsError}{" "}
              <button
                type="button"
                className="adm-btn"
                disabled={partsLoading || busy}
                onClick={() => setPartsReload((value) => value + 1)}
              >
                Tải lại phụ tùng
              </button>
            </p>
          )}
          <div className="adm-section-line">
            <h2>
              {workflowV2
                ? "Báo giá dịch vụ"
                : `Báo giá lần ${revision.revisionNo}`}
            </h2>
            <span
              className={`adm-badge adm-status-${revision.status === "APPROVED" ? "confirmed" : revision.status === "REJECTED" ? "cancelled" : "pending"}`}
            >
              {workflowV2 && revision.status === "DRAFT"
                ? "Đang soạn"
                : quoteLabels[revision.status]}
            </span>
          </div>
          {editable ? (
            <form
              id={formId}
              className="adm-booking-form"
              onSubmit={(e) => {
                e.preventDefault();
                const close =
                  workflowV2 &&
                  (e.nativeEvent as SubmitEvent).submitter?.getAttribute(
                    "value",
                  ) === "close";
                if (
                  busy ||
                  (workflowV2 && partsLoading) ||
                  (close &&
                    (!customerAgreed || !permissions.includes("quotes.decide")))
                )
                  return;
                void run(
                  `admin/quote-revisions/${revision.id}${close ? "/close" : ""}`,
                  {
                    ...quoteDraftBody({
                      discountPercent: discount,
                      note,
                      lines,
                    }),
                    ...(close
                      ? {
                          evidence: {
                            customerName,
                            channel: "OTHER",
                            note: "Cố vấn ghi nhận khách đã đồng ý toàn bộ hạng mục đang soạn và chi phí trên.",
                          },
                        }
                      : {}),
                    reason: close
                      ? "Khách đã xác nhận đồng ý báo giá"
                      : "Lưu bản nháp báo giá",
                  },
                  close ? "POST" : "PATCH",
                );
              }}
            >
              <fieldset
                disabled={busy || (workflowV2 && partsLoading)}
                className="adv-stack adv-checks"
              >
                <legend>Hạng mục báo giá</legend>
                <fieldset className="adv-stack adv-quote-draft-fields">
                  <legend className="adv-sr-only">
                    Chi tiết hạng mục và chi phí
                  </legend>
                  {workflowV2 ? (
                    <QuoteItems
                      revision={revision}
                      previous={previousQuotes}
                      lines={lines}
                      discount={discount}
                      services={services}
                      parts={parts}
                      partsLoading={partsLoading}
                      editable={editable}
                      edit={edit}
                      remove={(index) => {
                        setLines(lines.filter((_, i) => i !== index));
                        change();
                      }}
                      add={add}
                    />
                  ) : (
                    <>
                      <div className="adv-lines">
                        {lines.map((l, i) => (
                          <article className="adv-line" key={i}>
                            <div
                              className={
                                root === "/co-van"
                                  ? "adv-line-head"
                                  : "adm-section-line"
                              }
                            >
                              <strong>
                                {i + 1}.{" "}
                                {l.kind === "SERVICE" ? "Dịch vụ" : "Phụ tùng"}
                              </strong>
                              <button
                                type="button"
                                className="adm-btn adm-btn-sm adm-subtle-danger"
                                onClick={() => {
                                  setLines(lines.filter((_, n) => n !== i));
                                  change();
                                }}
                              >
                                Xóa
                              </button>
                            </div>
                            <div
                              className={
                                root === "/co-van"
                                  ? "adv-line-fields"
                                  : "adm-form-grid"
                              }
                            >
                              {l.kind === "SERVICE" && (
                                <label
                                  className={`adm-field ${root === "/co-van" ? "adv-line-name" : ""}`}
                                >
                                  Gói dịch vụ *
                                  <select
                                    required
                                    value={l.serviceId || ""}
                                    onChange={(e) => {
                                      const s = services.find(
                                        (s) => s.id === e.target.value,
                                      );
                                      edit(i, {
                                        serviceId: e.target.value,
                                        name: s?.name || "",
                                        code: s?.code || "",
                                      });
                                    }}
                                  >
                                    <option value="">Chọn dịch vụ</option>
                                    {services
                                      .filter((s) => s.active && s.bookable)
                                      .map((s) => (
                                        <option key={s.id} value={s.id}>
                                          {s.name}
                                        </option>
                                      ))}
                                  </select>
                                </label>
                              )}
                              <label
                                className={`adm-field ${root === "/co-van" ? "adv-line-name" : ""}`}
                              >
                                Tên hạng mục *
                                <input
                                  required
                                  maxLength={160}
                                  value={l.name}
                                  onChange={(e) =>
                                    edit(i, { name: e.target.value })
                                  }
                                />
                              </label>
                              <label className="adm-field">
                                Mã
                                <input
                                  maxLength={60}
                                  value={l.code}
                                  onChange={(e) =>
                                    edit(i, { code: e.target.value })
                                  }
                                />
                              </label>
                              <label className="adm-field">
                                Đơn vị *
                                <input
                                  required
                                  maxLength={30}
                                  value={l.unit}
                                  onChange={(e) =>
                                    edit(i, { unit: e.target.value })
                                  }
                                />
                              </label>
                              <label className="adm-field">
                                Số lượng *
                                <input
                                  required
                                  type="number"
                                  min="0.001"
                                  max="9999999.999"
                                  step="0.001"
                                  value={l.quantity}
                                  onChange={(e) =>
                                    edit(i, { quantity: e.target.value })
                                  }
                                />
                              </label>
                              <label className="adm-field">
                                Đơn giá (VND) *
                                <input
                                  required
                                  inputMode="numeric"
                                  pattern="[0-9]{1,15}"
                                  value={l.unitPrice}
                                  onChange={(e) =>
                                    edit(i, { unitPrice: e.target.value })
                                  }
                                />
                              </label>
                              <label className="adm-field">
                                Chiết khấu (%)
                                <input
                                  required
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.01"
                                  value={l.discountPercent}
                                  onChange={(e) =>
                                    edit(i, { discountPercent: e.target.value })
                                  }
                                />
                              </label>
                              <label className="adm-field">
                                Thuế suất (%) *
                                <input
                                  required
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.01"
                                  value={l.vatPercent}
                                  onChange={(e) =>
                                    edit(i, { vatPercent: e.target.value })
                                  }
                                />
                              </label>
                            </div>
                          </article>
                        ))}
                      </div>
                      <div className="adm-action-row">
                        <button
                          type="button"
                          className="adm-btn"
                          onClick={() => add("SERVICE")}
                        >
                          Thêm dịch vụ
                        </button>
                        <button
                          type="button"
                          className="adm-btn"
                          onClick={() => add("PART")}
                        >
                          Thêm phụ tùng
                        </button>
                      </div>
                    </>
                  )}
                  <label className="adm-field">
                    Chiết khấu chung (%)
                    <input
                      required
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={discount}
                      onChange={(e) => {
                        setDiscount(e.target.value);
                        change();
                      }}
                    />
                  </label>
                  <label className="adm-field">
                    Ghi chú báo giá
                    <textarea
                      rows={3}
                      maxLength={2000}
                      value={note}
                      onChange={(e) => {
                        setNote(e.target.value);
                        change();
                      }}
                    />
                  </label>
                  {workflowV2 && (
                    <dl className="adv-money-list">
                      <div>
                        <dt>Cộng tiền đang soạn</dt>
                        <dd>{draftTotals ? vnd(totals.subtotal) : "—"}</dd>
                      </div>
                      <div>
                        <dt>Chiết khấu</dt>
                        <dd>{draftTotals ? vnd(totals.discountTotal) : "—"}</dd>
                      </div>
                      <div>
                        <dt>VAT</dt>
                        <dd>{draftTotals ? vnd(totals.taxTotal) : "—"}</dd>
                      </div>
                      <div className="adv-money-total">
                        <dt>Thành tiền đang soạn</dt>
                        <dd>{draftTotals ? vnd(totals.total) : "—"}</dd>
                      </div>
                    </dl>
                  )}
                </fieldset>
                {!workflowV2 && (
                  <div className="adm-action-row">
                    <button className="adm-btn" disabled={!lines.length}>
                      {workflowV2 ? "Lưu nháp" : "Lưu báo giá"}
                    </button>
                  </div>
                )}
              </fieldset>
            </form>
          ) : (
            <>
              {workflowV2 ? (
                <QuoteItems
                  revision={revision}
                  previous={previousQuotes}
                  lines={revision.lines}
                  discount={discount}
                  services={services}
                  editable={false}
                  edit={edit}
                  remove={() => {}}
                  add={add}
                />
              ) : (
                <>
                  <div className="adv-lines">
                    {revision.lines.map((l) => (
                      <article className="adv-line" key={l.id}>
                        <strong>{l.name}</strong>
                        <p>
                          {formatQuantity(l.quantity)} {l.unit} ×{" "}
                          {vnd(l.unitPrice)}
                        </p>
                        <p>
                          Chiết khấu {l.discountPercent}% · Thuế suất{" "}
                          {l.vatPercent}%
                        </p>
                        <strong>{vnd(l.total)}</strong>
                      </article>
                    ))}
                  </div>
                </>
              )}
              {revision.note && <p>{revision.note}</p>}
            </>
          )}
          {!workflowV2 && (
            <dl className="adm-info-grid">
              <div>
                <dt>{dirty ? "Cộng tiền bản đã lưu" : "Cộng tiền"}</dt>
                <dd>{vnd(totals.subtotal)}</dd>
              </div>
              <div>
                <dt>Chiết khấu</dt>
                <dd>{vnd(totals.discountTotal)}</dd>
              </div>
              <div>
                <dt>Thuế</dt>
                <dd>{vnd(totals.taxTotal)}</dd>
              </div>
              <div>
                <dt>Tổng báo giá</dt>
                <dd>
                  <strong>{vnd(totals.total)}</strong>
                </dd>
              </div>
            </dl>
          )}
          {workflowV2 && (
            <dl className="adv-money-list adv-quote-summary">
              <div>
                <dt>Đã chốt</dt>
                <dd>
                  {approvedAmount == null ? "Chưa chốt" : vnd(approvedAmount)}
                </dd>
              </div>
              <div>
                <dt>
                  {editable ? "Đang soạn, chưa chốt" : "Chờ khách đồng ý"}
                </dt>
                <dd>
                  {["DRAFT", "SUBMITTED", "PENDING_APPROVAL"].includes(
                    revision.status,
                  )
                    ? editable && !draftTotals
                      ? "—"
                      : vnd(totals.total)
                    : vnd("0")}
                </dd>
              </div>
              <div className="adv-money-total">
                <dt>Tổng dự kiến</dt>
                <dd>
                  {editable && !draftTotals
                    ? "—"
                    : vnd(
                        String(
                          BigInt(approvedAmount || "0") +
                            ([
                              "DRAFT",
                              "SUBMITTED",
                              "PENDING_APPROVAL",
                            ].includes(revision.status)
                              ? BigInt(totals.total)
                              : BigInt(0)),
                        ),
                      )}
                </dd>
              </div>
            </dl>
          )}
          {editable && !workflowV2 && (
            <button
              className="adm-btn adm-primary"
              disabled={busy || dirty || !revision.lines.length}
              onClick={() => {
                if (
                  window.confirm(
                    "Gửi và cố định bản báo giá này để khách xác nhận?",
                  )
                )
                  void run(`admin/quote-revisions/${revision.id}/submit`, {
                    reason: "Gửi báo giá cho khách xác nhận",
                  });
              }}
            >
              Gửi khách xác nhận
            </button>
          )}
          {!(workflowV2 && editable) && printButton}
          {workflowV2 && editable && (
            <>
              {permissions.includes("quotes.decide") && (
                <label className="adv-quote-consent">
                  <input
                    type="checkbox"
                    form={formId}
                    checked={customerAgreed}
                    disabled={busy || partsLoading}
                    onChange={(e) => {
                      setCustomerAgreed(e.target.checked);
                      onDirty(true);
                    }}
                  />
                  Khách đã đồng ý toàn bộ hạng mục đang soạn và chi phí trên
                </label>
              )}
              <div className="adv-quote-actions" aria-label="Thao tác báo giá">
                {cancelButton}
                {printButton}
                <button
                  type="submit"
                  value="draft"
                  form={formId}
                  className="adm-btn"
                  disabled={busy || partsLoading || !lines.length}
                >
                  Lưu nháp
                </button>
                {permissions.includes("quotes.decide") && (
                  <button
                    type="submit"
                    value="close"
                    form={formId}
                    className="adm-btn adm-primary"
                    disabled={
                      busy || partsLoading || !lines.length || !customerAgreed
                    }
                  >
                    Chốt báo giá
                  </button>
                )}
              </div>
            </>
          )}
        </section>
      )}
      {["SUBMITTED", "PENDING_APPROVAL"].includes(revision.status) &&
        !closed &&
        permissions.includes("quotes.decide") && (
          <section className="adm-panel">
            <h2>Ghi nhận quyết định của khách</h2>
            <form
              className="adm-booking-form"
              onSubmit={(e) => {
                e.preventDefault();
                void run(`admin/quote-revisions/${revision.id}/decision`, {
                  decision,
                  evidence,
                  ...(workflowV2 && decision === "APPROVED"
                    ? { approvedLineIds: accepted }
                    : {}),
                  reason: "Ghi nhận quyết định của khách cho đúng bản báo giá",
                });
              }}
            >
              <fieldset className="adv-stack adv-checks" disabled={busy}>
                <legend>
                  {workflowV2
                    ? "Xác nhận hạng mục đang chờ"
                    : `Quyết định báo giá lần ${revision.revisionNo}`}
                </legend>
                <label className="adm-field">
                  Kết quả *
                  <select
                    required
                    value={decision}
                    onChange={(e) => {
                      setDecision(e.target.value);
                      onDirty(true);
                    }}
                  >
                    <option value="">Chọn quyết định</option>
                    <option value="APPROVED">Khách đồng ý</option>
                    <option value="REJECTED">Khách từ chối</option>
                  </select>
                </label>
                {workflowV2 && decision === "APPROVED" && (
                  <fieldset className="adv-checks">
                    <legend>Hạng mục khách đồng ý</legend>
                    {revision.lines.map((l) => (
                      <label key={l.id}>
                        <input
                          type="checkbox"
                          checked={accepted.includes(l.id)}
                          onChange={(e) => {
                            setAccepted(
                              e.target.checked
                                ? [...accepted, l.id]
                                : accepted.filter((id) => id !== l.id),
                            );
                            onDirty(true);
                          }}
                        />{" "}
                        {l.name} · {vnd(l.total)}
                      </label>
                    ))}
                  </fieldset>
                )}
                <EvidenceFields
                  value={evidence}
                  onChange={(v) => {
                    setEvidence(v);
                    onDirty(true);
                  }}
                  media={media}
                />
                <button
                  className="adm-btn adm-primary"
                  disabled={decision === "APPROVED" && !accepted.length}
                >
                  {workflowV2 && decision === "APPROVED"
                    ? "Chốt báo giá"
                    : "Lưu quyết định"}
                </button>
              </fieldset>
            </form>
          </section>
        )}
      {showDecision && revision.decision && (
        <section className="adm-panel">
          <h2>Quyết định đã ghi nhận</h2>
          <p>
            {revision.decision.customerName} ·{" "}
            {workflowTime(revision.decision.recordedAt)}
          </p>
          <p>{revision.decision.evidenceNote}</p>
          {revision.voidedLineIds?.length ? (
            <p className="adm-muted">
              Đã hủy phạm vi:{" "}
              {revision.lines
                .filter((l) => revision.voidedLineIds!.includes(l.id))
                .map((l) => l.name)
                .join(", ")}
              . Đối chiếu điều chỉnh tiền trên phiếu.
            </p>
          ) : null}
          {revision.approvedTotal != null && (
            <p>
              Giá trị được duyệt: <strong>{vnd(revision.approvedTotal)}</strong>
            </p>
          )}
          {revision.decision.approvedLineIds &&
            revision.lines
              .filter(
                (l) => !revision.decision!.approvedLineIds!.includes(l.id),
              )
              .map((l) => (
                <p key={l.id} className="adm-muted">
                  Không duyệt: {l.name}
                </p>
              ))}
        </section>
      )}
      {(!editable || detailsOnly) && cancelButton}
      {workflowV2 &&
        !closed &&
        revision.status === "APPROVED" &&
        mayCancelApproved && (
          <details className="adm-panel">
            <summary>Hủy hạng mục chưa thực hiện</summary>
            <form
              className="adm-booking-form"
              onSubmit={(e) => {
                e.preventDefault();
                void run(`admin/quote-revisions/${revision.id}/void`, {
                  lineIds: voidLines,
                  unperformedConfirmed: true,
                  reason: voidReason,
                });
              }}
            >
              <fieldset className="adv-stack adv-checks" disabled={busy}>
                <legend>Chọn hạng mục cần hủy</legend>
                {revision.lines
                  .filter(
                    (l) =>
                      (!revision.decision?.approvedLineIds ||
                        revision.decision.approvedLineIds.includes(l.id)) &&
                      !revision.voidedLineIds?.includes(l.id),
                  )
                  .map((l) => (
                    <label key={l.id}>
                      <input
                        type="checkbox"
                        checked={voidLines.includes(l.id)}
                        onChange={(e) => {
                          setVoidLines(
                            e.target.checked
                              ? [...voidLines, l.id]
                              : voidLines.filter((id) => id !== l.id),
                          );
                          onDirty(true);
                        }}
                      />{" "}
                      {l.name} · {vnd(l.total)}
                    </label>
                  ))}
                <label className="adm-field">
                  Lý do và căn cứ *
                  <textarea
                    required
                    rows={2}
                    maxLength={400}
                    value={voidReason}
                    onChange={(e) => {
                      setVoidReason(e.target.value);
                      onDirty(true);
                    }}
                  />
                </label>
                <label>
                  <input
                    type="checkbox"
                    required
                    onChange={() => onDirty(true)}
                  />{" "}
                  Xác nhận các hạng mục đã chọn chưa được thực hiện, đã xử lý
                  phụ tùng liên quan
                </label>
                <button
                  className="adm-btn adm-subtle-danger"
                  disabled={!voidLines.length}
                >
                  Hủy hạng mục đã chọn
                </button>
              </fieldset>
            </form>
          </details>
        )}
    </div>
  );
}
