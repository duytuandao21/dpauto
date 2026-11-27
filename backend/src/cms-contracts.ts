import { z } from "zod";
import { date, instant, pagination, uuid } from "./common";

/** Website content kinds. Seed data in the frontend is the default; a document overrides one key. */
export const cmsKinds = [
  "SETTINGS",
  "NAVIGATION",
  "PAGE",
  "SERVICE",
  "NEWS",
  "ACCESSORY",
  "PROJECT",
  "SEO",
  "CATALOG",
] as const;
export const pageKeys = [
  "home.hero",
  "home.intro",
  "home.services",
  "home.accessories",
  "home.process",
  "home.pricing",
  "home.work",
  "home.gallery",
  "home.benefits",
  "home.reviews",
  "home.brands",
  "home.news",
  "home.faq",
  "home.location",
  "home.cta",
  "about",
  "contact",
  "privacy",
  "terms",
  "services",
  "our-work",
  "news",
  "phu-kien",
];
// Lowercase ASCII letters, digits and single hyphens only.
export const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const seoPath =
  /^(\/|\/(news|services|dich-vu)(\/[a-z0-9]+(?:-[a-z0-9]+)*)?|\/(about|contact|privacy|terms|our-work|phu-kien|chinh-sach-dat-lich))$/;

const str = (n: number) => z.string().trim().max(n);
const opt = (n: number) => str(n).optional();
/** Links allowed in content: https, phone, mail, in-page anchors and same-site paths. */
export const safeHref = (v: string) =>
  v === "" || /^(https:\/\/|tel:|mailto:|#|\/(?!\/))/i.test(v);
const href = str(600).refine(safeHref, "UNSAFE_LINK");
const imageSrc = str(600).refine(
  (v) => v === "" || /^(https:\/\/|\/(?!\/))/i.test(v),
  "UNSAFE_IMAGE",
);
export const image = z.strictObject({
  src: imageSrc,
  alt: str(240),
  assetId: uuid.optional(),
});
const link = z.strictObject({ label: str(80), href });

// Tiptap JSON: only known nodes/marks, safe links and images; size is bounded at the document level.
const nodeTypes = [
  "doc",
  "paragraph",
  "text",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "taskList",
  "taskItem",
  "blockquote",
  "horizontalRule",
  "hardBreak",
  "image",
  "youtube",
  "table",
  "tableRow",
  "tableHeader",
  "tableCell",
] as const;
const markTypes = [
  "bold",
  "italic",
  "underline",
  "strike",
  "highlight",
  "link",
  "subscript",
  "superscript",
] as const;
const attrValue = z.union([
  z.string().max(600),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.number()).max(20),
]);
const attrs = z.record(z.string().max(40), attrValue);
const mark = z
  .strictObject({ type: z.enum(markTypes), attrs: attrs.optional() })
  .refine(
    (m) => m.type !== "link" || safeHref(String(m.attrs?.href ?? "")),
    "UNSAFE_LINK",
  );
type RichNode = {
  type: (typeof nodeTypes)[number];
  attrs?: Record<string, unknown>;
  content?: RichNode[];
  text?: string;
  marks?: z.infer<typeof mark>[];
};
const richNode: z.ZodType<RichNode> = z.lazy(() =>
  z
    .strictObject({
      type: z.enum(nodeTypes),
      attrs: attrs.optional(),
      content: z.array(richNode).max(2000).optional(),
      text: z.string().max(20000).optional(),
      marks: z.array(mark).max(10).optional(),
    })
    .refine(
      (n) =>
        n.type !== "image" ||
        /^(https:\/\/|\/(?!\/))/i.test(String(n.attrs?.src ?? "")),
      "UNSAFE_IMAGE",
    )
    .refine(
      (n) =>
        n.type !== "youtube" ||
        /^https:\/\/(www\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)\//i.test(
          String(n.attrs?.src ?? ""),
        ),
      "UNSAFE_EMBED",
    )
    .refine(
      (n) =>
        n.type !== "heading" || [2, 3, 4].includes(Number(n.attrs?.level ?? 2)),
      "HEADING_LEVEL",
    ),
);
export const rich = richNode.refine(
  (d) => d.type === "doc" && JSON.stringify(d).length <= 200_000,
  "RICH_TEXT_INVALID",
);

const block = z.strictObject({
  tag: z.enum(["p", "h2", "h3", "li", "blockquote"]),
  text: str(4000).min(1),
});
/** Fields of the first CMS version; old revisions still validate and render. */
const legacy = {
  imageId: uuid.nullable().optional(),
  blocks: z.array(block).max(100).optional(),
  noindex: z.boolean().optional(),
  category: opt(80),
  date: date.optional(),
};
const item = z.strictObject({
  title: opt(200),
  text: opt(3000),
  image: image.nullable().optional(),
  href: href.optional(),
  label: opt(120),
  price: opt(60),
  note: opt(200),
  rating: z.number().min(0).max(5).optional(),
  author: opt(120),
  meta: opt(200),
  features: z.array(str(200)).max(30).optional(),
});
const titled = z.strictObject({ title: str(200), text: str(3000) });
const qa = z.strictObject({ question: str(300), answer: str(3000) });
const listing = {
  hidden: z.boolean().optional(),
  order: z.number().int().min(0).max(100000).optional(),
};

