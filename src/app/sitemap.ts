import { localPath } from "@/lib/public-paths";
import type { MetadataRoute } from "next";
import { publicArticles, publicContent, publicFeed } from "@/lib/public-cms";
import { siteServices } from "@/lib/site-content";

export const revalidate = 0;
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = process.env.NEXT_PUBLIC_SITE_URL;
  if (!origin) return [];
  const articles = await publicArticles(),
    content = await publicContent(),
    services = siteServices(await publicFeed());
  // SEO settings are keyed by the old "/services/<key>" path; map them to the public URL.
  const servicePath = new Map(
    services.map((s) => ["/services/" + s.key, "/dich-vu/" + s.slug]),
  );
  const hidden = new Set(
    content
      .filter((d) => !d.withdrawn && d.payload?.noindex)
      .map((d) =>
        d.kind === "NEWS"
          ? "/tin-tuc/" + d.key
          : d.kind === "SERVICE"
            ? "/dich-vu/" + (services.find((s) => s.key === d.key)?.slug || d.key)
          : d.kind === "SEO"
            ? servicePath.get(d.key) ||
              (d.key === "/services" ? "/dich-vu" : localPath(d.key))
            : d.key === "home.hero"
              ? "/"
              : localPath("/" + d.key),
      ),
  );
  for (const d of content)
    if (d.kind === "PAGE" && d.withdrawn && !d.key.startsWith("home."))
      hidden.add(localPath("/" + d.key));
  return [
    "",
    "/dich-vu",
    "/thanh-qua",
    "/phu-kien",
    "/tin-tuc",
    "/gioi-thieu",
    "/lien-he",
    "/chinh-sach-bao-mat",
    "/dieu-khoan-dich-vu",
    ...services.map((s) => `/dich-vu/${s.slug}`),
    ...articles.map((a) => `/tin-tuc/${a.slug}`),
  ]
    .filter((path) => !hidden.has(path || "/"))
    .map((path) => ({ url: `${origin.replace(/\/$/, "")}${path}` }));
}
