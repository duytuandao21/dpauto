// Merges the built-in website content with published CMS documents. Pure functions,
// shared by server pages and the client-side SiteContent context.
import { localPath } from "./public-paths";
import { servicePrice, servicePricing } from "./service-price";
import type { CmsAsset, PublicDocument } from "./api/cms";
import type { SiteImage } from "./content";
import type { IconName } from "@/components/ui/icon";
import { catalogId } from "./accessories";
import {
  defaultAccessories,
  defaultCatalog,
  defaultVehicles,
  defaultNavigation,
  defaultProjects,
  defaultServices,
  defaultSettings,
} from "./cms-defaults";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Payload = Record<string, any>;
export type Feed = {
  items: PublicDocument[];
  assets: Record<string, CmsAsset>;
};
type ImageValue =
  { src: string; alt: string; assetId?: string } | null | undefined;

export function image(
  v: ImageValue,
  assets: Feed["assets"],
): SiteImage | undefined {
  if (!v?.src) return undefined;
  const media = v.assetId ? assets[v.assetId] : undefined;
  // The API leaves deleted images out of the feed; skip them instead of rendering a broken URL.
  if (v.assetId && !media) return undefined;
  return media
    ? { src: media.src, alt: v.alt || media.alt, media }
    : { src: v.src, alt: v.alt };
}
export const images = (
  list: ImageValue[] | undefined,
  assets: Feed["assets"],
) =>
  (list || []).map((v) => image(v, assets)).filter((v): v is SiteImage => !!v);

/** Published payload for one key: undefined = no override, null = withdrawn (hide). */
export function documentFor(
  feed: Feed,
  kind: string,
  key: string,
): Payload | null | undefined {
  const d = feed.items.find((x) => x.kind === kind && x.key === key);
  if (!d) return undefined;
  return d.withdrawn ? null : (d.payload as Payload);
}
/** Built-in items with overrides applied, new CMS items appended, hidden/withdrawn removed, sorted. */
export function mergeList(
  feed: Feed,
  kind: string,
  defaults: { key: string; payload: Payload }[],
) {
  const out = new Map<
    string,
    { key: string; payload: Payload; order: number; isDefault: boolean }
  >();
  defaults.forEach((d, i) =>
    out.set(d.key, {
      key: d.key,
      payload: d.payload,
      order: d.payload.order ?? i,
      isDefault: true,
    }),
  );
  for (const d of feed.items) {
    if (d.kind !== kind) continue;
    if (d.withdrawn || !d.payload) {
      out.delete(d.key);
      continue;
    }
    const prev = out.get(d.key);
    const payload = { ...prev?.payload, ...(d.payload as Payload) };
    out.set(d.key, {
      key: d.key,
      payload,
      order: payload.order ?? prev?.order ?? 10000,
      isDefault: !!prev,
    });
  }
  return [...out.values()]
    .filter((x) => !x.payload.hidden)
    .sort((a, b) => a.order - b.order);
}

