import { Photo } from "@/components/ui/photo";
import type { SiteImage } from "@/lib/content";

/** Banner as wide as the content below, image only; the article below starts right after it. */
export function ServiceHero({
  service,
}: {
  service: { title: string; image: SiteImage; banner?: SiteImage };
}) {
  return (
    <section className="container service-banner">
      <div className="service-banner-image">
        <Photo
          {...(service.banner || service.image)}
          priority
          sizes="(max-width: 809px) 100vw, 1280px"
        />
      </div>
      {/* The article carries its own visible title; this one is for Google and screen readers. */}
      <h1 className="service-banner-title">{service.title}</h1>
    </section>
  );
}
