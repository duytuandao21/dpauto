// SEO helpers for service pages: default title, the admin checklist and opening hours for JSON-LD.

type Node = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: Node[];
};

/** Title used when the admin leaves "Tiêu đề SEO" empty; the site template adds "| DPAuto". */
export function defaultSeoTitle(title: string, year = new Date().getFullYear()) {
  return `${title} – Bảng giá ${year}`;
}

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();

/** Text, headings, images and links of a rich-text (Tiptap) document. */
function outline(doc: Node | undefined) {
  const paragraphs: string[] = [],
    headings: string[] = [],
    images: string[] = [],
    links: string[] = [];
  const text = (n: Node): string =>
    n.type === "text" ? n.text || "" : (n.content || []).map(text).join(" ");
  const walk = (n: Node) => {
    if (n.type === "paragraph") paragraphs.push(text(n));
    if (n.type === "heading") headings.push(text(n));
    if (n.type === "image") images.push(String(n.attrs?.alt || ""));
    for (const m of n.marks || [])
      if (m.type === "link") links.push(String(m.attrs?.href || ""));
    (n.content || []).forEach(walk);
  };
  if (doc) walk(doc);
  return { all: doc ? text(doc) : "", paragraphs, headings, images, links };
}

export type SeoCheck = { ok: boolean; text: string };

/** Advisory checklist shown in the service editor; nothing here blocks saving. */
export function seoChecks(input: {
  keyword?: string;
  title: string;
  description: string;
  slug: string;
  body?: Node;
  faqCount: number;
  hasBanner: boolean;
}): SeoCheck[] {
  const o = outline(input.body);
  const words = o.all.split(/\s+/).filter(Boolean).length;
  const k = fold(input.keyword || "");
  const has = (s: string) => fold(s).includes(k);
  const checks: SeoCheck[] = [];
  const t = input.title.length,
    d = input.description.length;
  checks.push({ ok: t >= 30 && t <= 60, text: `Tiêu đề ${t} ký tự (nên 30–60)` });
  checks.push({ ok: d >= 70 && d <= 160, text: `Mô tả ${d} ký tự (nên 70–160)` });
  if (k) {
    const kSlug = k.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    checks.push({ ok: has(input.title), text: "Từ khoá có trong tiêu đề SEO" });
    checks.push({ ok: has(input.description), text: "Từ khoá có trong mô tả" });
    checks.push({ ok: input.slug.includes(kSlug), text: "Từ khoá có trong đường dẫn" });
    checks.push({
      ok: has(o.paragraphs.find((p) => p.trim()) || ""),
      text: "Từ khoá có trong đoạn đầu bài",
    });
    checks.push({
      ok: o.headings.some(has),
      text: "Từ khoá có trong ít nhất một tiêu đề của bài",
    });
  } else checks.push({ ok: false, text: "Chưa nhập từ khoá chính" });
  checks.push({ ok: words >= 600, text: `Bài viết ${words} chữ (nên từ 600)` });
  checks.push({
    ok: o.images.length > 0 && o.images.every((a) => a.trim()),
    text: o.images.length
      ? `${o.images.filter((a) => !a.trim()).length} / ${o.images.length} ảnh chưa có mô tả`
      : "Bài chưa có ảnh",
  });
  checks.push({
    ok: o.links.some((h) => h.startsWith("/") || h.startsWith("#")),
    text: "Có link sang trang khác trong website",
  });
  checks.push({ ok: input.faqCount >= 3, text: `${input.faqCount} câu hỏi FAQ (nên từ 3)` });
  checks.push({ ok: input.hasBanner, text: "Có ảnh banner riêng" });
  return checks;
}

const days: [RegExp, string][] = [
  [/^(thu hai|t2)$/, "Mo"],
  [/^(thu ba|t3)$/, "Tu"],
  [/^(thu tu|t4)$/, "We"],
  [/^(thu nam|t5)$/, "Th"],
  [/^(thu sau|t6)$/, "Fr"],
  [/^(thu bay|t7)$/, "Sa"],
  [/^(chu nhat|cn)$/, "Su"],
];
const day = (s: string) => days.find(([r]) => r.test(fold(s)))?.[1];

/** "Thứ Hai – Thứ Sáu" / "08:00 – 18:00" → "Mo-Fr 08:00-18:00"; closed or unreadable rows are left out. */
export function openingHours(rows: { label: string; value: string }[]) {
  return rows.flatMap(({ label, value }) => {
    const span = label.split(/\s*[–-]\s*/).map(day);
    const time = value.match(/(\d{1,2})[:h](\d{2})\s*[–-]\s*(\d{1,2})[:h](\d{2})/);
    if (!span[0] || span.some((s) => !s) || span.length > 2 || !time) return [];
    const hm = (h: string, m: string) => `${h.padStart(2, "0")}:${m}`;
    return [
      `${span.join("-")} ${hm(time[1], time[2])}-${hm(time[3], time[4])}`,
    ];
  });
}

/** Drops a pasted <script type="application/ld+json"> wrapper, keeping the JSON inside. */
export const stripScriptTag = (text: string) =>
  text
    .trim()
    .replace(/^<script\b[^>]*>/i, "")
    .replace(/<\/script>$/i, "")
    .trim();

/** Admin-added JSON-LD: one object or a list, each with "@type". Returns the blocks or a Vietnamese error. */
export function parseJsonLd(
  text: string,
): { blocks: Record<string, unknown>[]; error?: undefined } | { blocks?: undefined; error: string } {
  if (!text.trim()) return { blocks: [] };
  if (text.length > 20000) return { error: "Tối đa 20.000 ký tự." };
  let value: unknown;
  try {
    value = JSON.parse(stripScriptTag(text));
  } catch {
    return { error: "JSON chưa hợp lệ (thiếu dấu ngoặc, dấu phẩy hoặc dấu nháy)." };
  }
  const list = Array.isArray(value) ? value : [value];
  if (
    !list.length ||
    !list.every(
      (b) => b && typeof b === "object" && !Array.isArray(b) && "@type" in b,
    )
  )
    return { error: "Mỗi khối phải là một đối tượng JSON có trường “@type”." };
  return {
    blocks: (list as Record<string, unknown>[]).map((b) => ({
      "@context": "https://schema.org",
      ...b,
    })),
  };
}