/* ---------- Rich text (Tiptap JSON) → escaped HTML from a whitelist ---------- */
type Node = {
  type: string;
  attrs?: Payload;
  content?: Node[];
  text?: string;
  marks?: { type: string; attrs?: Payload }[];
};
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const safeHref = (v: unknown) =>
  typeof v === "string" && /^(https:\/\/|tel:|mailto:|#|\/(?!\/))/i.test(v);
const safeSrc = (v: unknown) =>
  typeof v === "string" && /^(https:\/\/|\/(?!\/))/i.test(v);
const align = (a?: Payload) =>
  a?.textAlign && ["center", "right", "justify"].includes(a.textAlign)
    ? ` style="text-align:${a.textAlign}"`
    : "";
function youtube(src: string) {
  const id = src.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{6,20})/)?.[1];
  return id ? `https://www.youtube-nocookie.com/embed/${id}` : "";
}
export function richToHtml(
  node: Node | undefined,
  assets?: Feed["assets"],
): string {
  if (!node) return "";
  const inner = () =>
    (node.content || []).map((n) => richToHtml(n, assets)).join("");
  switch (node.type) {
    case "doc":
      return inner();
    case "text": {
      let t = esc(node.text || "");
      for (const m of node.marks || []) {
        if (m.type === "bold") t = `<strong>${t}</strong>`;
        else if (m.type === "italic") t = `<em>${t}</em>`;
        else if (m.type === "underline") t = `<u>${t}</u>`;
        else if (m.type === "strike") t = `<s>${t}</s>`;
        else if (m.type === "highlight") t = `<mark>${t}</mark>`;
        else if (m.type === "subscript") t = `<sub>${t}</sub>`;
        else if (m.type === "superscript") t = `<sup>${t}</sup>`;
        else if (m.type === "link" && safeHref(m.attrs?.href)) {
          const ext = /^https:\/\//i.test(m.attrs!.href);
          t = `<a href="${esc(m.attrs!.href)}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ""}>${t}</a>`;
        }
      }
      return t;
    }
    case "paragraph":
      return `<p${align(node.attrs)}>${inner()}</p>`;
    case "heading": {
      const l = [2, 3, 4].includes(Number(node.attrs?.level))
        ? Number(node.attrs!.level)
        : 2;
      return `<h${l}${align(node.attrs)}>${inner()}</h${l}>`;
    }
    case "bulletList":
      return `<ul>${inner()}</ul>`;
    case "orderedList":
      return `<ol${Number(node.attrs?.start) > 1 ? ` start="${Number(node.attrs!.start)}"` : ""}>${inner()}</ol>`;
    case "listItem":
      return `<li>${inner()}</li>`;
    case "taskList":
      return `<ul class="task-list">${inner()}</ul>`;
    case "taskItem":
      return `<li class="task-item"><input type="checkbox" disabled${node.attrs?.checked ? " checked" : ""} aria-hidden="true"> <span>${inner()}</span></li>`;
    case "blockquote":
      return `<blockquote>${inner()}</blockquote>`;
    case "horizontalRule":
      return "<hr>";
    case "hardBreak":
      return "<br>";
    case "image": {
      const id = node.attrs?.assetId,
        media = id && assets ? assets[id] : undefined,
        alt = esc(String(node.attrs?.alt || ""));
      // Deleted library images are left out of the feed: drop them instead of a broken picture.
      if (id && assets && !media) return "";
      if (media?.webp.length) {
        const set = (l: { url: string; width: number }[]) =>
          esc(l.map((v) => `${v.url} ${v.width}w`).join(", "));
        const sizes = "(max-width: 809px) 100vw, 800px";
        return `<picture>${media.avif.length ? `<source type="image/avif" srcset="${set(media.avif)}" sizes="${sizes}">` : ""}<img src="${esc(media.src)}" srcset="${set(media.webp)}" sizes="${sizes}" alt="${alt}" loading="lazy" decoding="async"></picture>`;
      }
      return safeSrc(node.attrs?.src)
        ? `<img src="${esc(node.attrs!.src)}" alt="${alt}" loading="lazy" decoding="async">`
        : "";
    }
    case "youtube": {
      const src = youtube(String(node.attrs?.src || ""));
      return src
        ? `<div class="rich-video"><iframe src="${src}" title="Video YouTube" loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`
        : "";
    }
    case "table":
      return `<div class="rich-table"><table><tbody>${inner()}</tbody></table></div>`;
    case "tableRow":
      return `<tr>${inner()}</tr>`;
    case "tableHeader":
      return `<th>${inner()}</th>`;
    case "tableCell":
      return `<td>${inner()}</td>`;
    default:
      return "";
  }
}

