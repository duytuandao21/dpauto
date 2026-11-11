"use client";

import { useState } from "react";
import { formatDate, timeLabel } from "@/lib/booking/logic";
import type { ServiceOrder } from "@/lib/advisor/types";
import { useAdvisor } from "./advisor-provider";
import { withEvent } from "./order-common";

export function WorkEditor({ order }: { order: ServiceOrder }) {
  const { saveOrder } = useAdvisor();
  const [work, setWork] = useState(order.work);
  const [log, setLog] = useState("");
  const [error, setError] = useState("");
  const locked = order.stage === "done";
  const overdue =
    work.dueAt &&
    new Date(work.dueAt).getTime() < Date.now() &&
    order.stage !== "done";
  const checked = work.checklist.filter((item) => item.done).length;

  function persist(
    nextWork = work,
    stage = order.stage,
    label = "Cập nhật tiến độ",
  ) {
    const next = withEvent(
      { ...order, stage, work: nextWork },
      label,
      `${nextWork.progress}% · ${nextWork.technician || "Chưa phân công"}`,
    );
    saveOrder(next, label);
  }
  function start() {
    if (order.quote.status !== "confirmed") {
      setError("Cần ghi nhận khách xác nhận báo giá trước khi thi công.");
      return;
    }
    if (!work.technician.trim() || !work.dueAt) {
      setError("Chọn kỹ thuật viên và thời gian dự kiến hoàn thành.");
      return;
    }
    if (!window.confirm("Bắt đầu thi công cho phiếu này?")) return;
    persist(
      { ...work, startedAt: new Date().toISOString() },
      "work",
      "Bắt đầu thi công",
    );
    setError("");
  }
  function addLog() {
    if (!log.trim()) {
      setError("Nhập nội dung nhật ký.");
      return;
    }
    const entry = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      label: "Nhật ký thi công",
      detail: log.trim(),
    };
    const nextWork = { ...work, logs: [...work.logs, entry] };
    setWork(nextWork);
    persist(nextWork, order.stage, "Cập nhật nhật ký thi công");
    setLog("");
    setError("");
  }
  function finish() {
    if (work.progress < 100 || work.checklist.some((item) => !item.done)) {
      setError(
        "Hoàn tất 100% tiến độ và đánh dấu đủ hạng mục trước khi nghiệm thu.",
      );
      return;
    }
    if (!window.confirm("Chuyển xe sang chờ nghiệm thu?")) return;
    persist(work, "acceptance", "Chuyển chờ nghiệm thu");
  }
  return (
    <div className="adv-stack">
      <section className="adm-panel">
        <div className="adm-section-line">
          <h2>Tiến độ thi công</h2>
          <span className="adm-muted">
            {checked}/{work.checklist.length} hạng mục
          </span>
        </div>
        <div
          className="adv-progress"
          role="progressbar"
          aria-valuenow={work.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Tiến độ thi công"
        >
          <i style={{ width: `${work.progress}%` }} />
        </div>
        {overdue && (
          <p className="adm-error-text" role="status">
            Đã quá thời gian dự kiến hoàn thành.
          </p>
        )}
      </section>
      <section className="adm-panel">
        <div className="adm-form-section-title">
          <span>1</span>
          <div>
            <h2>Phân công và thời hạn</h2>
          </div>
        </div>
        <div className="adm-form-grid">
          <label className="adm-field">
            Kỹ thuật viên phụ trách
            <input
              disabled={locked}
              value={work.technician}
              onChange={(event) =>
                setWork({ ...work, technician: event.target.value })
              }
              placeholder="Tên kỹ thuật viên"
            />
          </label>
          <label className="adm-field">
            Dự kiến hoàn thành
            <input
              disabled={locked}
              type="datetime-local"
              value={work.dueAt}
              onChange={(event) =>
                setWork({ ...work, dueAt: event.target.value })
              }
            />
          </label>
          <label className="adm-field">
            Tiến độ (%)
            <input
              disabled={locked || !work.startedAt}
              type="number"
              min="0"
              max="100"
              value={work.progress}
              onChange={(event) =>
                setWork({
                  ...work,
                  progress: Math.min(
                    100,
                    Math.max(0, Number(event.target.value)),
                  ),
                })
              }
            />
          </label>
          <label className="adm-field adm-span-full">
            Ghi chú thi công
            <textarea
              disabled={locked}
              rows={3}
              value={work.note}
              onChange={(event) =>
                setWork({ ...work, note: event.target.value })
              }
            />
          </label>
        </div>
        {work.startedAt && (
          <p className="adm-field-help">
            Bắt đầu {formatDate(work.startedAt)} · {timeLabel(work.startedAt)}
          </p>
        )}
      </section>
      <section className="adm-panel">
        <div className="adm-form-section-title">
          <span>2</span>
          <div>
            <h2>Hạng mục thực hiện</h2>
          </div>
        </div>
        <div className="adv-check-grid">
          {work.checklist.map((item) => (
            <label key={item.id}>
              <input
                type="checkbox"
                disabled={locked || !work.startedAt}
                checked={item.done}
                onChange={(event) =>
                  setWork({
                    ...work,
                    checklist: work.checklist.map((part) =>
                      part.id === item.id
                        ? { ...part, done: event.target.checked }
                        : part,
                    ),
                  })
                }
              />
              {item.label}
            </label>
          ))}
        </div>
      </section>
      <section className="adm-panel">
        <div className="adm-section-line">
          <h2>Nhật ký công việc</h2>
          <span className="adm-muted">{work.logs.length} cập nhật</span>
        </div>
        {work.logs.length ? (
          <ol className="adm-timeline adv-timeline">
            {[...work.logs].reverse().map((item) => (
              <li key={item.id}>
                <i />
                <div>
                  <strong>{item.label}</strong>
                  <time dateTime={item.at}>
                    {formatDate(item.at)} · {timeLabel(item.at)}
                  </time>
                  <p>{item.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="adm-muted">Chưa có cập nhật.</p>
        )}
        {!locked && work.startedAt && (
          <div className="adv-log-entry">
            <label className="adm-field">
              Thêm nhật ký
              <textarea
                rows={2}
                value={log}
                onChange={(event) => setLog(event.target.value)}
                placeholder="Công việc đã thực hiện, vấn đề phát sinh…"
              />
            </label>
            <button type="button" className="adm-btn" onClick={addLog}>
              Lưu nhật ký
            </button>
          </div>
        )}
      </section>
      {error && (
        <p className="adm-error-text" role="alert">
          {error}
        </p>
      )}
      {!locked && (
        <div className="adv-actions adv-toolbar">
          {!work.startedAt ? (
            <button
              type="button"
              className="adm-btn adm-primary"
              onClick={start}
            >
              Bắt đầu thi công
            </button>
          ) : (
            <>
              <button
                type="button"
                className="adm-btn"
                onClick={() => persist()}
              >
                Lưu tiến độ
              </button>
              {order.stage === "work" && (
                <button
                  type="button"
                  className="adm-btn adm-primary"
                  onClick={finish}
                >
                  Chuyển nghiệm thu
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
