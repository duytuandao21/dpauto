"use client";

import Link from "next/link";
import { AdminIcon } from "./admin-icon";
import { statuses } from "@/lib/booking/logic";
import type { BookingStatus } from "@/lib/booking/types";
export function StatusSymbol({ status }: { status: BookingStatus }) {
  const symbols: Record<BookingStatus, React.ReactNode> = {
    pending: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    confirmed: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M7 3v4m10-4v4M3 11h18m-13 5 3 3 5-5" />
      </>
    ),
    arrived: (
      <>
        <path d="m5 9 2-5h10l2 5M3 10h18v8H3Zm2 8v3m14-3v3M6 14h2m8 0h2" />
      </>
    ),
    completed: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    cancelled: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m9 9 6 6m0-6-6 6" />
      </>
    ),
    no_show: (
      <>
        <circle cx="10" cy="7" r="4" />
        <path d="M3 21v-2a7 7 0 0 1 14 0v2m0-9h5" />
      </>
    ),
  };
  return (
    <svg
      className="adm-status-symbol"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {symbols[status]}
    </svg>
  );
}
export function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={`adm-badge adm-status-${status}`}>
      <StatusSymbol status={status} />
      {statuses[status]}
    </span>
  );
}
export function PageHeading({
  eyebrow = "DPAUTO",
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="adm-page-heading">
      <div>
        <p className="adm-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p className="adm-muted">{description}</p>}
      </div>
      {children}
    </div>
  );
}
export function EmptyState({
  title = "Chưa có lịch hẹn",
  description = "Thử đổi ngày hoặc điều chỉnh bộ lọc để xem các lịch khác.",
  create = true,
}: {
  title?: string;
  description?: string;
  create?: boolean;
}) {
  return (
    <div className="adm-empty">
      <span className="adm-empty-icon">
        <AdminIcon name="calendar" />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {create && (
        <Link href="/co-van/lich-hen/tao-moi" className="adm-btn adm-primary">
          <AdminIcon name="plus" />
          Tạo lịch hẹn
        </Link>
      )}
    </div>
  );
}
export function NotFoundState({ kind = "lịch hẹn" }: { kind?: string }) {
  return (
    <div className="adm-panel">
      <EmptyState
        title={`Không tìm thấy ${kind}`}
        description="Mục này không tồn tại hoặc đã được đặt lại."
        create={false}
      />
      <Link
        className="adm-btn"
        href={kind === "khách hàng" ? "/co-van/khach-hang" : "/co-van/lich-hen"}
      >
        <AdminIcon name="back" />
        Quay lại danh sách
      </Link>
    </div>
  );
}
export function AdminLoading() {
  return (
    <div
      className="adm-skeleton"
      role="status"
      aria-label="Đang tải giao diện quản lý"
    >
      <div />
      <div />
      <section>
        <div />
        <div />
        <div />
      </section>
      <div />
      <div />
      <span className="adm-muted">Đang chuẩn bị dữ liệu…</span>
    </div>
  );
}
