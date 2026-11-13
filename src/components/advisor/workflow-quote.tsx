"use client";
import Link from "next/link";
import { useState } from "react";
import type { ApiService } from "@/lib/api/types";
import {
  quoteDraftBody,
  quoteLabels,
  vnd,
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
}) {
  const [lines, setLines] = useState<EditableLine[]>(revision.lines),
    [discount, setDiscount] = useState(revision.discountPercent),
    [note, setNote] = useState(revision.note),
    [dirty, setDirty] = useState(false);
  const [decision, setDecision] = useState(""),
    [evidence, setEvidence] = useState<Evidence>({
      customerName,
      channel: "IN_PERSON",
      note: "",
    });
  const editable = revision.status === "DRAFT" && !closed;
  const change = () => {
    setDirty(true);
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
  return (
    <div className="adv-stack">
      <section className="adm-panel">
        <div className="adm-section-line">
          <h2>
            Báo giá lần {revision.revisionNo}
            {revision.kind === "CHANGE_ORDER" ? " · Phát sinh" : ""}
          </h2>
          <span
            className={`adm-badge adm-status-${revision.status === "APPROVED" ? "confirmed" : revision.status === "REJECTED" ? "cancelled" : "pending"}`}
          >
            {quoteLabels[revision.status]}
          </span>
        </div>
        {editable ? (
          <form
            className="adm-booking-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(
                `admin/quote-revisions/${revision.id}`,
                {
                  ...quoteDraftBody({ discountPercent: discount, note, lines }),
                  reason: "Lưu bản nháp báo giá",
                },
                "PATCH",
              );
            }}
          >
            <fieldset disabled={busy} className="adv-stack adv-checks">
              <legend>Hạng mục báo giá</legend>
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
                        {i + 1}. {l.kind === "SERVICE" ? "Dịch vụ" : "Phụ tùng"}
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
                        root === "/co-van" ? "adv-line-fields" : "adm-form-grid"
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
                          onChange={(e) => edit(i, { name: e.target.value })}
                        />
                      </label>
                      <label className="adm-field">
                        Mã
                        <input
                          maxLength={60}
                          value={l.code}
                          onChange={(e) => edit(i, { code: e.target.value })}
                        />
                      </label>
                      <label className="adm-field">
                        Đơn vị *
                        <input
                          required
                          maxLength={30}
                          value={l.unit}
                          onChange={(e) => edit(i, { unit: e.target.value })}
                        />
                      </label>
                      <label className="adm-field">
                        Số lượng *
                        <input
                          required
                          type="number"
                          min="0.001"
                          step="0.001"
                          readOnly={l.kind === "SERVICE"}
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
              <button className="adm-btn adm-primary" disabled={!lines.length}>
                Lưu báo giá
              </button>
            </fieldset>
          </form>
        ) : (
          <>
            <div className="adv-lines">
              {revision.lines.map((l) => (
                <article className="adv-line" key={l.id}>
                  <strong>{l.name}</strong>
                  <p>
                    {l.quantity} {l.unit} × {vnd(l.unitPrice)}
                  </p>
                  <p>
                    Chiết khấu {l.discountPercent}% · Thuế suất {l.vatPercent}%
                  </p>
                  <strong>{vnd(l.total)}</strong>
                </article>
              ))}
            </div>
            {revision.note && <p>{revision.note}</p>}
          </>
        )}
        <dl className="adm-info-grid">
          <div>
            <dt>{dirty ? "Cộng tiền bản đã lưu" : "Cộng tiền"}</dt>
            <dd>{vnd(revision.subtotal)}</dd>
          </div>
          <div>
            <dt>Chiết khấu</dt>
            <dd>{vnd(revision.discountTotal)}</dd>
          </div>
          <div>
            <dt>Thuế</dt>
            <dd>{vnd(revision.taxTotal)}</dd>
          </div>
          <div>
            <dt>Tổng báo giá</dt>
            <dd>
              <strong>{vnd(revision.total)}</strong>
            </dd>
          </div>
        </dl>
        {editable && (
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
        {revision.status !== "DRAFT" && (
          <Link
            className="adm-btn"
            href={`${root}/phieu-dich-vu/${visitId}/in-bao-gia?revision=${revision.id}`}
            target="_blank"
          >
            In / lưu PDF báo giá
          </Link>
        )}
      </section>
      {revision.status === "SUBMITTED" && !closed && (
        <section className="adm-panel">
          <h2>Ghi nhận quyết định của khách</h2>
          <form
            className="adm-booking-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(`admin/quote-revisions/${revision.id}/decision`, {
                decision,
                evidence,
                reason: "Ghi nhận quyết định của khách cho đúng bản báo giá",
              });
            }}
          >
            <fieldset className="adv-stack adv-checks" disabled={busy}>
              <legend>Quyết định báo giá lần {revision.revisionNo}</legend>
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
              <EvidenceFields
                value={evidence}
                onChange={(v) => {
                  setEvidence(v);
                  onDirty(true);
                }}
                media={media}
              />
              <button className="adm-btn adm-primary">Lưu quyết định</button>
            </fieldset>
          </form>
        </section>
      )}
      {revision.decision && (
        <section className="adm-panel">
          <h2>Quyết định đã ghi nhận</h2>
          <p>
            {revision.decision.customerName} ·{" "}
            {workflowTime(revision.decision.recordedAt)}
          </p>
          <p>{revision.decision.evidenceNote}</p>
        </section>
      )}
    </div>
  );
}
