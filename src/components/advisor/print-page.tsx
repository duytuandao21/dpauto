"use client";

import Link from "next/link";
import { useBookings } from "@/components/admin/booking-provider";
import { AdminLoading, EmptyState } from "@/components/admin/primitives";
import { formatDate } from "@/lib/booking/logic";
import { formatMoney, quoteTotals } from "@/lib/advisor/seed";
import type { QuoteLine } from "@/lib/advisor/types";
import { useAdvisor } from "./advisor-provider";

export function AdvisorPrintPage({
  id,
  kind,
}: {
  id: string;
  kind: "quote" | "acceptance";
}) {
  const { data } = useBookings();
  const { orders, ready } = useAdvisor();
  const order = orders.find((item) => item.id === id);
  if (!ready) return <AdminLoading />;
  if (!order) return <EmptyState title="Không tìm thấy phiếu" create={false} />;
  const customer = data.customers.find((item) => item.id === order.customerId);
  const vehicle = data.vehicles.find((item) => item.id === order.vehicleId);
  const totals = quoteTotals(order.quote.lines, order.quote.discount);
  const lines = (kindOf: QuoteLine["kind"]) =>
    order.quote.lines.filter((item) => item.kind === kindOf);
  return (
    <div className="adv-print-wrap">
      <div className="adv-print-actions">
        <Link
          className="adm-btn"
          href={`/co-van/phieu-dich-vu/${id}?tab=${kind === "quote" ? "bao-gia" : "nghiem-thu"}`}
        >
          Quay lại phiếu
        </Link>
        <button
          type="button"
          className="adm-btn adm-primary"
          onClick={() => window.print()}
        >
          In / lưu PDF
        </button>
      </div>
      <article className="adv-print-document">
        <header>
          <div>
            <strong>TRẠM DỊCH VỤ TOÀN TRUNG</strong>
            <p>DPAuto · Dịch vụ chăm sóc và sửa chữa ô tô</p>
          </div>
          <span>
            {kind === "quote" ? "BÁO GIÁ DỊCH VỤ" : "BIÊN BẢN NGHIỆM THU"}
          </span>
        </header>
        <h1>
          {kind === "quote" ? "BÁO GIÁ DỊCH VỤ" : "BIÊN BẢN NGHIỆM THU DỊCH VỤ"}
        </h1>
        <p className="adv-print-code">
          {kind === "quote" ? order.quote.id : order.id} · Ngày{" "}
          {formatDate(order.openedAt)}
        </p>
        <dl className="adv-print-info">
          <div>
            <dt>Khách hàng</dt>
            <dd>{customer?.name}</dd>
          </div>
          <div>
            <dt>Điện thoại</dt>
            <dd>{customer?.phone}</dd>
          </div>
          <div>
            <dt>Xe</dt>
            <dd>{vehicle?.model}</dd>
          </div>
          <div>
            <dt>Biển số</dt>
            <dd>{vehicle?.plate}</dd>
          </div>
          <div>
            <dt>Phiếu dịch vụ</dt>
            <dd>{order.id}</dd>
          </div>
        </dl>
        {kind === "acceptance" && (
          <p>
            <strong>Kết quả:</strong>{" "}
            {order.acceptance.result === "passed"
              ? "Đạt"
              : order.acceptance.result === "needs_work"
                ? "Cần xử lý thêm"
                : "Chưa nghiệm thu"}{" "}
            · <strong>Người kiểm tra:</strong>{" "}
            {order.acceptance.inspector || "Chưa ghi"}
          </p>
        )}
        {(["service", "part"] as const).map((type) => (
          <section key={type}>
            <h2>{type === "service" ? "Dịch vụ" : "Phụ tùng"}</h2>
            <table>
              <thead>
                <tr>
                  <th>STT</th>
                  <th>Hạng mục</th>
                  <th>ĐVT</th>
                  <th>SL</th>
                  <th>Đơn giá</th>
                  <th>CK</th>
                  <th>VAT</th>
                  <th>Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {lines(type).length ? (
                  lines(type).map((line, index) => (
                    <tr key={line.id}>
                      <td>{index + 1}</td>
                      <td>{line.name}</td>
                      <td>{line.unit}</td>
                      <td>{line.quantity}</td>
                      <td>{formatMoney(line.price)}</td>
                      <td>{line.discount}%</td>
                      <td>{line.vat}%</td>
                      <td>
                        {formatMoney(
                          line.quantity *
                            line.price *
                            (1 - line.discount / 100) *
                            (1 - order.quote.discount / 100) *
                            (1 + line.vat / 100),
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8}>Không có hạng mục</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        ))}
        <dl className="adv-print-totals">
          <div>
            <dt>Tạm tính</dt>
            <dd>{formatMoney(totals.beforeDiscount)}</dd>
          </div>
          <div>
            <dt>Chiết khấu</dt>
            <dd>
              − {formatMoney(totals.lineDiscount + totals.globalDiscount)}
            </dd>
          </div>
          <div>
            <dt>VAT</dt>
            <dd>{formatMoney(totals.vat)}</dd>
          </div>
          <div>
            <dt>Tổng cộng</dt>
            <dd>{formatMoney(totals.total)}</dd>
          </div>
        </dl>
        {kind === "quote" && order.quote.note && (
          <p>
            <strong>Ghi chú:</strong> {order.quote.note}
          </p>
        )}
        {kind === "acceptance" && (
          <>
            <section>
              <h2>Kiểm tra hoàn thành</h2>
              <ul>
                {order.acceptance.checks.map((item) => (
                  <li key={item.id}>
                    {item.passed ? "☑" : "☐"} {item.label}
                  </li>
                ))}
              </ul>
            </section>
            {order.acceptance.note && (
              <p>
                <strong>Ghi chú nghiệm thu:</strong> {order.acceptance.note}
              </p>
            )}
          </>
        )}
        <div className="adv-print-signatures">
          <div>
            <strong>Khách hàng</strong>
            <small>Ký và ghi rõ họ tên</small>
          </div>
          <div>
            <strong>Cố vấn dịch vụ</strong>
            <small>Ký và ghi rõ họ tên</small>
          </div>
          {kind === "acceptance" && (
            <div>
              <strong>Người nghiệm thu</strong>
              <small>Ký và ghi rõ họ tên</small>
            </div>
          )}
        </div>
      </article>
    </div>
  );
}
