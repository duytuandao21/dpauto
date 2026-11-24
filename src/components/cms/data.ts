"use client";
import { useCallback, useEffect, useState } from "react";
import { collection, command, request } from "@/lib/api/client";
import type { CmsAsset } from "@/lib/api/cms";

export type Kind =
  | "SETTINGS"
  | "NAVIGATION"
  | "PAGE"
  | "SERVICE"
  | "NEWS"
  | "ACCESSORY"
  | "PROJECT"
  | "SEO"
  | "CATALOG";
// Payloads are validated per kind by the backend; the admin edits them as plain JSON objects.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Payload = Record<string, any>;
export type ImageValue = { src: string; alt: string; assetId?: string };
export type DocSummary = {
  id: string;
  kind: Kind;
  key: string;
  title: string;
  version: number;
  updatedAt: string;
  publishedRevisionId: string | null;
  withdrawn: boolean;
  /** Deleted list item: gone from the admin (a built-in default it replaced stays hidden). */
  deleted?: boolean;
  hidden: boolean;
  hasDraft: boolean;
  /** A few fields of the latest revision for list views. */
  summary?: {
    image?: string;
    imageId?: string;
    order?: number;
    category?: string;
    brand?: string;
    price?: number | null;
    date?: string;
    publishAt?: string;
    vehicle?: string;
    featured?: boolean;
    description?: string;
  };
};
export type Revision = {
  id: string;
  number: number;
  payload: Payload;
  createdAt: string;
  author: string | null;
};
export type DocDetail = {
  id: string;
  kind: Kind;
  key: string;
  version: number;
  withdrawn: boolean;
  updatedAt: string;
  publishedRevisionId: string | null;
  revisions: Revision[];
  hasOlderRevisions: boolean;
};
export type Activity = {
  id: string;
  action: string;
  actor: string;
  at: string;
  reason: string | null;
  target: {
    type: "asset" | "document";
    id: string;
    kind?: Kind;
    key?: string;
    title?: string | null;
  };
};
export type Overview = {
  kinds: Partial<Record<Kind, { total: number; live: number; drafts: number }>>;
  drafts: {
    id: string;
    kind: Kind;
    key: string;
    title: string;
    updatedAt: string;
  }[];
  scheduled: { id: string; key: string; title: string; publishAt: string }[];
  media: { count: number; bytes: number; trash: number };
  months: {
    month: string;
    published: number;
    saved: number;
    uploaded: number;
  }[];
  recent: Activity[];
};
export type { CmsAsset };

/** Loads a GET endpoint; `reload()` refetches. */
export function useApi<T>(path: string | null) {
  const [state, setState] = useState<{
    data?: T;
    error?: string;
    loading: boolean;
  }>({ loading: !!path });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path) return;
    const a = new AbortController();
    setState((s) => ({ ...s, loading: true }));
    request<T>(path, { signal: a.signal })
      .then((r) => setState({ data: r.data, loading: false }))
      .catch((e) => {
        if (!a.signal.aborted)
          setState({
            loading: false,
            error: e instanceof Error ? e.message : "Không tải được dữ liệu.",
          });
      });
    return () => a.abort();
  }, [path, tick]);
  return { ...state, reload: useCallback(() => setTick((n) => n + 1), []) };
}
/** All documents of a kind (paged API, collected). */
export function useDocuments(kind: Kind) {
  const [state, setState] = useState<{
    data: DocSummary[];
    loading: boolean;
    error?: string;
  }>({
    data: [],
    loading: true,
  });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const a = new AbortController();
    collection<DocSummary>(`admin/cms/documents?kind=${kind}`, a.signal)
      .then((data) => setState({ data, loading: false }))
      .catch((e) => {
        if (!a.signal.aborted)
          setState({
            data: [],
            loading: false,
            error: e instanceof Error ? e.message : "Không tải được dữ liệu.",
          });
      });
    return () => a.abort();
  }, [kind, tick]);
  return { ...state, reload: useCallback(() => setTick((n) => n + 1), []) };
}
export async function findDocument(kind: Kind, key: string) {
  const list = await request<DocSummary[]>(
    `admin/cms/documents?kind=${kind}&key=${encodeURIComponent(key)}&limit=1`,
  );
  const found = list.data.find((d) => !d.deleted);
  return found
    ? (await request<DocDetail>("admin/cms/documents/" + found.id)).data
    : null;
}
export const api = {
  /** `builtIn`: first save of a built-in item under its existing key. */
  create: (kind: Kind, key: string, payload: Payload, builtIn = false) =>
    command<{ id: string; version: number; revisionId: string }>(
      "admin/cms/documents",
      { kind, key, payload, ...(builtIn ? { builtIn } : {}) },
    ),
  save: (id: string, expectedVersion: number, payload: Payload) =>
    command<{ id: string; version: number; revisionId: string }>(
      "admin/cms/documents/" + id,
      { expectedVersion, payload },
      "PATCH",
    ),
  publish: (
    id: string,
    expectedVersion: number,
    revisionId: string,
    reason?: string,
  ) =>
    command<{ version: number }>(`admin/cms/documents/${id}/publish`, {
      expectedVersion,
      revisionId,
      ...(reason ? { reason } : {}),
    }),
  withdraw: (id: string, expectedVersion: number) =>
    command<{ version: number }>(`admin/cms/documents/${id}/withdraw`, {
      expectedVersion,
    }),
  revert: (id: string, expectedVersion: number) =>
    command<{ version: number }>(`admin/cms/documents/${id}/revert`, {
      expectedVersion,
    }),
  preview: () =>
    command<{ token: string; expiresAt: string }>("admin/cms/preview", {}),
};

