"use client";

import { useState, type FormEvent } from "react";
import { formatDate } from "@/lib/booking/logic";
import { formatMoney } from "@/lib/advisor/seed";
import {
  operationStages,
  orderAmounts,
  orderEvent,
  paymentLabel,
  quoteStatuses,
  staffWorkload,
  type ManagerOrder,
} from "@/lib/manager/operations";
import { useManager } from "./manager-provider";
import { ManagerModal } from "./manager-modal";
import { ManagerField } from "./manager-ui";

export function OperationBadge({ stage }: { stage: ManagerOrder["stage"] }) {
  return (
    <span className={`mgr-pill mgr-operation-${stage}`}>
      {operationStages[stage]}
    </span>
  );
}
export function OperationTime({ value }: { value: string }) {
  return value ? (
    <time dateTime={value}>
      {formatDate(value, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "Asia/Ho_Chi_Minh",
      })}{" "}
      ·{" "}
      {new Intl.DateTimeFormat("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Ho_Chi_Minh",
      }).format(new Date(value))}
    </time>
  ) : (
    <span>Chưa xác định</span>
  );
}
export function ManagerOrderDrawer({
  id,
  initialTab = "overview",
  onClose,
}: {
  id: string;
  initialTab?: string;
  onClose: () => void;
}) {
  const { data, theme, update, now, ask, today } = useManager();
  const order = data.orders.find((o) => o.id === id);
  const [tab, setTab] = useState(initialTab);
  const [advisor, setAdvisor] = useState(order?.advisorId || "");
  const [technician, setTechnician] = useState(order?.work.technician || "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  if (!order)
    return (
      <ManagerModal
        title="Không tìm thấy phiếu"
        theme={theme}
        onClose={onClose}
      >
        <p>Phiếu không còn trong danh sách. Hãy đóng và tìm lại.</p>
      </ManagerModal>
    );
  const customer = data.customers.find((c) => c.id === order.customerId);
  const amounts = orderAmounts(order);
  const overdue =
    order.stage !== "done" &&
    order.work.dueAt &&
    Date.parse(order.work.dueAt) < now;
  function assign(e: FormEvent) {
    e.preventDefault();
    if (!order) return;
    if (!reason.trim() || (!advisor && !technician)) {
      setError("Chọn người phụ trách và nhập lý do điều chỉnh.");
      return;
    }
    const unavailable = [advisor, technician]
      .filter(Boolean)
      .some(
        (id) =>
          !data.staff.find((s) => s.id === id)?.active ||
          data.shifts.some(
            (s) => s.staffId === id && s.date === today && s.state === "leave",
          ),
      );
    if (unavailable) {
      setError(
        "Nhân viên đang tạm ngưng hoặc nghỉ trong ngày tiếp nhận. Chọn người khả dụng.",
      );
      return;
    }
    const before = `CVDV: ${data.staff.find((s) => s.id === order.advisorId)?.name || "Chưa có"}; KTV: ${data.staff.find((s) => s.id === order.work.technician)?.name || "Chưa có"}`;
    const after = `CVDV: ${data.staff.find((s) => s.id === advisor)?.name || "Chưa có"}; KTV: ${data.staff.find((s) => s.id === technician)?.name || "Chưa có"}`;
    ask({
      title: "Xác nhận điều phối",
      message: `${order.id} · ${after}. Lý do: ${reason.trim()}`,
      label: "Cập nhật phân công",
      action: () => {
        update(
          (d) => ({
            ...d,
            orders: d.orders.map((o) =>
              o.id === id
                ? {
                    ...o,
                    advisorId: advisor,
                    work: { ...o.work, technician },
                    events: [
                      ...o.events,
                      orderEvent(
                        "Quản lý điều phối",
                        `${before} → ${after}. ${reason.trim()}`,
                      ),
                    ],
                  }
                : o,
            ),
            bookings: d.bookings.map((b) =>
              b.id === order.bookingId ? { ...b, advisorId: advisor } : b,
            ),
          }),
          "Đã cập nhật phân công",
          id,
        );
        setReason("");
        setError("");
      },
    });
  }
  return (
    <ManagerModal
      title={`${order.id} · ${customer?.plate || "Chưa có biển số"}`}
      theme={theme}
      drawer
      onClose={onClose}
      footer={
        <button className="adm-btn" onClick={onClose}>
          Đóng chi tiết
        </button>
      }
    >
      <div className="mgr-detail-status">
        <OperationBadge stage={order.stage} />
        <span className="mgr-pill">{paymentLabel(order)}</span>
      </div>
      <div className="mgr-tabs mgr-detail-tabs" aria-label="Chi tiết phiếu">
        {Object.entries({
          overview: "Tổng quan",
          quote: "Báo giá",
          work: "Thi công",
          acceptance: "Nghiệm thu",
          history: "Lịch sử",
        }).map(([key, label]) => (
          <button
            key={key}
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "overview" && (
        <>
          <section className="mgr-detail-section">
            <h3>Khách hàng & xe</h3>
            <h2>{customer?.name}</h2>
            <p>
              {customer?.model} · {customer?.plate}
            </p>
            <a className="adm-text-link" href={`tel:${customer?.phone}`}>
              {customer?.phone}
            </a>
            <p>
              Tiếp nhận: <OperationTime value={order.openedAt} />
            </p>
            <p>Yêu cầu: {order.request}</p>
            <p>
              ODO: {order.odo || "Chưa ghi"} km · {order.receptionNote}
            </p>
            <p>
              Dự kiến hoàn thành: <OperationTime value={order.work.dueAt} />
            </p>
            {overdue && (
              <p className="mgr-pill mgr-pill-danger">
                ⚠ Đã quá thời gian dự kiến
              </p>
            )}
            {order.holdReason && (
              <p className="mgr-pill mgr-pill-warning">
                Tạm dừng: {order.holdReason}
              </p>
            )}
          </section>
          <section className="mgr-detail-section">
            <h3>Phân công nhân sự</h3>
            <form className="mgr-form" onSubmit={assign}>
              <ManagerField label="Cố vấn dịch vụ">
                <select
                  value={advisor}
                  disabled={order.stage === "done"}
                  onChange={(e) => setAdvisor(e.target.value)}
                >
                  <option value="">Chưa phân công</option>
                  {data.staff
                    .filter((s) => s.role === "advisor")
                    .map((s) => (
                      <option key={s.id} value={s.id} disabled={!s.active}>
                        {s.name}
                        {!s.active ? " · Tạm ngưng" : ""}
                      </option>
                    ))}
                </select>
              </ManagerField>
              <ManagerField label="Kỹ thuật viên">
                <select
                  value={technician}
                  disabled={order.stage === "done"}
                  onChange={(e) => setTechnician(e.target.value)}
                >
                  <option value="">Chưa phân công</option>
                  {data.staff
                    .filter((s) => s.role === "technician")
                    .map((s) => (
                      <option key={s.id} value={s.id} disabled={!s.active}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </ManagerField>
              {[advisor, technician]
                .filter(Boolean)
                .some(
                  (id) => staffWorkload(data, id, now).orders.length >= 3,
                ) && (
                <p className="mgr-warning-text">
                  ⚠ Người được chọn đang có từ 3 xe cần xử lý. Kiểm tra tải
                  trước khi giao thêm.
                </p>
              )}
              {order.stage !== "done" && (
                <>
                  <ManagerField label="Lý do điều chỉnh *">
                    <textarea
                      required
                      maxLength={400}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </ManagerField>
                  {error && (
                    <p role="alert" className="adm-error-text">
                      {error}
                    </p>
                  )}
                  <button
                    className="adm-btn adm-primary"
                    disabled={
                      advisor === order.advisorId &&
                      technician === order.work.technician
                    }
                  >
                    Cập nhật phân công
                  </button>
                </>
              )}
            </form>
          </section>
          <section className="mgr-detail-section">
            <h3>Tổng hợp tài chính</h3>
            <div className="mgr-summary-row">
              <span>Giá trị báo giá</span>
              <strong>{formatMoney(amounts.total)}</strong>
            </div>
            <div className="mgr-summary-row">
              <span>Tiền cọc / đã thu thêm</span>
              <strong>
                {formatMoney(order.finance.deposit)} /{" "}
                {formatMoney(order.finance.collected)}
              </strong>
            </div>
            <div className="mgr-summary-row">
              <span>Còn phải thu</span>
              <strong>
                {amounts.debt === null
                  ? "Chờ chốt báo giá"
                  : formatMoney(amounts.debt)}
              </strong>
            </div>
          </section>
        </>
      )}
      {tab === "quote" && (
        <section className="mgr-detail-section">
          <h3>
            {order.quote.id} · {quoteStatuses[order.quote.status]}
          </h3>
          <p>
            Người lập:{" "}
            {data.staff.find((s) => s.id === order.quoteCreatedBy)?.name ||
              "Chưa xác định"}
          </p>
          <p>
            CVDV:{" "}
            {data.staff.find((s) => s.id === order.advisorId)?.name ||
              "Chưa phân công"}{" "}
            · Cập nhật: <OperationTime value={order.quoteUpdatedAt} />
          </p>
          <div className="mgr-line-list">
            {order.quote.lines.map((l) => (
              <article key={l.id}>
                <strong>{l.name}</strong>
                <p>
                  {l.kind === "part" ? "Vật tư" : "Dịch vụ"} · {l.quantity}{" "}
                  {l.unit} × {formatMoney(l.price)}
                </p>
                <p>
                  CK {l.discount}% · VAT {l.vat}%
                </p>
              </article>
            ))}
          </div>
          <div className="mgr-summary-row">
            <span>Chiết khấu tổng</span>
            <strong>{order.quote.discount}%</strong>
          </div>
          <div className="mgr-summary-row">
            <span>Tổng sau chiết khấu và VAT</span>
            <strong>{formatMoney(amounts.total)}</strong>
          </div>
          <h3>Lịch sử điều chỉnh báo giá</h3>
          {order.quoteHistory.length ? (
            order.quoteHistory.map((h) => (
              <article className="mgr-audit-item" key={h.id}>
                <strong>
                  {h.actor} · <OperationTime value={h.at} />
                </strong>
                <p>{h.detail}</p>
                <p>
                  {formatMoney(h.before)} → {formatMoney(h.after)}
                </p>
              </article>
            ))
          ) : (
            <p>Chưa có điều chỉnh báo giá.</p>
          )}
        </section>
      )}
      {tab === "work" && (
        <section className="mgr-detail-section">
          <h3>Tiến độ thi công · {order.work.progress}%</h3>
          <progress max={100} value={order.work.progress} />
          <p>
            KTV:{" "}
            {data.staff.find((s) => s.id === order.work.technician)?.name ||
              "Chưa phân công"}
          </p>
          <p>
            Bắt đầu: <OperationTime value={order.work.startedAt} />
          </p>
          <p>
            Dự kiến: <OperationTime value={order.work.dueAt} />
          </p>
          {order.holdReason && (
            <p className="mgr-warning-text">⚠ {order.holdReason}</p>
          )}
          <div className="mgr-line-list">
            {order.work.checklist.map((t) => (
              <article key={t.id}>
                <span>
                  {t.done ? "✓ Hoàn tất" : "○ Chưa hoàn tất"} · {t.label}
                </span>
              </article>
            ))}
          </div>
          <h3>Nhật ký thi công</h3>
          {order.work.logs.length ? (
            order.work.logs.map((l) => (
              <article className="mgr-audit-item" key={l.id}>
                <OperationTime value={l.at} />
                <p>
                  {l.label} · {l.detail}
                </p>
              </article>
            ))
          ) : (
            <p>Chưa có nhật ký thi công.</p>
          )}
        </section>
      )}
      {tab === "acceptance" && (
        <section className="mgr-detail-section">
          <h3>Kết quả nghiệm thu</h3>
          <span
            className={`mgr-pill ${order.acceptance.result === "passed" ? "mgr-pill-success" : "mgr-pill-warning"}`}
          >
            {
              {
                pending: "Chưa nghiệm thu",
                passed: "Đạt",
                needs_work: "Cần làm lại",
              }[order.acceptance.result]
            }
          </span>
          <p>
            Người kiểm tra: {order.acceptance.inspector || "Chưa phân công"}
          </p>
          <p>
            Thời gian: <OperationTime value={order.acceptance.checkedAt} />
          </p>
          <div className="mgr-line-list">
            {order.acceptance.checks.map((c) => (
              <article key={c.id}>
                {c.passed ? "✓ Đạt" : "○ Chưa đạt / chưa kiểm tra"} · {c.label}
              </article>
            ))}
          </div>
          {order.work.checklist.some((c) => !c.done) && (
            <p className="mgr-warning-text">
              ⚠ Còn hạng mục thi công chưa hoàn tất.
            </p>
          )}
          {order.acceptance.checks.some((c) => !c.passed) && (
            <p className="mgr-warning-text">
              Chưa đủ checklist để hoàn tất nghiệm thu.
            </p>
          )}
          <p>{order.acceptance.note || "Chưa có ghi chú nghiệm thu."}</p>
          <p>Thanh toán: {paymentLabel(order)}</p>
        </section>
      )}
      {tab === "history" && (
        <section className="mgr-detail-section">
          <h3>Lịch sử thay đổi</h3>
          {[...order.events].reverse().map((e) => (
            <article className="mgr-audit-item" key={e.id}>
              <strong>{e.label}</strong>
              <p>
                <OperationTime value={e.at} />
              </p>
              <p>{e.detail}</p>
            </article>
          ))}
        </section>
      )}
    </ManagerModal>
  );
}
