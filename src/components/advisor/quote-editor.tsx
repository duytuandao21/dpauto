"use client";

import Link from "next/link";
import { useState } from "react";
import { bookingServices } from "@/lib/booking/seed";
import { formatMoney, quoteTotals, servicePrices } from "@/lib/advisor/seed";
import type { QuoteLine, ServiceOrder } from "@/lib/advisor/types";
import { useAdvisor } from "./advisor-provider";
import { withEvent } from "./order-common";

const parts = [
  {
    code: "LDC-01",
    name: "Lọc điều hòa",
    unit: "Cái",
    price: 280000,
    stock: 12,
  },
  {
    code: "DG-05",
    name: "Dầu động cơ 5W-30",
    unit: "Lít",
    price: 320000,
    stock: 24,
  },
  { code: "LDM-02", name: "Lọc dầu máy", unit: "Cái", price: 180000, stock: 8 },
];
const quoteStatus = {
  draft: "Bản nháp",
  waiting: "Chờ khách xác nhận",
  confirmed: "Đã xác nhận",
  rejected: "Khách từ chối",
};

function newLine(
  kind: QuoteLine["kind"],
  name = "",
  code = "",
  unit = "Lần",
  price = 0,
  stock?: number,
): QuoteLine {
  return {
    id: crypto.randomUUID(),
    kind,
    name,
    code,
    unit,
    quantity: 1,
    price,
    discount: 0,
    vat: 0,
    stock,
  };
}

