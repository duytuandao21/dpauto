import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { services as builtIn } from "@/lib/content";
import { ServiceDetail } from "@/components/pages/service-detail";
import { publicFeed, publicMetadata } from "@/lib/public-cms";
import { findService, siteServices, siteSettings } from "@/lib/site-content";
import { defaultSeoTitle, parseJsonLd } from "@/lib/service-seo";
import { serviceJsonLd } from "@/lib/structured-data";
import { JsonLd } from "@/components/seo/json-ld";

// Services added in the CMS have no built-in page, so unknown slugs are resolved per request.
export function generateStaticParams() {
  return builtIn.map((service) => ({ slug: service.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const service = findService(siteServices(await publicFeed()), slug);
  // SEO saved in the service wins; older settings from the SEO page ("/services/<key>") come next.
  const base = await publicMetadata("/services/" + (service?.key || slug), {
    title: service ? defaultSeoTitle(service.title) : undefined,
    description: service?.description,
  });
  if (!service) return base;
  const title = service.seoTitle || base.title,
    description = service.seoDescription || base.description;
  const share = service.seoImage || (base.openGraph?.images ? undefined : service.banner || service.image);
  return {
    ...base,
    title,
    description,
    robots: {
      index:
        !service.noindex &&
        (typeof base.robots === "object" ? base.robots?.index !== false : true),
      follow: true,
    },
    openGraph: {
      ...base.openGraph,
      type: "website",
      title: title as string,
      description: description || undefined,
      url: "/dich-vu/" + service.slug,
      ...(share ? { images: [share.media?.og || share.src] } : {}),
    },
    alternates: { canonical: "/dich-vu/" + service.slug },
  };
}
export default async function ServicePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const feed = await publicFeed(),
    services = siteServices(feed),
    service = findService(services, slug);
  if (!service) notFound();
  if (service.slug !== slug) permanentRedirect("/dich-vu/" + service.slug);
  const settings = siteSettings(feed);
  // Admin-added blocks go next to the generated ones; invalid text (saved before checks) is skipped.
  const extra = parseJsonLd(service.seoSchema || "").blocks || [];
  return (
    <>
    <JsonLd data={serviceJsonLd(service, settings)} />
    {extra.map((block, i) => (
      <JsonLd key={i} data={block} />
    ))}
    <ServiceDetail
      service={service}
      others={services.filter((s) => s.key !== service.key)}
      phone={
        settings.custom
          ? { text: settings.phone, href: settings.phoneHref }
          : undefined
      }
    />
    </>
  );
}
