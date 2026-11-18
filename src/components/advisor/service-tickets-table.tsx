"use client";
import { formatPhone, formatPlate } from "@/lib/advisor/formats";
import Link from "next/link";
import { EmptyState } from "@/components/admin/primitives";
import {
  ticketTones,
  type ServiceTicketRow,
} from "@/lib/advisor/service-tickets";

export function ServiceTicketsTable({
  rows,
  onDelete,
  deletingId,
}: {
  rows: ServiceTicketRow[];
  onDelete?: (row: ServiceTicketRow) => void;
  deletingId?: string;
}) {
  if (!rows.length)
    return (
      <EmptyState
        title="Không có phiếu phù hợp"
        description="Thử đổi từ khóa hoặc bộ lọc."
        create={false}
      />
    );
  return (
    <div
      className="adv-ticket-scroll"
      role="region"
      aria-label="Danh sách phiếu dịch vụ"
      tabIndex={0}
    >
      <table className="adv-ticket-table">
        <caption className="adv-sr-only">Danh sách phiếu dịch vụ</caption>
        <thead>
          <tr>
            {[
              "Mã phiếu",
              "Biển số",
              "Tên xe",
              "Khách hàng",
              "Thành tiền",
              "Trạng thái",
              "Thao tác",
            ].map((label) => (
              <th key={label} scope="col">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const href = `/co-van/phieu-dich-vu/${encodeURIComponent(row.id)}`;
            const actionHref = `${href}?tab=${row.action.tab}`;
            return (
              <tr key={row.id}>
                <td data-label="Mã phiếu">
                  <Link className="adm-text-link" href={href}>
                    {row.code}
                  </Link>
                </td>
                <td data-label="Biển số">
                  <strong>{formatPlate(row.plate) || "Chưa có"}</strong>
                </td>
                <td data-label="Tên xe">{row.model || "—"}</td>
                <td data-label="Khách hàng">
                  <strong>{row.customer}</strong>
                  {row.phone && (
                    <a
                      className="adv-ticket-phone"
                      href={`tel:${formatPhone(row.phone)}`}
                    >
                      {formatPhone(row.phone)}
                    </a>
                  )}
                </td>
                <td data-label="Thành tiền" className="adv-ticket-amount">
                  {row.amount.value === null ? (
                    <span className="adm-muted">{row.amount.label}</span>
                  ) : (
                    <>
                      <strong>
                        {BigInt(row.amount.value).toLocaleString("vi-VN")} đ
                      </strong>
                      <small>{row.amount.label}</small>
                      {row.pendingChange && (
                        <small>Có phát sinh chờ duyệt</small>
                      )}
                    </>
                  )}
                </td>
                <td data-label="Trạng thái">
                  <span
                    className={`adm-badge adm-status-${row.tone || ticketTones[row.stage]}`}
                  >
                    {row.label}
                  </span>
                </td>
                <td data-label="Thao tác">
                  <div className="adv-ticket-actions">
                    <Link className="adm-btn adm-primary" href={actionHref}>
                      {row.action.label}
                    </Link>
                    {onDelete && (
                      <button
                        type="button"
                        className="adm-btn adm-subtle-danger"
                        disabled={!!deletingId || !row.canDelete}
                        title={
                          row.canDelete
                            ? "Xóa phiếu dịch vụ"
                            : row.deleteBlockedReason ||
                              "Phiếu chưa đủ điều kiện xóa"
                        }
                        aria-label={`Xóa phiếu ${row.code}`}
                        onClick={() => onDelete(row)}
                      >
                        {deletingId === row.id ? "Đang xóa…" : "Xóa"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