export function QuoteEditor({ order }: { order: ServiceOrder }) {
  const { saveOrder } = useAdvisor();
  const [lines, setLines] = useState(order.quote.lines);
  const [discount, setDiscount] = useState(order.quote.discount);
  const [note, setNote] = useState(order.quote.note);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const locked = order.stage !== "quote" || order.quote.status === "confirmed";
  const totals = quoteTotals(lines, discount);

  function edit(id: string, patch: Partial<QuoteLine>) {
    setLines((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
    setDirty(true);
    setError("");
  }
  function validate() {
    if (
      !lines.length ||
      lines.some(
        (line) =>
          !line.name.trim() ||
          !line.unit.trim() ||
          !Number.isFinite(line.quantity) ||
          line.quantity <= 0 ||
          !Number.isFinite(line.price) ||
          line.price < 0 ||
          line.discount < 0 ||
          line.discount > 100 ||
          line.vat < 0 ||
          line.vat > 100,
      ) ||
      discount < 0 ||
      discount > 100
    ) {
      setError(
        "Kiểm tra tên hạng mục, số lượng, giá và tỷ lệ phần trăm từ 0 đến 100.",
      );
      return false;
    }
    return true;
  }
  function save(status: ServiceOrder["quote"]["status"] = "draft") {
    if (!validate()) return;
    const previousWork = new Map(
      order.work.checklist.map((item) => [item.id, item]),
    );
    const previousChecks = new Map(
      order.acceptance.checks.map((item) => [item.id, item]),
    );
    const next = withEvent(
      {
        ...order,
        quote: { ...order.quote, lines, discount, note, status },
        work: {
          ...order.work,
          checklist: lines.map((line) => ({
            id: line.id,
            label: line.name,
            done: previousWork.get(line.id)?.done || false,
          })),
        },
        acceptance: {
          ...order.acceptance,
          checks: lines.map((line) => ({
            id: line.id,
            label: line.name,
            passed: previousChecks.get(line.id)?.passed || false,
          })),
        },
      },
      status === "waiting" ? "Chờ khách xác nhận báo giá" : "Cập nhật báo giá",
      order.quote.id,
    );
    saveOrder(
      next,
      status === "waiting"
        ? "Đã chuyển báo giá sang chờ xác nhận"
        : "Đã lưu báo giá",
    );
    setDirty(false);
  }
  function decide(status: "confirmed" | "rejected") {
    if (
      !window.confirm(
        status === "confirmed"
          ? "Ghi nhận khách đã xác nhận báo giá?"
          : "Ghi nhận khách từ chối báo giá?",
      )
    )
      return;
    saveOrder(
      withEvent(
        { ...order, quote: { ...order.quote, status } },
        status === "confirmed"
          ? "Khách xác nhận báo giá"
          : "Khách từ chối báo giá",
        order.quote.id,
      ),
      "Đã cập nhật trạng thái báo giá",
    );
  }
  function add(kind: QuoteLine["kind"], id: string) {
    if (!id) return;
    const service = bookingServices.find((item) => item.id === id);
    const part = parts.find((item) => item.code === id);
    setLines((current) => [
      ...current,
      service
        ? newLine(
            "service",
            service.name,
            service.id.toUpperCase(),
            "Lần",
            servicePrices[service.id] || 0,
          )
        : part
          ? newLine(
              "part",
              part.name,
              part.code,
              part.unit,
              part.price,
              part.stock,
            )
          : newLine(kind),
    ]);
    setDirty(true);
  }
  return (
    <div className="adv-stack">
      <section className="adm-panel">
        <div className="adm-section-line">
          <h2>Báo giá {order.quote.id}</h2>
          <span className={`adm-badge adv-quote-${order.quote.status}`}>
            {quoteStatus[order.quote.status]}
          </span>
        </div>
        <p className="adm-muted">
          Hạng mục dịch vụ và phụ tùng được tính riêng. Tổng tiền cập nhật khi
          chỉnh sửa.
        </p>
      </section>
      {(["service", "part"] as const).map((kind) => (
        <section key={kind} className="adm-panel">
          <div className="adm-section-line">
            <h2>{kind === "service" ? "Dịch vụ" : "Phụ tùng"}</h2>
            <span className="adm-muted">
              {lines.filter((line) => line.kind === kind).length} hạng mục
            </span>
          </div>
          <div className="adv-lines">
            {lines.filter((line) => line.kind === kind).length ? (
              lines
                .filter((line) => line.kind === kind)
                .map((line) => (
                  <div className="adv-line" key={line.id}>
                    <div className="adv-line-head">
                      <strong>{line.code || "Hạng mục mới"}</strong>
                      {!locked && (
                        <button
                          type="button"
                          className="adm-text-link"
                          onClick={() => {
                            setLines((current) =>
                              current.filter((item) => item.id !== line.id),
                            );
                            setDirty(true);
                          }}
                        >
                          Xóa
                        </button>
                      )}
                    </div>
                    <div className="adv-line-fields">
                      <label className="adm-field adv-line-name">
                        Tên hạng mục
                        <input
                          disabled={locked}
                          value={line.name}
                          onChange={(event) =>
                            edit(line.id, { name: event.target.value })
                          }
                        />
                      </label>
                      <label className="adm-field">
                        ĐVT
                        <input
                          disabled={locked}
                          value={line.unit}
                          onChange={(event) =>
                            edit(line.id, { unit: event.target.value })
                          }
                        />
                      </label>
                      <label className="adm-field">
                        Số lượng
                        <input
                          disabled={locked}
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={line.quantity}
                          onChange={(event) =>
                            edit(line.id, {
                              quantity: Number(event.target.value),
                            })
                          }
                        />
                      </label>
                      <label className="adm-field">
                        Đơn giá
                        <input
                          disabled={locked}
                          type="number"
                          min="0"
                          step="1000"
                          value={line.price}
                          onChange={(event) =>
                            edit(line.id, { price: Number(event.target.value) })
                          }
                        />
                      </label>
                      <label className="adm-field">
                        Chiết khấu %
                        <input
                          disabled={locked}
                          type="number"
                          min="0"
                          max="100"
                          value={line.discount}
                          onChange={(event) =>
                            edit(line.id, {
                              discount: Number(event.target.value),
                            })
                          }
                        />
                      </label>
                      <label className="adm-field">
                        VAT %
                        <input
                          disabled={locked}
                          type="number"
                          min="0"
                          max="100"
                          value={line.vat}
                          onChange={(event) =>
                            edit(line.id, { vat: Number(event.target.value) })
                          }
                        />
                      </label>
                    </div>
                    <div className="adv-line-total">
                      <span>
                        {line.stock !== undefined &&
                          `Tồn kho: ${line.stock} ${line.unit}`}
                      </span>
                      <strong>
                        {formatMoney(
                          line.quantity *
                            line.price *
                            (1 - line.discount / 100) *
                            (1 - discount / 100) *
                            (1 + line.vat / 100),
                        )}
                      </strong>
                    </div>
                  </div>
                ))
            ) : (
              <p className="adm-muted">Chưa có hạng mục.</p>
            )}
          </div>
          {!locked && (
            <div className="adv-actions">
              <select
                aria-label={`Chọn ${kind === "service" ? "dịch vụ" : "phụ tùng"}`}
                defaultValue=""
                onChange={(event) => {
                  add(kind, event.target.value);
                  event.target.value = "";
                }}
              >
                <option value="">+ Chọn từ danh mục</option>
                {kind === "service"
                  ? bookingServices.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))
                  : parts.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.name} · {item.stock} {item.unit}
                      </option>
                    ))}
              </select>
              <button
                type="button"
                className="adm-btn"
                onClick={() => add(kind, "manual")}
              >
                + Dòng thủ công
              </button>
            </div>
          )}
        </section>
      ))}
      <section className="adm-panel adv-quote-bottom">
        <div className="adv-quote-meta">
          <label className="adm-field">
            Chiết khấu chung %
            <input
              disabled={locked}
              type="number"
              min="0"
              max="100"
              value={discount}
              onChange={(event) => {
                setDiscount(Number(event.target.value));
                setDirty(true);
              }}
            />
          </label>
          <label className="adm-field">
            Ghi chú báo giá
            <textarea
              disabled={locked}
              rows={3}
              value={note}
              onChange={(event) => {
                setNote(event.target.value);
                setDirty(true);
              }}
            />
          </label>
        </div>
        <dl className="adv-money-list">
          <div>
            <dt>Tiền trước chiết khấu</dt>
            <dd>{formatMoney(totals.beforeDiscount)}</dd>
          </div>
          <div>
            <dt>Chiết khấu dòng</dt>
            <dd>− {formatMoney(totals.lineDiscount)}</dd>
          </div>
          <div>
            <dt>Chiết khấu chung</dt>
            <dd>− {formatMoney(totals.globalDiscount)}</dd>
          </div>
          <div>
            <dt>VAT</dt>
            <dd>{formatMoney(totals.vat)}</dd>
          </div>
          <div className="adv-money-total">
            <dt>Tổng cộng</dt>
            <dd>{formatMoney(totals.total)}</dd>
          </div>
        </dl>
      </section>
      {error && (
        <p className="adm-error-text" role="alert">
          {error}
        </p>
      )}
      <div className="adv-actions adv-toolbar">
        {!locked && (
          <>
            <button type="button" className="adm-btn" onClick={() => save()}>
              Lưu báo giá
            </button>
            <button
              type="button"
              className="adm-btn adm-primary"
              onClick={() => save("waiting")}
            >
              Chờ khách xác nhận
            </button>
          </>
        )}
        {!dirty && order.quote.status === "waiting" && (
          <>
            <button
              type="button"
              className="adm-btn adm-booking-action adm-action-confirm"
              onClick={() => decide("confirmed")}
            >
              Khách xác nhận
            </button>
            <button
              type="button"
              className="adm-btn adm-subtle-danger"
              onClick={() => decide("rejected")}
            >
              Khách từ chối
            </button>
          </>
        )}
        <Link
          className="adm-btn"
          href={`/co-van/phieu-dich-vu/${order.id}/in-bao-gia`}
        >
          Xem / in báo giá
        </Link>
      </div>
      {dirty && <p className="adm-field-help">Có thay đổi chưa lưu.</p>}
    </div>
  );
}