/* ---------- Typed merges ---------- */
export function siteSettings(feed: Feed) {
  const doc = documentFor(feed, "SETTINGS", "site");
  const p = { ...defaultSettings, ...(doc || {}), custom: !!doc };
  const digits = String(p.phone || "").replace(/[^\d+]/g, "");
  return {
    ...p,
    phoneHref: `tel:${digits.startsWith("0") ? "+84" + digits.slice(1) : digits}`,
    logoImage: image(p.logo, feed.assets),
    faviconImage: image(p.favicon, feed.assets),
  } as typeof defaultSettings & {
    phoneHref: string;
    logoImage?: SiteImage;
    faviconImage?: SiteImage;
    custom: boolean;
    socials: Record<string, string | undefined>;
  };
}
export function siteNavigation(feed: Feed) {
  const doc = documentFor(feed, "NAVIGATION", "main");
  const nav = {
    ...defaultNavigation,
    ...(doc || {}),
    custom: !!doc,
  } as typeof defaultNavigation & { custom: boolean };
  // Menus saved before the URLs were translated still hold the English paths.
  const fix = <T extends { href: string }>(l: T) => ({
    ...l,
    href: localPath(l.href),
  });
  return {
    ...nav,
    header: nav.header?.map(fix),
    footer: nav.footer?.map((g) => ({ ...g, links: g.links?.map(fix) })),
  };
}
const svcDefaults = new Map(defaultServices.map((d) => [d.key, d]));
export function siteServices(feed: Feed) {
  return mergeList(feed, "SERVICE", defaultServices).map(
    ({ key, payload: p }) => {
      const base = svcDefaults.get(key);
      return {
        key,
        // Public URL segment (/dich-vu/<slug>); older links by key redirect here.
        slug: String(p.slug || key),
        title: String(p.title || ""),
        description: String(p.description || ""),
        image: image(p.image, feed.assets) || {
          src: "/images/hero-dpauto.png",
          alt: String(p.title || ""),
        },
        overview: [] as { tag: string; text: string; html: string }[],
        overviewHtml: p.body
          ? richToHtml(p.body, feed.assets)
          : base?.html || "",
        overviewImages: images(p.overviewImages, feed.assets),
        processIntroduction: String(p.processIntroduction || ""),
        process: ((p.process || []) as Payload[]).map((s: Payload) => ({
          title: String(s.title || ""),
          description: String(s.text || ""),
        })),
        benefitsTitle: String(p.benefitsTitle || ""),
        benefitsIntroduction: String(p.benefitsIntroduction || ""),
        benefits: ((p.benefits || []) as Payload[]).map((s: Payload) => ({
          title: String(s.title || ""),
          description: String(s.text || ""),
        })),
        faqIntroduction: String(p.faqIntroduction || ""),
        faq: (p.faq || []) as { question: string; answer: string }[],
        gallery: images(p.gallery, feed.assets),
        videos: images(p.videos, feed.assets),
        priceFrom: p.priceFrom as string | undefined,
        price: servicePrice(p),
        pricing: servicePricing(p),
        icon: p.shortcutIcon as string | undefined,
        shortcutImage: image(p.shortcutImage, feed.assets),
        isDefault: !!base,
      };
    },
  );
}
export type SiteService = ReturnType<typeof siteServices>[number];
/** The service at a URL segment: its public slug, or its internal key (old links). */
export const findService = (list: SiteService[], segment: string) =>
  list.find((s) => s.slug === segment) || list.find((s) => s.key === segment);
