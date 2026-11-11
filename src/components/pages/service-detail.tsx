import Link from "next/link";
import { services, site, type Service } from "@/lib/content";
import { Photo } from "@/components/ui/photo";
import { Button } from "@/components/ui/button";
import { FAQ } from "@/components/sections/faq";
import { WorkFinalCTA } from "@/components/sections/our-work-motion";
import { AboutGalleryImage } from "./about-motion";
import { ServiceHero } from "./service-detail-motion";

export function ServiceDetail({ service }: { service: Service }) {
  // These two process photos precede the four gallery photos in the archive.
  const hasProcessImages = service.slug === "detail-wash";
  const gallery = hasProcessImages ? service.gallery.slice(2) : service.gallery;
  const overviewHtml = service.overviewHtml.replace(/<img\b[^>]*>/g, (tag) => {
    const width = tag.match(/\bwidth="(\d+)"/)?.[1];
    return width ? tag.replace("<img", `<img style="width:${width}px"`) : tag;
  });
  const galleryTitle = (
    <h2 className="service-gallery-heading">
      <span>{service.title}</span> <span>Gallery</span>
    </h2>
  );
  const galleryImages = gallery.map((image, index) => (
    <div className="service-gallery-photo" key={image.src + index}>
      <Photo {...image} unoptimized sizes="(max-width: 809px) 100vw, 50vw" />
    </div>
  ));

  return (
    <div className="detail-page service-detail-page">
      <ServiceHero service={service} />
      <div className="container service-body">
        <div className="service-main">
          <section className="service-overview">
            <h2>Overview</h2>
            <div
              className="rich-content service-overview-content"
              dangerouslySetInnerHTML={{ __html: overviewHtml }}
            />
          </section>
          <section className="service-process">
            <div className="service-section-intro">
              <h2>Service Process</h2>
              <p>{service.processIntroduction}</p>
            </div>
            <div className="service-process-grid">
              {service.process.map((step, index) => (
                <div key={step.title} className="service-process-card">
                  {hasProcessImages && (index === 1 || index === 2) && (
                    <div className="service-process-image">
                      <AboutGalleryImage image={service.gallery[index - 1]} />
                    </div>
                  )}
                  <div className="service-process-row">
                    <span className="service-process-number">
                      Step {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="service-process-copy">
                      <h3>{step.title}</h3>
                      <p>{step.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="service-benefits">
            <div className="service-section-intro">
              <h2>{service.benefitsTitle}</h2>
              <p>{service.benefitsIntroduction}</p>
            </div>
            <div className="service-benefits-grid">
              {service.benefits.map((benefit) => (
                <div key={benefit.title} className="service-benefit-card">
                  <span className="service-benefit-accent" aria-hidden="true" />
                  <span className="service-benefit-icon" aria-hidden="true">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m4 12 5 5L20 6" />
                    </svg>
                  </span>
                  <div className="service-benefit-copy">
                    <h3>{benefit.title}</h3>
                    <p>{benefit.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <FAQ
            items={service.faq}
            description={service.faqIntroduction}
            compact
          />
          <div className="service-gallery-title-desktop">{galleryTitle}</div>
          <section className="service-mobile-gallery">
            {galleryTitle}
            <div className="service-gallery-grid">{galleryImages}</div>
          </section>
        </div>
        <aside className="service-sidebar">
          <div className="service-contact-card">
            <div className="service-contact-copy">
              <h3>Ready To Refresh Your Vehicle?</h3>
              <p>
                Give your car the professional care it deserves with HyperAuto
                Care.
              </p>
            </div>
            <div className="service-contact-actions">
              <Button href="/contact">Contact Us</Button>
              <Button href={site.phoneHref} variant="secondary" icon="phone">
                Call Us: {site.phone}
              </Button>
            </div>
          </div>
          <div className="other-services">
            <h3>Other Services</h3>
            <div className="other-services-list">
              {services
                .filter((item) => item.slug !== service.slug)
                .map((item) => (
                  <Link href={"/services/" + item.slug} key={item.slug}>
                    <Photo {...item.image} unoptimized />
                    <span>{item.title}</span>
                  </Link>
                ))}
            </div>
          </div>
        </aside>
      </div>
      <section className="service-gallery">
        <div className="service-gallery-grid">{galleryImages}</div>
      </section>
      <WorkFinalCTA />
    </div>
  );
}
