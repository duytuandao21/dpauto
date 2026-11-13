import type { Article } from "./content";
import type { PublicDocument } from "./api/cms";

export function mergePublishedArticles(
  seed: Article[],
  documents: PublicDocument[],
): Article[] {
  const result = new Map(seed.map((a) => [a.slug, a]));
  const published: Article[] = [];
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
  for (const d of documents) {
    if (d.kind !== "NEWS") continue;
    if (d.withdrawn) {
      result.delete(d.key);
      continue;
    }
    const p = d.payload;
    if (!p?.imageId) continue;
    result.delete(d.key);
    published.push({
      slug: d.key,
      title: p.title,
      description: p.description,
      category: p.category,
      date: p.date || "",
      image: { src: `/api/v1/public/cms/assets/${p.imageId}`, alt: p.title },
      content: p.blocks.map((b) => ({
        tag: b.tag,
        text: b.text,
        html: escape(b.text),
      })),
    });
  }
  return [
    ...published.sort(
      (a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug),
    ),
    ...result.values(),
  ];
}