const sectionFields = {
  ...legacy,
  hidden: z.boolean().optional(),
  eyebrow: opt(120),
  title: opt(180),
  subtitle: opt(200),
  description: opt(1000),
  note: opt(600),
  body: rich.optional(),
  image: image.nullable().optional(),
  images: z.array(image).max(60).optional(),
  /** Uploaded videos (assets with kind "video"); the workshop gallery shows two. */
  videos: z.array(image).max(2).optional(),
  /** Home hero: photos that rotate automatically (image-only hero). */
  slides: z.array(image).max(10).optional(),
  /** Home intro: words of the title shown in brand red, and a YouTube video (used before an uploaded one). */
  highlight: opt(120),
  youtube: str(600)
    .refine((v) => v === "" || /^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(v), "UNSAFE_EMBED")
    .optional(),
  cta: link.optional(),
  cta2: link.optional(),
  items: z.array(item).max(60).optional(),
};
const sectionPart = z.strictObject(sectionFields).optional();
const section = z.strictObject({
  ...sectionFields,
  /** About page blocks, edited together with its banner. */
  parts: z
    .strictObject({
      story: sectionPart,
      approach: sectionPart,
      workshop: sectionPart,
      team: sectionPart,
    })
    .optional(),
});
const service = z.strictObject({
  ...legacy,
  ...listing,
  title: str(180).min(1),
  /** Public URL (/dich-vu/<slug>); the document key stays the internal id. */
  slug: z.string().max(120).regex(slug).optional(),
  description: str(1000).default(""),
  image: image.nullable().optional(),
  body: rich.optional(),
  overviewImages: z.array(image).max(20).optional(),
  processIntroduction: opt(1000),
  process: z.array(titled).max(30).optional(),
  benefitsTitle: opt(180),
  benefitsIntroduction: opt(1000),
  benefits: z.array(titled).max(30).optional(),
  faqIntroduction: opt(1000),
  faq: z.array(qa).max(40).optional(),
  gallery: z.array(image).max(60).optional(),
  /** Up to two uploaded videos, shown with the gallery photos. */
  videos: z.array(image).max(2).optional(),
  /** Legacy free-text price; new edits use priceKind + priceAmount. */
  priceFrom: opt(60),
  /** Card price: "Giá từ" / "Giá chỉ" + amount in VND; absent = "Liên hệ báo giá". */
  priceKind: z.enum(["FROM", "FIXED"]).optional(),
  priceAmount: z.number().int().min(1).max(10_000_000_000).optional(),
  /**
   * Detail-page price table, separate from the card price. Columns (e.g. vehicle types) carry an
   * id so renaming/reordering them keeps each package's prices; no columns = one "Giá" column ("_").
   */
  pricingColumns: z
    .array(z.strictObject({ id: str(12).min(1), name: str(40) }))
    .max(6)
    .optional(),
  pricing: z
    .array(
      z.strictObject({
        name: str(120),
        text: opt(300),
        featured: z.boolean().optional(),
        prices: z
          .record(z.string().max(12), z.number().int().min(1).max(10_000_000_000))
          .optional(),
      }),
    )
    .max(30)
    .optional(),
  pricingNote: opt(300),
  /** Homepage shortcut icon: an uploaded image (transparent PNG), else a line icon by name
   * (serviceIcons in src/components/ui/icon.tsx), else the site's default icon image. */
  shortcutImage: image.nullable().optional(),
  /** Detail-page banner; absent = the card image. */
  banner: image.nullable().optional(),
  /** Search/share overrides; empty = title "<name> – Bảng giá <year>", the short description, the banner. */
  seoTitle: opt(180),
  seoDescription: opt(500),
  /** Only drives the admin checklist; never sent to search engines. */
  seoKeyword: opt(120),
  seoImage: image.nullable().optional(),
  /** Extra JSON-LD added to the page's own; one object or a list, each with "@type". */
  seoSchema: z
    .string()
    .max(20000)
    .refine((v) => {
      if (!v.trim()) return true;
      try {
        const value: unknown = JSON.parse(v);
        const list = Array.isArray(value) ? value : [value];
        return (
          list.length > 0 &&
          list.every((b) => b && typeof b === "object" && !Array.isArray(b) && "@type" in b)
        );
      } catch {
        return false;
      }
    }, "INVALID_JSON_LD")
    .optional(),
  shortcutIcon: opt(20),
  /** Work time in minutes; drives booking availability (synced to the operations service). */
  durationMinutes: z.number().int().min(15).max(1440).optional(),
});
const news = z.strictObject({
  ...legacy,
  hidden: z.boolean().optional(),
  title: str(180).min(1),
  description: str(1000).default(""),
  image: image.nullable().optional(),
  body: rich.optional(),
  author: opt(120),
  publishAt: instant.optional(),
});
const money = z.number().int().min(0).max(10_000_000_000).nullable().optional();
const accessory = z.strictObject({
  ...listing,
  name: str(180).min(1),
  brand: str(80).default(""),
  category: str(80).default(""),
  price: money,
  salePrice: money,
  description: str(2000).default(""),
  body: rich.optional(),
  images: z.array(image).max(20).default([]),
  featured: z.boolean().optional(),
  source: href.optional(),
  // Detail page (/phu-kien/[slug]); every block is optional and hidden when empty.
  highlights: z.array(z.strictObject({ text: str(200) })).max(8).optional(),
  // `key`: also shown in the strip under the photos; icon names match specIcons in src/components/ui/icon.tsx.
  specs: z
    .array(
      z.strictObject({
        label: str(80),
        value: str(200),
        key: z.boolean().optional(),
        icon: z
          .enum(["camera","angle","screen","memory","battery","bolt","wifi","pin","moon","volume","ruler","layers","drop","sun","car","shield","tool","sparkles","star"])
          .optional(),
      }),
    )
    .max(40)
    .optional(),
  inBox: z
    .array(z.strictObject({ title: str(120), image: image.nullable().optional() }))
    .max(20)
    .optional(),
  faq: z.array(qa).max(40).optional(),
});
const project = z.strictObject({
  ...listing,
  title: str(180).min(1),
  vehicle: str(180).default(""),
  duration: str(80).default(""),
  services: str(300).default(""),
  description: str(2000).default(""),
  before: image.nullable().default(null),
  after: image.nullable().default(null),
});
const settings = z.strictObject({
  name: str(120).min(1),
  tagline: opt(200),
  phone: str(40).default(""),
  email: str(160).default(""),
  address: str(300).default(""),
  city: opt(200),
  directions: href.optional(),
  mapEmbed: str(2000)
    .refine(
      (v) => v === "" || /^https:\/\/(www\.)?google\.[a-z.]+\/maps\//i.test(v),
    )
    .optional(),
  hours: z
    .array(z.strictObject({ label: str(80), value: str(120) }))
    .max(14)
    .default([]),
  socials: z
    .strictObject({
      facebook: href.optional(),
      zalo: href.optional(),
      youtube: href.optional(),
      tiktok: href.optional(),
      instagram: href.optional(),
    })
    .optional(),
  logo: image.nullable().optional(),
  favicon: image.nullable().optional(),
  footerText: opt(500),
});
const navigation = z.strictObject({
  header: z.array(link).max(12).default([]),
  footer: z
    .array(z.strictObject({ title: str(80), links: z.array(link).max(12) }))
    .max(6)
    .default([]),
});
const seo = z.strictObject({
  ...legacy,
  title: str(180).min(1),
  description: str(500).default(""),
  image: image.nullable().optional(),
});
// Accessory brands (with filter logos) and categories; products reference them by id.
const catalogEntry = { id: z.string().max(60).regex(slug), name: str(80).min(1) };
const catalog = z
  .strictObject({
    brands: z
      .array(z.strictObject({ ...catalogEntry, logo: image.nullable().optional() }))
      .max(60)
      .default([]),
    // `image`: homepage shortcut tile for the category (transparent PNG).
    categories: z
      .array(z.strictObject({ ...catalogEntry, image: image.nullable().optional() }))
      .max(60)
      .default([]),
  })
  .refine(
    (c) =>
      new Set(c.brands.map((b) => b.id)).size === c.brands.length &&
      new Set(c.categories.map((b) => b.id)).size === c.categories.length,
    { message: "Mã thương hiệu/danh mục bị trùng." },
  );
