"use client";
import { ComparisonCarousel } from "@/components/media/comparison-carousel";
import { homeDefaults } from "@/lib/home-defaults";
import { useImage, useSection } from "@/components/site/site-content";
import {
  AboutGalleryImage as GalleryImage,
  AboutVideo as GalleryVideo,
} from "@/components/pages/about-motion";
import { Button } from "@/components/ui/button";
import { HomeSectionHeading as SectionHeading } from "./home-motion";
import { HomeSocialLink } from "./home-motion";

const defaultGallery = homeDefaults["home.gallery"].images;
const defaultVideos = [
  "/videos/3N4aS6LLHk8XXKgD51R21mRi8Q.webm",
  "/videos/xReQmqj0OIZCmYSNJTLGTz63324.webm",
];
export function WorkSection() {
  const section = useSection("home.work", homeDefaults["home.work"]);
  if (!section) return null;
  return (
    <section className="section light home-work">
      <div className="container">
        <SectionHeading
          title={section.title}
          description={section.description}
        />
      </div>
      <div className="container work-results">
        <ComparisonCarousel />
        <div className="section-bottom">
          <Button href={section.cta?.href || "/thanh-qua"} variant="secondary">
            {section.cta?.label || "Xem thêm thành quả"}
          </Button>
        </div>
      </div>
    </section>
  );
}

export function SocialGallery() {
  const section = useSection("home.gallery", homeDefaults["home.gallery"]),
    resolve = useImage();
  if (!section) return null;
  // The mosaic has four photo slots around two videos; empty slots fall back to the originals.
  const galleryImages = [0, 1, 2, 3].map((i) =>
    resolve(section.images?.[i], defaultGallery[i])!,
  );
  const videos = [0, 1].map(
    (i) => resolve(section.videos?.[i])?.src || defaultVideos[i],
  );
  return (
    <section className="light social-gallery">
      <div className="container">
        <div className="social-gallery-heading">
          <h3>{section.title}</h3>
        </div>
      </div>
      <div className="social-mosaic">
        <GalleryImage image={galleryImages[0]} />
        <GalleryVideo src={videos[0]} />
        <GalleryImage image={galleryImages[1]} />
        <GalleryVideo src={videos[1]} />
        <GalleryImage image={galleryImages[2]} />
        <GalleryImage image={galleryImages[3]} />
      </div>
      <div className="social-gallery-actions button-row">
        {section.cta?.href && (
          <HomeSocialLink href={section.cta.href} icon="facebook">
            {section.cta.label}
          </HomeSocialLink>
        )}
        {section.cta2?.href && (
          <HomeSocialLink href={section.cta2.href} icon="tiktok">
            {section.cta2.label}
          </HomeSocialLink>
        )}
      </div>
    </section>
  );
}
