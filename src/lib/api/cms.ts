import type { AuthSession } from "./types";

export function canProvisionCmsAccounts(session: AuthSession | null) {
  return (
    !!session?.roles.includes("MANAGER") &&
    session.permissions.includes("roles.manage") &&
    session.permissions.includes("staff.manage")
  );
}
export function canOpenCms(session: AuthSession | null) {
  return (
    !!session?.permissions.includes("cms.read") ||
    canProvisionCmsAccounts(session)
  );
}

export type CmsKind = "NEWS" | "PAGE" | "SEO";
export type CmsBlock = {
  tag: "p" | "h2" | "h3" | "li" | "blockquote";
  text: string;
};
export type CmsPayload = {
  title: string;
  description: string;
  imageId: string | null;
  blocks: CmsBlock[];
  noindex: boolean;
  category: string;
  date?: string;
};
export type CmsDocument = {
  id: string;
  kind: CmsKind;
  key: string;
  title: string;
  version: number;
  updatedAt: string;
  publishedRevisionId: string | null;
  withdrawn: boolean;
};
export type CmsRevision = {
  id: string;
  number: number;
  payload: CmsPayload;
  createdAt: string;
};
export type CmsDetail = Omit<CmsDocument, "title" | "updatedAt"> & {
  revisions: CmsRevision[];
  hasOlderRevisions: boolean;
};
export type CmsAsset = {
  id: string;
  name: string;
  alt: string;
  createdAt: string;
};
export type PublicDocument = {
  kind: CmsKind;
  key: string;
  withdrawn: boolean;
  revisionId: string | null;
  payload: CmsPayload | null;
};
export const cmsPages: Record<string, string> = {
  "home.hero": "Trang chủ · Hero",
  "home.services": "Trang chủ · Dịch vụ",
  "home.pricing": "Trang chủ · Bảng giá",
  "home.cta": "Trang chủ · Liên hệ cuối trang",
  about: "Giới thiệu",
  contact: "Liên hệ",
  privacy: "Chính sách bảo mật",
  terms: "Điều khoản",
};
export function blocksToText(blocks: CmsBlock[]) {
  return blocks
    .map(
      (b) =>
        (b.tag === "h2"
          ? "## "
          : b.tag === "h3"
            ? "### "
            : b.tag === "li"
              ? "- "
              : b.tag === "blockquote"
                ? "> "
                : "") + b.text,
    )
    .join("\n\n");
}
export function textToBlocks(value: string): CmsBlock[] {
  return value
    .split(/\n\s*\n/)
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => ({
      tag: v.startsWith("### ")
        ? "h3"
        : v.startsWith("## ")
          ? "h2"
          : v.startsWith("- ")
            ? "li"
            : v.startsWith("> ")
              ? "blockquote"
              : "p",
      text: v.replace(/^(### |## |- |> )/, ""),
    }));
}
