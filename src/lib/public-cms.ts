import { cache } from "react";
import { mergePublishedArticles } from "./cms-content";
import type { Metadata } from "next";
import { articles as seedArticles, type Article } from "./content";
import { homeArticles } from "./home-vi";
import type { PublicDocument, CmsPayload } from "./api/cms";

export const publicContent = cache(async (): Promise<PublicDocument[]> => {
  if (process.env.NEXT_PUBLIC_API_ENABLED !== "true") return [];
  const origin = process.env.API_INTERNAL_URL || "http://127.0.0.1:4002";
  // shortcut: SSR reads share the backend IP read limit, configure trusted proxy handling before high-traffic deployment.
  const r = await fetch(`${origin}/api/v1/public/content`, {
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  if (!r.ok)
    throw new Error("Không tải được nội dung website. Vui lòng thử lại sau.");
  const value = await r.json();
  if (!Array.isArray(value?.data?.items))
    throw new Error("Nội dung website không hợp lệ.");
  return value.data.items;
});
export function cmsImage(p?: CmsPayload | null) {
  return p?.imageId
    ? { src: `/api/v1/public/cms/assets/${p.imageId}`, alt: p.title }
    : undefined;
}
export async function publicPage(key: string) {
  return (await publicContent()).find(
    (d) => d.kind === "PAGE" && d.key === key,
  );
}
export async function publicArticles(vietnamese = false): Promise<Article[]> {
  return mergePublishedArticles(
    vietnamese ? homeArticles : seedArticles,
    await publicContent(),
  );
}
export async function publicMetadata(
  path: string,
  fallback: Metadata,
): Promise<Metadata> {
  const content = await publicContent();
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
  const image = cmsImage(p);
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