const projDefaults = new Map<string, Payload>(
  defaultProjects.map((d) => [d.key, d.payload]),
);
export function siteProjects(feed: Feed) {
  return mergeList(feed, "PROJECT", defaultProjects).map(
    ({ key, payload: p }) => ({
      key,
      title: String(p.title || ""),
      vehicle: String(p.vehicle || ""),
      duration: String(p.duration || ""),
      services: String(p.services || ""),
      description: String(p.description || ""),
      before: image(p.before, feed.assets) ||
        image(projDefaults.get(key)?.before, {}) || { src: "", alt: "" },
      after: image(p.after, feed.assets) ||
        image(projDefaults.get(key)?.after, {}) || { src: "", alt: "" },
    }),
  );
}
export type SiteProject = ReturnType<typeof siteProjects>[number];
/** Accessory brands and categories from the CMS, or the built-in list until the admin saves one. */
export function siteCatalog(feed: Feed) {
  const p = (documentFor(feed, "CATALOG", "accessories") ||
    defaultCatalog) as Payload;
  return {
    brands: (
      (p.brands || []) as { id: string; name: string; logo?: ImageValue }[]
    ).map((b) => ({
      id: b.id,
      name: b.name,
      logo: image(b.logo, feed.assets),
    })),
    categories: (
      (p.categories || []) as { id: string; name: string; image?: ImageValue }[]
    ).map((c) => ({
      id: c.id,
      name: c.name,
      image: image(c.image, feed.assets),
    })),
  };
}
export type SiteCatalog = ReturnType<typeof siteCatalog>;
/** Car makes and models offered in the booking form. */
export function siteVehicles(feed: Feed) {
  const p = (documentFor(feed, "CATALOG", "vehicles") ||
    defaultVehicles) as Payload;
  return ((p.brands || []) as { name: string; models?: string[] }[]).map(
    (b) => ({ name: b.name, models: b.models || [] }),
  );
}
/** Entry a product points at: by id, or by the name older products stored. */
export const catalogEntry = <T extends { id: string; name: string }>(
  list: T[],
  value: unknown,
) => {
  const v = String(value || "");
  return v
    ? list.find((x) => x.id === v || x.name === v || x.id === catalogId(v))
    : undefined;
};
const accDefaults = new Map<string, Payload>(
  defaultAccessories.map((d) => [d.key, d.payload]),
);
export function siteAccessories(feed: Feed) {
  const catalog = siteCatalog(feed);
  return mergeList(feed, "ACCESSORY", defaultAccessories).map(
    ({ key, payload: p }) => {
      const own = images(p.images, feed.assets),
        pics = own.length ? own : images(accDefaults.get(key)?.images, {});
      return {
        id: key,
        name: String(p.name || ""),
        // Names from the catalogue; a brand or category removed there is dropped from the product.
        brand: catalogEntry(catalog.brands, p.brand)?.name || "",
        category: catalogEntry(catalog.categories, p.category)?.name || "",
        price: typeof p.price === "number" ? p.price : null,
        salePrice: typeof p.salePrice === "number" ? p.salePrice : null,
        description: String(p.description || ""),
        image: pics[0]?.src || "",
        media: pics[0]?.media,
        images: pics,
        featured: !!p.featured,
        // Detail page blocks; empty ones are not rendered.
        bodyHtml: p.body ? richToHtml(p.body, feed.assets) : "",
        highlights: ((p.highlights || []) as { text?: string }[])
          .map((h) => String(h.text || "").trim())
          .filter(Boolean),
        specs: ((p.specs || []) as { label?: string; value?: string }[]).filter(
          (x) => x.label?.trim() && x.value?.trim(),
        ) as {
          label: string;
          value: string;
          key?: boolean;
          icon?: IconName;
        }[],
        inBox: ((p.inBox || []) as { title?: string; image?: ImageValue }[])
          .filter((x) => x.title?.trim())
          .map((x) => ({
            title: String(x.title),
            image: image(x.image as ImageValue, feed.assets),
          })),
        faq: ((p.faq || []) as { question?: string; answer?: string }[])
          .filter((x) => x.question?.trim())
          .map((x) => ({
            question: String(x.question),
            answer: String(x.answer || ""),
          })),
      };
    },
  );
}
export type SiteAccessory = ReturnType<typeof siteAccessories>[number];
/** Section of a page key with its built-in defaults; null when the section is withdrawn or hidden. */
export function section<T extends Payload>(
  feed: Feed,
  key: string,
  defaults: T,
): (T & Payload) | null {
  const d = documentFor(feed, "PAGE", key);
  if (d === null || d?.hidden) return null;
  return { ...defaults, ...(d || {}) };
}
