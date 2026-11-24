import { cache } from "react";
import { cookies, draftMode } from "next/headers";
import { image as resolveImage, type Feed } from "./site-content";
import { PREVIEW_COOKIE } from "./preview";
import { mergePublishedArticles } from "./cms-content";
import type { Metadata } from "next";
import { articles as seedArticles, type Article } from "./content";
import { homeArticles } from "./home-vi";
import { cmsImageSrc, type PublicDocument, type CmsPayload } from "./api/cms";

const empty: Feed = { items: [], assets: {} };
/** Published website content; in Next draft mode (admin preview) the latest drafts instead. */
export const publicFeed = cache(
  async (): Promise<Feed & { preview: boolean }> => {
    if (process.env.NEXT_PUBLIC_API_ENABLED !== "true")
      return { ...empty, preview: false };
    const origin = process.env.API_INTERNAL_URL || "http://127.0.0.1:4002";
    let token: string | undefined;
    try {
      if ((await draftMode()).isEnabled)
        token = (await cookies()).get(PREVIEW_COOKIE)?.value;
    } catch {}
    // shortcut: SSR reads share the backend IP read limit, configure trusted proxy handling before high-traffic deployment.
    let r: Response;
    try {
      r = await fetch(
        token
          ? `${origin}/api/v1/public/cms/preview?token=${encodeURIComponent(token)}`
          : `${origin}/api/v1/public/content`,
        { cache: "no-store", signal: AbortSignal.timeout(5000) },
      );
    } catch (e) {
      // Backend unreachable (stopped, restarting, timeout): serve the built-in content instead of a 500 page.
      console.warn(
        `[public-cms] Không kết nối được backend ${origin}, dùng nội dung mặc định:`,
        (e as Error & { cause?: Error }).cause?.message || (e as Error).message,
      );
      return { ...empty, preview: false };
    }
    if (!r.ok) {
      // An expired preview link falls back to the live website instead of an error page.
      if (token && r.status === 403) {
        const live = await fetch(`${origin}/api/v1/public/content`, {
          cache: "no-store",
          signal: AbortSignal.timeout(5000),
        });
        if (live.ok) {
          const v = await live.json();
          return {
            items: v.data.items,
            assets: v.data.assets || {},
            preview: false,
          };
        }
      }
      throw new Error("Không tải được nội dung website. Vui lòng thử lại sau.");
    }
    const value = await r.json();
    if (!Array.isArray(value?.data?.items))
      throw new Error("Nội dung website không hợp lệ.");
    return {
      items: value.data.items,
      assets: value.data.assets || {},
      preview: !!token,
    };
  },
);
export const publicContent = async (): Promise<PublicDocument[]> =>
  (await publicFeed()).items;
export function cmsImage(p?: CmsPayload | null) {
  return p?.imageId
    ? { src: p.image?.og || cmsImageSrc(p), alt: p.title }
    : undefined;
}
export async function publicPage(key: string) {
  return (await publicContent()).find(
    (d) => d.kind === "PAGE" && d.key === key,
  );
}
export async function publicArticles(vietnamese = false): Promise<Article[]> {
  const feed = await publicFeed();
  return mergePublishedArticles(
    vietnamese ? homeArticles : seedArticles,
    feed.items,
    feed.assets,
  );
}
export async function publicMetadata(
  path: string,
  fallback: Metadata,
): Promise<Metadata> {
  const feed = await publicFeed(),
    content = feed.items;
  const page = content.find(
    (d) =>
      d.kind === "PAGE" &&
      d.key === (path === "/" ? "home.hero" : path.slice(1)) &&
      !d.withdrawn,
  );
  const d =
      content.find((d) => d.kind === "SEO" && d.key === path && !d.withdrawn) ||
      page,
    p = d?.payload;
  if (!p) return fallback;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const value = (p as any).image?.src
    ? resolveImage((p as any).image, feed.assets)
    : undefined;
  const image = value
    ? { src: value.media?.og || value.src, alt: value.alt }
    : cmsImage(p);
  return {
    ...fallback,
    title: p.title,
    description: p.description,
    robots: {
      index:
        !p.noindex &&
        !page?.payload?.noindex &&
        !(
          typeof fallback.robots === "object" &&
          fallback.robots?.index === false
        ),
      follow: true,
    },
    openGraph: {
      title: p.title,
      description: p.description,
      ...(image ? { images: [image.src] } : {}),
    },
  };
}
