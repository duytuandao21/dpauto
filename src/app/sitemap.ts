import type { MetadataRoute } from "next";
import { services, articles } from "@/lib/content";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = process.env.NEXT_PUBLIC_SITE_URL;
  if (!origin) return [];
  return [
    "",
    "/services",
    "/our-work",
    "/news",
    "/about",
    "/contact",
    "/privacy",
    "/terms",
    ...services.map((s) => `/services/${s.slug}`),
    ...articles.map((a) => `/news/${a.slug}`),
  ].map((path) => ({ url: `${origin.replace(/\/$/, "")}${path}` }));
}
