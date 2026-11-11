"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDate, timeLabel } from "@/lib/booking/logic";
import type { ServiceOrder } from "@/lib/advisor/types";
import { useAdvisor } from "./advisor-provider";
import { withEvent } from "./order-common";

export function AcceptanceEditor({ order }: { order: ServiceOrder }) {
  const { saveOrder } = useAdvisor();
  const [value, setValue] = useState(order.acceptance);
  const [error, setError] = useState("");
  const locked = order.stage === "done";
  const missingParts = order.quote.lines.filter(
    (line) =>
      line.kind === "part" &&
      line.stock !== undefined &&
      line.stock < line.quantity,
  );
  const canComplete =
    order.stage === "acceptance" &&
    order.work.progress === 100 &&
    value.checks.length > 0 &&
    value.checks.every((item) => item.passed) &&
    value.result === "passed" &&
    value.inspector.trim() &&
    missingParts.length === 0;
  function persist(done = false) {
    if (done && !canComplete) {
      setError("Chưa đủ điều kiện hoàn tất nghiệm thu.");
      return;
    }
    if (
      done &&
      !window.confirm("Hoàn tất nghiệm thu và chuyển phiếu sang chờ bàn giao?")
    )
      return;
    const next = withEvent(
      {
        ...order,
        stage: done ? "done" : order.stage,
        acceptance: {
          ...value,
          checkedAt: done ? new Date().toISOString() : value.checkedAt,
        },
      },
      done ? "Hoàn tất nghiệm thu" : "Lưu checklist nghiệm thu",
      `${value.inspector || "Chưa chọn người kiểm tra"} · ${value.result}`,
    );
    saveOrder(next, done ? "Đã hoàn tất nghiệm thu" : "Đã lưu checklist");
    setError("");
  }
  return (
    <div className="adv-stack">
      <section className="adm-panel">
        <h2>Nghiệm thu và bàn giao</h2>
        <p className="adm-muted">
          Kiểm tra hạng mục đã thực hiện trước khi hoàn tất phiếu.
        </p>
        {order.stage === "done" && (
          <p className="adm-field-help">
            Hoàn tất{" "}
            {value.checkedAt
              ? `${formatDate(value.checkedAt)} · ${timeLabel(value.checkedAt)}`
              : ""}
          </p>
        )}
      </section>
      <section className="adm-panel">
        <div className="adm-form-section-title">
          <span>1</span>
          <div>
            <h2>Checklist nghiệm thu</h2>
          </div>
        </div>
        <div className="adv-check-grid">
          {value.checks.map((item) => (
            <label key={item.id}>
              <input
                type="checkbox"
                disabled={locked}
                checked={item.passed}
                onChange={(event) =>
                  setValue({
                    ...value,
                    checks: value.checks.map((check) =>
                      check.id === item.id
                        ? { ...check, passed: event.target.checked }
                        : check,
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
        <div className="adm-form-section-title">
          <span>2</span>
          <div>
            <h2>Kết quả kiểm tra</h2>
          </div>
        </div>
        <div className="adm-form-grid">
          <label className="adm-field">
            Người nghiệm thu
            <input
              disabled={locked}
              value={value.inspector}
              onChange={(event) =>
                setValue({ ...value, inspector: event.target.value })
              }
            />
          </label>
          <label className="adm-field">
            Kết quả
            <select
              disabled={locked}
              value={value.result}
              onChange={(event) =>
                setValue({
                  ...value,
                  result: event.target.value as typeof value.result,
                })
              }
            >
              <option value="pending">Chưa đánh giá</option>
              <option value="passed">Đạt</option>
              <option value="needs_work">Cần xử lý thêm</option>
            </select>
          </label>
          <label className="adm-field adm-span-full">
            Ghi chú nghiệm thu
            <textarea
              disabled={locked}
              rows={3}
              value={value.note}
              onChange={(event) =>
                setValue({ ...value, note: event.target.value })
              }
            />
          </label>
        </div>
      </section>
      {!locked && (!canComplete || missingParts.length > 0) && (
        <div className="adm-demo-notice" role="status">
          {missingParts.length > 0
            ? `Chưa đủ phụ tùng: ${missingParts.map((item) => item.name).join(", ")}.`
            : "Cần hoàn tất tiến độ, checklist, kết quả và người nghiệm thu trước khi kết thúc."}
        </div>
      )}
      {error && (
        <p className="adm-error-text" role="alert">
          {error}
        </p>
      )}
      <div className="adv-actions adv-toolbar">
        {!locked && (
          <>
            <button type="button" className="adm-btn" onClick={() => persist()}>
              Lưu checklist
            </button>
            <button
              type="button"
              className="adm-btn adm-primary"
              disabled={!canComplete}
              onClick={() => persist(true)}
            >
              Hoàn tất nghiệm thu
            </button>
          </>
        )}
        <Link
          className="adm-btn"
          href={`/co-van/phieu-dich-vu/${order.id}/in-nghiem-thu`}
        >
          Xem / in biên bản
        </Link>
      </div>
    </div>
  );
}