export type Status =
  "default" | "live" | "draft" | "hidden" | "withdrawn" | "new";
/** Where a key stands: built-in default, published override, unpublished draft, or hidden. */
export function statusOf(
  doc: DocSummary | undefined,
  hasDefault = true,
): Status {
  if (!doc) return hasDefault ? "default" : "new";
  if (doc.withdrawn) return "withdrawn";
  if (!doc.publishedRevisionId && hasDefault) return "default";
  if (doc.hidden && doc.publishedRevisionId && !doc.hasDraft) return "hidden";
  if (doc.hasDraft) return "draft";
  if (doc.publishedRevisionId) return "live";
  return hasDefault ? "default" : "new";
}
export const statusLabel: Record<
  Status,
  { text: string; tone: "neutral" | "info" | "success" | "warn" | "danger" }
> = {
  default: { text: "Mặc định", tone: "neutral" },
  new: { text: "Chưa có", tone: "neutral" },
  live: { text: "Đang hiển thị", tone: "success" },
  draft: { text: "Chưa áp dụng", tone: "warn" },
  hidden: { text: "Đang ẩn", tone: "neutral" },
  withdrawn: { text: "Đã gỡ", tone: "danger" },
};
export const kindPath: Record<Kind, string> = {
  SETTINGS: "/admin/cai-dat",
  NAVIGATION: "/admin/cai-dat?tab=menu",
  PAGE: "/admin/trang",
  SERVICE: "/admin/dich-vu",
  NEWS: "/admin/tin-tuc",
  ACCESSORY: "/admin/phu-kien",
  PROJECT: "/admin/thanh-qua",
  SEO: "/admin/seo",
  CATALOG: "/admin/thuong-hieu-danh-muc",
};
export const kindLabel: Record<Kind, string> = {
  SETTINGS: "Cài đặt",
  NAVIGATION: "Menu",
  PAGE: "Trang",
  SERVICE: "Dịch vụ",
  NEWS: "Tin tức",
  ACCESSORY: "Phụ kiện",
  PROJECT: "Thành quả",
  SEO: "SEO",
  CATALOG: "Thương hiệu & danh mục",
};
/** Admin URL that edits a document. */
export function editPath(kind: Kind, key: string) {
  if (kind === "PAGE")
    return key.startsWith("home.")
      ? `/admin/trang-chu/${key.slice(5)}`
      : `/admin/trang/${key}`;
  if (kind === "SEO") return `/admin/seo?path=${encodeURIComponent(key)}`;
  if (kind === "SETTINGS") return "/admin/cai-dat";
  if (kind === "NAVIGATION") return "/admin/cai-dat?tab=menu";
  if (kind === "CATALOG")
    return key === "vehicles" ? "/admin/hang-xe" : kindPath.CATALOG;
  return `${kindPath[kind]}/${key}`;
}
/** `typing` keeps a trailing "-" so the user can type the next word. */
export const slugify = (s: string, typing = false) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(typing ? /^-+/ : /^-+|-+$/g, "")
    .slice(0, 80);
/** Library image as a content image value. */
export const imageFromAsset = (a: CmsAsset): ImageValue => ({
  src: a.src,
  alt: a.alt,
  assetId: a.id,
});
