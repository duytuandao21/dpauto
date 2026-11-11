import type { ReactNode } from "react";
import { Photo } from "@/components/ui/photo";
import { Button } from "@/components/ui/button";
import { Reveal, ParallaxPhoto } from "@/components/motion/reveal";
import { site, type ContentBlock, type SiteImage } from "@/lib/content";

export function SectionHeading({
  title,
  description,
  children,
  centered = false,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
  centered?: boolean;
}) {
  return (
    <Reveal
      className={`section-heading ${centered ? "section-heading--centered" : ""}`}
    >
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {children}
    </Reveal>
  );
}

export function PageBanner({
  title,
  image,
}: {
  title: string;
  image: SiteImage;
}) {
  return (
    <section className="page-banner">
      <Photo {...image} priority sizes="100vw" />
      <div className="banner-shade" />
      <div className="container">
        <Reveal>
          <h1>{title}</h1>
        </Reveal>
      </div>
    </section>
  );
}

export function FinalCTA({ vietnamese = false }: { vietnamese?: boolean }) {
  return (
    <section className="final-cta">
      <ParallaxPhoto
        image={{
          src: "/images/tzpnoVuiPL9CIASVtJD4w77vGPQ.jpg",
          alt: vietnamese
            ? "Xe Mercedes màu bạc trong xưởng chăm sóc ô tô"
            : "Silver Mercedes sedan displayed inside a clean professional automotive workshop",
        }}
      />
      <div className="final-cta-shade" />
      <Reveal className="container final-cta-content">
        <h2>
          {vietnamese
            ? "Chăm chút xứng tầm cho xe của bạn"
            : "Give Your Vehicle the Care It Deserves"}
        </h2>
        <p>
          {vietnamese
            ? "Từ làm sạch đến bảo vệ lâu dài, HyperAuto Care luôn đồng hành để xe bạn bền đẹp."
            : "From routine detailing to long-term protection, HyperAuto Care is here to help keep your vehicle looking its best."}
        </p>
        <div className="button-row">
          <Button href="/contact">
            {vietnamese ? "Liên hệ ngay" : "Contact Us"}
          </Button>
          <Button href={site.phoneHref} variant="secondary" icon="phone">
            {vietnamese ? "Gọi ngay" : "Call Now"}
          </Button>
        </div>
      </Reveal>
    </section>
  );
}

export function RichContent({
  blocks,
  className = "",
}: {
  blocks: ContentBlock[];
  className?: string;
}) {
  // Markup is generated exclusively from the archived reference, never user input.
  const html = blocks
    .map(
      (b) =>
        `<${["h1", "h2", "h3", "h4", "h5", "h6", "p", "li"].includes(b.tag) ? b.tag : "p"}>${b.html}</${["h1", "h2", "h3", "h4", "h5", "h6", "p", "li"].includes(b.tag) ? b.tag : "p"}>`,
    )
    .join("")
    .replace(/(?:<li>[\s\S]*?<\/li>)+/g, "<ul>$&</ul>");
  return (
    <div
      className={`rich-content ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
