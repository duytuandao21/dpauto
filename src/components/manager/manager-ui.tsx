"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  type ReactNode,
  type ReactElement,
} from "react";
import { AdminIcon } from "@/components/admin/admin-icon";

type TableNode = { children?: ReactNode; "data-label"?: string };
function tableText(node: ReactNode): string {
  return Children.toArray(node)
    .map((n) =>
      typeof n === "string" || typeof n === "number"
        ? String(n)
        : isValidElement<TableNode>(n)
          ? tableText(n.props.children)
          : "",
    )
    .join(" ");
}
export function ManagerTable({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const nodes = Children.toArray(children);
  const head = nodes.find(
    (n) => isValidElement<TableNode>(n) && n.type === "thead",
  ) as ReactElement<TableNode> | undefined;
  const row = Children.toArray(head?.props.children).find(
    (n) => isValidElement<TableNode>(n) && n.type === "tr",
  ) as ReactElement<TableNode> | undefined;
  const labels = Children.toArray(row?.props.children).map((c) =>
    isValidElement<TableNode>(c) ? tableText(c.props.children) : "",
  );
  return (
    <table className={`${className} mgr-record-table`}>
      {nodes.map((n) => {
        if (!isValidElement<TableNode>(n) || n.type !== "tbody") return n;
        return cloneElement(n, {
          children: Children.map(n.props.children, (r) => {
            if (!isValidElement<TableNode>(r) || r.type !== "tr") return r;
            return cloneElement(r, {
              children: Children.map(r.props.children, (c, i) =>
                isValidElement<TableNode>(c) && c.type === "td"
                  ? cloneElement(c, {
                      "data-label": c.props["data-label"] || labels[i],
                    })
                  : c,
              ),
            });
          }),
        });
      })}
    </table>
  );
}

export function ManagerPanel({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`adm-panel mgr-panel ${className}`}>
      <div className="mgr-panel-head">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function ManagerSearch({
  value,
  onChange,
  placeholder = "Tìm kiếm…",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="adm-search mgr-search">
      <AdminIcon name="search" />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {value && (
        <button
          type="button"
          aria-label="Xóa tìm kiếm"
          onClick={() => onChange("")}
        >
          <AdminIcon name="close" />
        </button>
      )}
    </label>
  );
}
export function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="mgr-filter">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}
export function ManagerField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className={`adm-field ${error ? "has-error" : ""}`}>
      <span>{label}</span>
      {children}
      {error && (
        <span className="adm-error-text" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}
export function ManagerEmpty({
  message = "Không có dữ liệu phù hợp",
  onReset,
}: {
  message?: string;
  onReset?: () => void;
}) {
  return (
    <div className="mgr-empty">
      <AdminIcon name="search" />
      <strong>{message}</strong>
      <p>Thử đổi ngày hoặc điều chỉnh bộ lọc.</p>
      {onReset && (
        <button type="button" className="adm-btn" onClick={onReset}>
          Xóa bộ lọc
        </button>
      )}
    </div>
  );
}
export function ManagerPager({
  page,
  total,
  size = 6,
  onChange,
}: {
  page: number;
  total: number;
  size?: number;
  onChange: (page: number) => void;
}) {
  const max = Math.max(1, Math.ceil(total / size));
  return (
    <div className="mgr-pagination">
      <span>
        {total
          ? `${(page - 1) * size + 1}–${Math.min(page * size, total)}`
          : "0"}{" "}
        / {total} kết quả
      </span>
      <div>
        <button
          className="adm-btn"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="Trang trước"
        >
          <AdminIcon name="back" />
        </button>
        <span>
          Trang {page}/{max}
        </span>
        <button
          className="adm-btn"
          disabled={page >= max}
          onClick={() => onChange(page + 1)}
          aria-label="Trang sau"
        >
          <span className="mgr-arrow-next">
            <AdminIcon name="back" />
          </span>
        </button>
      </div>
    </div>
  );
}
