import type { MetadataRoute } from "next";
import { services } from "@/lib/content";
import { publicArticles, publicContent } from "@/lib/public-cms";

export const revalidate = 0;
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = process.env.NEXT_PUBLIC_SITE_URL;
  if (!origin) return [];
  const articles = await publicArticles(),
    content = await publicContent();
  const hidden = new Set(
    content
      .filter((d) => !d.withdrawn && d.payload?.noindex)
      .map((d) =>
        d.kind === "NEWS"
          ? "/news/" + d.key
          : d.kind === "SEO"
            ? d.key
            : d.key === "home.hero"
              ? "/"
              : "/" + d.key,
      ),
  );
  for (const d of content)
    if (d.kind === "PAGE" && d.withdrawn && !d.key.startsWith("home."))
      hidden.add("/" + d.key);
  return [
    "",
    "/services",
    "/our-work",
    "/phu-kien",
    "/news",
    "/about",
    "/contact",
    "/privacy",
    "/terms",
    ...services.map((s) => `/services/${s.slug}`),
    ...articles.map((a) => `/news/${a.slug}`),
  ]
    .filter((path) => !hidden.has(path || "/"))
    .map((path) => ({ url: `${origin.replace(/\/$/, "")}${path}` }));
}
