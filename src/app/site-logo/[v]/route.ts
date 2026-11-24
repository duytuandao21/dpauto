import { publicFeed } from "@/lib/public-cms";
import { siteSettings } from "@/lib/site-content";

// Serves the logo uploaded in "Cài đặt website" from this origin: the footer WebGL effect reads
// its pixels (the R2 bucket sends no CORS headers), and the favicon and admin use a fixed URL.
// `/site-logo/<asset id>` may be cached long; `/site-logo/current` must follow logo changes.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ v: string }> },
) {
  const { v } = await params;
  const settings = siteSettings(await publicFeed());
  // `/site-logo/favicon` prefers the uploaded favicon and falls back to the logo.
  const media =
    (v === "favicon" && settings.faviconImage?.media) ||
    settings.logoImage?.media;
  if (!media)
    return Response.redirect(new URL("/images/logo-dpauto.png", request.url), 302);
  const r = await fetch(media.src, { signal: AbortSignal.timeout(10000) });
  if (!r.ok) return new Response(null, { status: 502 });
  return new Response(r.body, {
    headers: {
      "content-type": r.headers.get("content-type") || "image/webp",
      "cache-control": `public, max-age=${v === media.id ? 86400 : 300}`,
    },
  });
}
