import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { services as builtIn } from "@/lib/content";
import { ServiceDetail } from "@/components/pages/service-detail";
import { publicFeed, publicMetadata } from "@/lib/public-cms";
import { findService, siteServices, siteSettings } from "@/lib/site-content";

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
  // SEO settings saved in the admin stay keyed by "/services/<key>".
  return {
    ...(await publicMetadata("/services/" + (service?.key || slug), {
      title: service?.title,
      description: service?.description,
    })),
    alternates: { canonical: "/dich-vu/" + (service?.slug || slug) },
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
  return (
    <ServiceDetail
      service={service}
      others={services.filter((s) => s.key !== service.key)}
      phone={
        settings.custom
          ? { text: settings.phone, href: settings.phoneHref }
          : undefined
      }
    />
  );
}
