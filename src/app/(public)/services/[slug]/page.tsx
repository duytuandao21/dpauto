import { notFound, permanentRedirect } from "next/navigation";
import { publicFeed } from "@/lib/public-cms";
import { findService, siteServices } from "@/lib/site-content";

// Service pages moved to /dich-vu/<slug>; old links (by internal key) redirect permanently.
export default async function OldServicePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  let { slug } = await params;
  // The PPF page once lived at a slug with parentheses.
  if (decodeURIComponent(slug) === "paint-protection-film-(ppf)")
    slug = "paint-protection-film-ppf";
  const service = findService(siteServices(await publicFeed()), slug);
  if (!service) notFound();
  permanentRedirect("/dich-vu/" + service.slug);
}
