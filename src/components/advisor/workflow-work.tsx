"use client";
import { useState } from "react";
import type { ApiStaff } from "@/lib/api/types";
import { stationTime } from "@/lib/api/types";
import {
  itemLabels,
  workLabels,
  stationInstant,
  workflowTime,
  type Workflow,
  type WorkItem,
  type RunWorkflow,
} from "@/lib/api/workflow";

function ItemForm({
  data,
  item,
  technicians,
  run,
  busy,
  onDirty,
}: {
  data: Workflow;
  item?: WorkItem;
  technicians: ApiStaff[];
  run: RunWorkflow;
  busy: boolean;
  onDirty: (v: boolean) => void;
}) {
  const [label, setLabel] = useState(item?.label || ""),
    [due, setDue] = useState(item ? stationTime(item.dueAt).slice(0, 16) : "");
  const [people, setPeople] = useState(
      item?.technicians.map((t) => t.id) || [],
    ),
    [reference, setReference] = useState(
      item?.quoteLineId
        ? "line:" + item.quoteLineId
        : item?.exemptionId
          ? "free:" + item.exemptionId
          : "",
    );
  const sources = data.quotes
    .filter((q) => q.status === "APPROVED")
    .flatMap((q) =>
      q.lines
        .filter((l) => l.kind === "SERVICE")
        .map((l) => ({ ...l, revisionNo: q.revisionNo })),
    );
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!people.length) return;
    const [kind, id] = reference.split(":");
    await run(
      item
        ? `admin/work-items/${item.id}`
        : `admin/service-visits/${data.visitId}/work-items`,
      {
        label,
        technicianIds: people,
        dueAt: stationInstant(due),
        quoteLineId: kind === "line" ? id : item ? null : undefined,
        exemptionId: kind === "free" ? id : item ? null : undefined,
        reason: item
          ? "Cập nhật kế hoạch công việc"
          : "Lập công việc và phân công kỹ thuật viên",
      },
      item ? "PATCH" : "POST",
    );
  }
  return (
    <form className="adm-booking-form" onSubmit={save}>
      <fieldset disabled={busy} className="adv-stack adv-checks">
        <legend>{item ? "Chỉnh công việc" : "Công việc mới"}</legend>
        <div className="adm-form-grid">
          <label className="adm-field">
            Tên công việc *
            <input
              required
              maxLength={200}
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
                onDirty(true);
              }}
            />
          </label>
          <label className="adm-field">
            Căn cứ thực hiện
            <select
              value={reference}
              onChange={(e) => {
                setReference(e.target.value);
                onDirty(true);
              }}
            >
              <option value="">Chưa liên kết</option>
              {sources.map((s) => (
                <option key={s.id} value={"line:" + s.id}>
                  Báo giá {s.revisionNo} · {s.name}
                </option>
              ))}
              {data.exemptions.map((x) => (
                <option value={"free:" + x.id} key={x.id}>
                  Miễn phí · {x.scope}
                </option>
              ))}
            </select>
          </label>
          <label className="adm-field">
            Dự kiến xong (giờ Việt Nam) *
            <input
              required
              type="datetime-local"
              value={due}
              onChange={(e) => {
                setDue(e.target.value);
                onDirty(true);
              }}
            />
          </label>
        </div>
        <fieldset className="adv-checks">
          <legend>Kỹ thuật viên *</legend>
          <div className="adv-check-grid">
            {technicians.map((t) => (
              <label key={t.id}>
                <input
                  type="checkbox"
                  checked={people.includes(t.id)}
                  onChange={(e) => {
                    setPeople(
                      e.target.checked
                        ? [...people, t.id]
                        : people.filter((id) => id !== t.id),
                    );
                    onDirty(true);
                  }}
                />
                {t.name}
              </label>
            ))}
          </div>
          {!technicians.length && <p>Chưa có kỹ thuật viên đang hoạt động.</p>}
        </fieldset>
        <button className="adm-btn adm-primary" disabled={!people.length}>
          {item ? "Lưu công việc" : "Thêm công việc"}
        </button>
      </fieldset>
    </form>
  );
}
export function WorkflowWork({
  data,
  technicians,
  run,
  busy,
  onDirty,
}: {
  data: Workflow;
  technicians: ApiStaff[];
  run: RunWorkflow;
  busy: boolean;
  onDirty: (v: boolean) => void;
}) {
  const [note, setNote] = useState("");
  const w = data.work,
    closed = !data.allowedActions.length;
  const done =
    w?.items.filter((i) => ["DONE", "SKIPPED"].includes(i.status)).length || 0;
  function command(action: string) {
    const reason =
      action === "pause"
        ? window.prompt("Lý do tạm dừng?")
        : "Ghi nhận " +
          (
            {
              start: "bắt đầu thi công",
              resume: "tiếp tục thi công",
              finish: "hoàn tất công việc thực tế",
            } as Record<string, string>
          )[action];
    if (reason?.trim())
      void run(`admin/service-visits/${data.visitId}/work/${action}`, {
        reason: reason.trim(),
      });
  }
  return (
    <div className="adv-stack">
      <section className="adm-panel">
        <div className="adm-section-line">
          <h2>Thi công</h2>
          <span className="adm-badge">
            {w ? workLabels[w.status] : "Chưa lập công việc"}
          </span>
        </div>
        <p>
          {done}/{w?.items.length || 0} công việc đã xử lý
        </p>
        <div className="adm-action-row">
          {!closed && w?.status === "NOT_STARTED" && (
            <button
              className="adm-btn adm-primary"
              disabled={busy || data.stage !== "INSPECTED"}
              onClick={() => command("start")}
            >
              Bắt đầu thi công
            </button>
          )}
          {!closed && w?.status === "IN_PROGRESS" && (
            <>
              <button
                className="adm-btn"
                disabled={busy}
                onClick={() => command("pause")}
              >
                Tạm dừng
              </button>
              <button
                className="adm-btn adm-primary"
                disabled={busy || done !== w.items.length || !done}
                onClick={() => command("finish")}
              >
                Chuyển nghiệm thu
              </button>
            </>
          )}
          {!closed && w?.status === "PAUSED" && (
            <button
              className="adm-btn adm-primary"
              disabled={busy}
              onClick={() => command("resume")}
            >
              Tiếp tục thi công
            </button>
          )}
        </div>
      </section>
      <section className="adm-panel">
        <h2>Danh sách công việc</h2>
        <div className="adv-lines">
          {w?.items.map((i) => (
            <article className="adv-line" key={i.id}>
              <div className="adm-section-line">
                <h3>{i.label}</h3>
                <span
                  className={`adm-badge adm-status-${i.status === "DONE" ? "completed" : i.status === "IN_PROGRESS" ? "arrived" : "pending"}`}
                >
                  {itemLabels[i.status]}
                </span>
              </div>
              <p>
                {i.technicians.map((t) => t.name).join(", ") ||
                  "Chưa phân công"}
              </p>
              <p>Dự kiến {workflowTime(i.dueAt)}</p>
              {!closed && w.status === "IN_PROGRESS" && (
                <div className="adm-action-row">
                  {i.status === "PENDING" && (
                    <button
                      className="adm-btn"
                      disabled={busy}
                      onClick={() =>
                        void run(`admin/work-items/${i.id}/progress`, {
                          status: "IN_PROGRESS",
                          reason: "Bắt đầu thực hiện công việc",
                        })
                      }
                    >
                      Bắt đầu
                    </button>
                  )}
                  {i.status === "IN_PROGRESS" && (
                    <button
                      className="adm-btn adm-primary"
                      disabled={busy}
                      onClick={() =>
                        void run(`admin/work-items/${i.id}/progress`, {
                          status: "DONE",
                          reason: "Đã hoàn tất công việc thực tế",
                        })
                      }
                    >
                      Đánh dấu đã xong
                    </button>
                  )}
                </div>
              )}
              {!closed && i.status === "PENDING" && (
                <>
                  <details className="adv-advanced">
                    <summary className="adm-btn">Điều chỉnh công việc</summary>
                    <ItemForm
                      data={data}
                      item={i}
                      technicians={technicians}
                      run={run}
                      busy={busy}
                      onDirty={onDirty}
                    />
                  </details>
                  {data.allowedActions.includes("abort") &&
                    w.status === "IN_PROGRESS" && (
                      <button
                        className="adm-btn adm-subtle-danger"
                        disabled={busy}
                        onClick={() => {
                          const reason = window.prompt(
                            "Lý do bỏ qua công việc chưa thực hiện? Phạm vi báo giá đã duyệt vẫn phải được đáp ứng.",
                          );
                          if (reason?.trim())
                            void run(`admin/work-items/${i.id}/progress`, {
                              status: "SKIPPED",
                              reason: reason.trim(),
                            });
                        }}
                      >
                        Bỏ qua công việc
                      </button>
                    )}
                </>
              )}
            </article>
          )) || <p>Chưa có công việc.</p>}
        </div>
      </section>
      {!closed && (
        <section className="adm-panel">
          <h2>Thêm công việc</h2>
          <ItemForm
            data={data}
            technicians={technicians}
            run={run}
            busy={busy}
            onDirty={onDirty}
          />
        </section>
      )}
      <section className="adm-panel">
        <h2>Nhật ký thi công</h2>
        {!closed && w && ["IN_PROGRESS", "PAUSED"].includes(w.status) && (
          <form
            className="adm-booking-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(`admin/service-visits/${data.visitId}/work/log`, {
                note,
                reason: "Ghi nhận nhật ký thi công thực tế",
              });
            }}
          >
            <label className="adm-field">
              Nội dung *
              <textarea
                required
                maxLength={2000}
                value={note}
                rows={3}
                onChange={(e) => {
                  setNote(e.target.value);
                  onDirty(true);
                }}
              />
            </label>
            <button className="adm-btn" disabled={busy}>
              Lưu nhật ký
            </button>
          </form>
        )}
        <ol className="adm-timeline">
          {w?.logs.map((l) => (
            <li key={l.id}>
              <i />
              <div>
                <strong>{l.note}</strong>
                <time>{workflowTime(l.occurredAt)}</time>
              </div>
            </li>
          ))}
        </ol>
        {w && w.logs.length === 100 && (
          <p className="adm-muted">
            100 nhật ký gần nhất. Lịch sử đầy đủ nằm trong dòng thời gian phiếu.
          </p>
        )}
      </section>
    </div>
  );
}
