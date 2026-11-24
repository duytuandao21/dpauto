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

export type CmsKind =
  | "SETTINGS"
  | "NAVIGATION"
  | "PAGE"
  | "SERVICE"
  | "NEWS"
  | "ACCESSORY"
  | "PROJECT"
  | "SEO";
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
  /** Present only in the public feed: the resolved image for imageId. */
  image?: CmsAsset;
};
export type CmsImageSource = { width: number; url: string };
export type CmsAsset = {
  id: string;
  /** "video": an uploaded MP4/WebM stored as-is; `src` is the file itself. */
  kind?: "image" | "video";
  name: string;
  alt: string;
  createdAt: string;
  deletedAt: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  mime: string;
  focal: { x: number; y: number };
  placeholder: string | null;
  /** Largest WebP, or the legacy endpoint for images not yet moved to storage. */
  src: string;
  avif: CmsImageSource[];
  webp: CmsImageSource[];
  og: string | null;
};
/** Public URL for a payload's image: stored variant when available, legacy endpoint otherwise. */
export const cmsImageSrc = (p: Pick<CmsPayload, "imageId" | "image">) =>
  p.image?.src || `/api/v1/public/cms/assets/${p.imageId}`;
export type CmsAssetUsage = {
  id: string;
  kind: CmsKind;
  key: string;
  title: string | null;
  live: boolean;
};
export type PublicDocument = {
  kind: CmsKind;
  key: string;
  withdrawn: boolean;
  revisionId: string | null;
  payload: CmsPayload | null;
};
