"use client";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { CmsIcon, type CmsIconName } from "./icon";
import {
  Alert,
  Badge,
  ButtonLink,
  Card,
  Empty,
  Input,
  Loading,
  PageHeader,
  Select,
  Stat,
  timeAgo,
} from "./ui";
import {
  statusLabel,
  statusOf,
  useDocuments,
  type DocSummary,
  type Kind,
  type Payload,
  type Status,
} from "./data";

export type Row = {
  key: string;
  doc?: DocSummary;
  status: Status;
  title: string;
  image?: string;
  order: number;
  meta: Payload;
  isDefault: boolean;
};
/** Built-in items merged with CMS documents of the same kind. */
export function useRows(
  kind: Kind,
  defaults: { key: string; payload: Payload }[],
) {
  const docs = useDocuments(kind);
  const rows = useMemo<Row[]>(() => {
    const map = new Map<string, Row>();
    defaults.forEach((d, i) =>
      map.set(d.key, {
        key: d.key,
        status: "default",
        title: d.payload.title || d.payload.name || d.key,
        image:
          d.payload.image?.src ||
          d.payload.images?.[0]?.src ||
          d.payload.after?.src,
        order: d.payload.order ?? i,
        meta: d.payload,
        isDefault: true,
      }),
    );
    for (const doc of docs.data) {
      if (doc.deleted) {
        map.delete(doc.key);
        continue;
      }
      const prev = map.get(doc.key);
      map.set(doc.key, {
        key: doc.key,
        doc,
        status: statusOf(doc, !!prev),
        title: doc.title || prev?.title || doc.key,
        image:
          doc.summary?.image ||
          (doc.summary?.imageId
            ? `/api/v1/admin/cms/assets/${doc.summary.imageId}`
            : prev?.image),
        order: doc.summary?.order ?? prev?.order ?? 9999,
        meta: { ...prev?.meta, ...doc.summary },
        isDefault: !!prev,
      });
    }
    return [...map.values()].sort(
      (a, b) => a.order - b.order || a.title.localeCompare(b.title, "vi"),
    );
  }, [docs.data, defaults]);
  return {
    rows,
    loading: docs.loading,
    error: docs.error,
    reload: docs.reload,
  };
}

export function ContentList({
  kind,
  title,
  description,
  basePath,
  icon,
  defaults,
  newLabel,
  columns,
  noun,
}: {
  kind: Kind;
  title: string;
  description: string;
  basePath: string;
  icon: CmsIconName;
  defaults: { key: string; payload: Payload }[];
  newLabel: string;
  noun: string;
  columns?: {
    label: string;
    /** `list` gives cells that edit in place the other rows and a reload. */
    cell: (r: Row, list: { rows: Row[]; reload: () => void }) => ReactNode;
    filter?: (r: Row) => string;
  }[];
}) {
  const { rows, loading, error, reload } = useRows(kind, defaults),
    [q, setQ] = useState(""),
    [status, setStatus] = useState<"" | Status>(""),
    [group, setGroup] = useState("");
  const filterCol = columns?.find((c) => c.filter);
  const groups = filterCol
    ? [...new Set(rows.map((r) => filterCol.filter!(r)).filter(Boolean))].sort()
    : [];
  const shown = rows.filter(
    (r) =>
      (!q || `${r.title} ${r.key} ${r.meta.slug || ""}`.toLowerCase().includes(q.toLowerCase())) &&
      (!status || r.status === status) &&
      (!group || filterCol?.filter?.(r) === group),
  );
  const visible = rows.filter(
    (r) => !["hidden", "withdrawn", "new"].includes(r.status),
  ).length;
  const drafts = rows.filter((r) => r.status === "draft").length;
  const custom = rows.filter((r) => r.doc && r.doc.publishedRevisionId).length;
  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={
          <ButtonLink variant="primary" icon="plus" href={`${basePath}/moi`}>
            {newLabel}
          </ButtonLink>
        }
      />
      <div className="cms-stats" data-count="4">
        <Stat
          icon={icon}
          value={loading ? "…" : rows.length}
          label={`Tổng số ${noun}`}
        />
        <Stat
          icon="eye"
          value={loading ? "…" : visible}
          label="Đang hiển thị"
        />
        <Stat
          icon="pencil"
          value={loading ? "…" : custom}
          label="Đã chỉnh sửa"
          note="So với nội dung gốc"
        />
        <Stat
          icon="clock"
          value={loading ? "…" : drafts}
          label="Chưa áp dụng"
          trend={drafts ? { text: "Bấm Lưu để áp dụng", tone: "warn" } : undefined}
        />
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      <Card pad={false}>
        <div className="cms-toolbar">
          <div className="cms-input-icon">
            <CmsIcon name="search" />
            <Input
              type="search"
              placeholder={`Tìm ${noun}…`}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label={`Tìm ${noun}`}
            />
          </div>
          {filterCol && (
            <Select
              className="cms-select-sm"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              aria-label={`Lọc theo ${filterCol.label}`}
            >
              <option value="">Tất cả {filterCol.label.toLowerCase()}</option>
              {groups.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </Select>
          )}
          <Select
            className="cms-select-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as Status)}
            aria-label="Lọc theo trạng thái"
          >
            <option value="">Mọi trạng thái</option>
            {(
              [
                "default",
                "live",
                "draft",
                "hidden",
                "withdrawn",
                "new",
              ] as Status[]
            ).map((s) => (
              <option key={s} value={s}>
                {statusLabel[s].text}
              </option>
            ))}
          </Select>
        </div>
        {loading && !rows.length ? (
          <div className="cms-card-body">
            <Loading />
          </div>
        ) : shown.length ? (
          <div className="cms-table-wrap">
            <table className="cms-table">
              <thead>
                <tr>
                  <th>{noun[0].toUpperCase() + noun.slice(1)}</th>
                  {columns?.map((c) => (
                    <th key={c.label}>{c.label}</th>
                  ))}
                  <th>Trạng thái</th>
                  <th>Cập nhật</th>
                  <th className="cms-cell-actions">
                    <span className="cms-sr-only">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.key}>
                    <td>
                      <Link
                        className="cms-cell-title"
                        href={`${basePath}/${r.key}`}
                      >
                        <span className="cms-row-thumb">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {r.image ? (
                            <img src={r.image} alt="" loading="lazy" />
                          ) : null}
                        </span>
                        <span>
                          <strong>{r.title}</strong>
                          <small>/{r.meta.slug || r.key}</small>
                        </span>
                      </Link>
                    </td>
                    {columns?.map((c) => (
                      <td key={c.label}>{c.cell(r, { rows, reload })}</td>
                    ))}
                    <td>
                      <Badge tone={statusLabel[r.status].tone}>
                        {statusLabel[r.status].text}
                      </Badge>
                    </td>
                    <td className="cms-help">
                      {r.doc ? timeAgo(r.doc.updatedAt) : "Nội dung gốc"}
                    </td>
                    <td className="cms-cell-actions">
                      <ButtonLink
                        size="sm"
                        variant="ghost"
                        icon="pencil"
                        href={`${basePath}/${r.key}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            icon={icon}
            title={
              q || status || group
                ? "Không có kết quả phù hợp"
                : `Chưa có ${noun}`
            }
          />
        )}
      </Card>
    </>
  );
}
