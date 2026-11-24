import type { Article, SiteImage } from "./content";
import { cmsImageSrc, type CmsAsset, type PublicDocument } from "./api/cms";
import { image as resolveImage, richToHtml } from "./site-content";

const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c]!,
  );
/** CMS dates are YYYY-MM-DD; the website shows DD/MM/YYYY like the built-in articles. */
const shown = (d: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(d) ? d.split("-").reverse().join("/") : d;

export function mergePublishedArticles(
  seed: Article[],
  documents: PublicDocument[],
  assets: Record<string, CmsAsset> = {},
): Article[] {
  const result = new Map(seed.map((a) => [a.slug, a]));
  const published: (Article & { sort: string })[] = [];
  for (const d of documents) {
    if (d.kind !== "NEWS") continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = d.payload as any;
    if (d.withdrawn || p?.hidden) {
      result.delete(d.key);
      continue;
    }
    const image: SiteImage | undefined = p?.image?.src
      ? resolveImage(p.image, assets)
      : p?.imageId
        ? {
            src: cmsImageSrc(p),
            alt: p.title,
            media: p.image?.webp ? p.image : assets[p.imageId],
          }
        : undefined;
    if (!p || !image) continue;
    result.delete(d.key);
    published.push({
      slug: d.key,
      title: p.title,
      description: p.description,
      category: p.category || "",
      date: shown(p.date || ""),
      sort: p.date || "",
      image,
      content: p.body
        ? [{ tag: "html", text: "", html: richToHtml(p.body, assets) }]
        : p.blocks?.length
          ? p.blocks.map((b: { tag: string; text: string }) => ({
              tag: b.tag,
              text: b.text,
              html: escape(b.text),
            }))
          : // An edited built-in article keeps its original body until the body itself is changed.
            seed.find((a) => a.slug === d.key)?.content || [],
    });
  }
  return [
    ...published
      .sort(
        (a, b) => b.sort.localeCompare(a.sort) || a.slug.localeCompare(b.slug),
      )
      .map(({ sort: _, ...a }) => a),
    ...result.values(),
  ];
}
