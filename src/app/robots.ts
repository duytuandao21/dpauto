import type { MetadataRoute } from "next";

// shortcut: the demo blocks all crawlers; allow "/" and add the sitemap when the site goes live.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
