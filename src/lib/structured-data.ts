// schema.org JSON-LD for Google: the business (every public page) and each service page.
import type { SiteImage } from "./content";
import type { SiteService, siteSettings } from "./site-content";
import { openingHours } from "./service-seo";

type Settings = ReturnType<typeof siteSettings>;

const origin = () => (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
const abs = (path: string) => (/^https?:\/\//.test(path) ? path : origin() + path);
const imageUrl = (i?: SiteImage) => (i ? abs(i.media?.og || i.src) : undefined);
const businessId = () => origin() + "/#business";

export function businessJsonLd(s: Settings) {
  const hours = openingHours(s.hours || []);
  return {
    "@context": "https://schema.org",
    "@type": "AutoRepair",
    "@id": businessId(),
    name: s.name,
    url: origin() + "/",
    telephone: s.phone,
    ...(s.email ? { email: s.email } : {}),
    ...(s.logoImage ? { logo: imageUrl(s.logoImage), image: imageUrl(s.logoImage) } : {}),
    address: {
      "@type": "PostalAddress",
      streetAddress: s.address,
      addressLocality: s.city,
      addressCountry: "VN",
    },
    ...(s.directions ? { hasMap: s.directions } : {}),
    ...(hours.length ? { openingHours: hours } : {}),
    sameAs: Object.values(s.socials || {}).filter(Boolean),
  };
}

export function serviceJsonLd(service: SiteService, s: Settings) {
  const url = origin() + "/dich-vu/" + service.slug;
  const price = service.price;
  const graph: Record<string, unknown>[] = [
    {
      "@type": "Service",
      "@id": url + "#service",
      name: service.title,
      serviceType: service.title,
      description: service.seoDescription || service.description,
      url,
      image: imageUrl(service.banner || service.image),
      provider: { "@id": businessId() },
      areaServed: s.city,
      ...(price
        ? {
            offers:
              price.kind === "FROM"
                ? { "@type": "AggregateOffer", priceCurrency: "VND", lowPrice: price.amount }
                : { "@type": "Offer", priceCurrency: "VND", price: price.amount },
          }
        : {}),
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        ["Trang chủ", "/"],
        ["Dịch vụ", "/dich-vu"],
        [service.title, "/dich-vu/" + service.slug],
      ].map(([name, path], i) => ({
        "@type": "ListItem",
        position: i + 1,
        name,
        item: origin() + path,
      })),
    },
  ];
  const faq = service.faq.filter((f) => f.question && f.answer);
  if (faq.length)
    graph.push({
      "@type": "FAQPage",
      mainEntity: faq.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
    });
  return { "@context": "https://schema.org", "@graph": graph };
}
