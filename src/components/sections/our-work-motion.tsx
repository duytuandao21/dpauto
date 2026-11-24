"use client";

import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { useRef } from "react";
import { Photo } from "@/components/ui/photo";
import { Button } from "@/components/ui/button";
import { BookingLauncher } from "@/components/public-booking/booking-dialog";
import { site, type SiteImage } from "@/lib/content";
import { cmsImageSrc, type CmsAsset } from "@/lib/api/cms";
import { pageDefaults } from "@/lib/page-defaults";
import { homeDefaults } from "@/lib/home-defaults";
import { useImage, useSection, useSite } from "@/components/site/site-content";

const imageSpring = { stiffness: 500, damping: 60, mass: 1 };

export function WorkBanner({
  pageKey = "our-work",
}: {
  pageKey?: "our-work" | "contact";
}) {
  const banner =
      useSection(pageKey, pageDefaults[pageKey]) || pageDefaults[pageKey],
    title = banner.title,
    image: SiteImage = useImage()(banner.image, pageDefaults[pageKey].image)!;
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, imageSpring);
  const scale = useTransform(progress, [0, 1], [1, 1.4]);
  return (
    <section className="work-banner">
      <motion.div
        className="work-banner-image"
        style={reduced ? undefined : { scale }}
      >
        <Photo {...image} priority sizes="100vw" />
      </motion.div>
      <div className="work-banner-overlay" />
      <div className="container work-banner-heading">
        <h1>{title}</h1>
      </div>
    </section>
  );
}

export function WorkFinalCTA({
  vietnamese = true,
  copy,
}: {
  vietnamese?: boolean;
  copy?: {
    title: string;
    description: string;
    imageId: string | null;
    image?: CmsAsset;
  };
}) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end end"],
  });
  const progress = useSpring(scrollYProgress, imageSpring);
  const scale = useTransform(progress, [0, 1], [1.06, 1]);
  const y = useTransform(progress, [0, 1], [-60, 0]);
  const cta = useSection("home.cta", homeDefaults["home.cta"]),
    { settings } = useSite(),
    resolve = useImage();
  if (!cta) return null;
  const photo = copy?.imageId
    ? {
        src: cmsImageSrc(copy),
        alt: homeDefaults["home.cta"].image.alt,
        media: copy.image,
      }
    : resolve(cta.image, homeDefaults["home.cta"].image)!;
  return (
    <section className="work-final-cta" ref={ref}>
      <motion.div
        className="work-final-cta-image"
        style={reduced ? undefined : { scale, y }}
      >
        <Photo
          src={photo.src}
          media={photo.media}
          alt={
            vietnamese
              ? photo.alt
              : "Silver Mercedes sedan displayed inside a clean professional automotive workshop"
          }
          sizes="100vw"
        />
      </motion.div>
      <div className="container work-final-cta-content">
        <div className="work-final-cta-panel">
          <div className="work-final-cta-inset" aria-hidden="true" />
          <h2>
            {copy?.title ??
              (vietnamese
                ? cta.title
                : "Give Your Vehicle the Care It Deserves")}
          </h2>
          <p>
            {copy?.description ??
              (vietnamese
                ? cta.description
                : "From routine detailing to long-term protection, DPAuto is here to help keep your vehicle looking its best.")}
          </p>
          <div className="work-final-cta-actions">
            <BookingLauncher label="Đặt lịch ngay" />
            <Button
              href={
                cta.cta2?.href ||
                (settings.custom ? settings.phoneHref : site.phoneHref)
              }
              variant="secondary"
              icon="phone"
            >
              {vietnamese ? cta.cta2?.label || "Gọi ngay" : "Call Now"}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