/** Car makes and their models for the booking form (CATALOG "vehicles"). */
export const vehicleCatalog = z.strictObject({
  brands: z
    .array(
      z.strictObject({
        name: str(60).min(1),
        models: z.array(str(60).min(1)).max(200).default([]),
      }),
    )
    .max(200)
    .default([]),
});
export const payloadSchemas = {
  SETTINGS: settings,
  NAVIGATION: navigation,
  PAGE: section,
  SERVICE: service,
  NEWS: news,
  ACCESSORY: accessory,
  PROJECT: project,
  SEO: seo,
  CATALOG: catalog,
} as const;

export const cmsQuery = z.strictObject({
  ...pagination,
  kind: z.enum(cmsKinds).optional(),
  key: z.string().trim().max(180).optional(),
  search: z.string().trim().max(120).optional(),
});
// Payloads are validated per kind in Cms.save once the kind is known.
export const cmsCreate = z.strictObject({
  kind: z.enum(cmsKinds),
  key: str(180).min(1),
  /** True only when the admin saves its first edit of a built-in item. */
  builtIn: z.boolean().optional(),
  payload: z.record(z.string(), z.unknown()),
});
export const cmsSave = z.strictObject({
  expectedVersion: z.number().int().min(1),
  payload: z.record(z.string(), z.unknown()),
});
const reason = z.string().trim().max(500).optional();
export const cmsPublish = z.strictObject({
  expectedVersion: z.number().int().min(1),
  revisionId: uuid,
  reason,
});
export const cmsCommand = z.strictObject({
  expectedVersion: z.number().int().min(1),
  reason,
});
export const activityQuery = z.strictObject({ ...pagination });
export const previewToken = z.strictObject({});
