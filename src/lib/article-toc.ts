export type TocItem = { id: string; text: string; level: 2 | 3 };

const entities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#39": "'",
  nbsp: " ",
};

/** Gives every h2/h3 in article HTML an anchor id and lists them for the table of contents. */
export function withHeadingIds(html: string) {
  const toc: TocItem[] = [];
  const used = new Set<string>();
  const out = html.replace(
    /<h([23])([^>]*)>([\s\S]*?)<\/h\1>/g,
    (all, level: string, attrs: string, inner: string) => {
      const text = inner
        .replace(/<[^>]*>/g, "")
        .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, e: string) => entities[e])
        .trim();
      if (!text) return all;
      const base =
        text
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/đ/gi, "d")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 60) || "muc";
      let id = base;
      for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
      used.add(id);
      toc.push({ id, text, level: Number(level) as 2 | 3 });
      // Drop any id the editor stored so anchors stay unique.
      const rest = attrs.replace(/\s+id\s*=\s*("[^"]*"|'[^']*')/i, "");
      return `<h${level} id="${id}"${rest}>${inner}</h${level}>`;
    },
  );
  return { html: out, toc };
}
