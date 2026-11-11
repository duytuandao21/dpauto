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
import { site, type SiteImage } from "@/lib/content";

const imageSpring = { stiffness: 500, damping: 60, mass: 1 };

export function WorkBanner({
  title = "Our Work",
  image = {
    src: "/images/5jFIDmf3fDYVLCeKxRoGZM5XCA.webp",
    alt: "Black SUV with doors open inside a detailing workshop",
  },
}: {
  title?: string;
  image?: SiteImage;
}) {
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
        <Photo {...image} priority unoptimized sizes="100vw" />
      </motion.div>
      <div className="work-banner-overlay" />
      <div className="container work-banner-heading">
        <h1>{title}</h1>
      </div>
    </section>
  );
}

export function WorkFinalCTA({ vietnamese = false }: { vietnamese?: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end end"],
  });
  const progress = useSpring(scrollYProgress, imageSpring);
  const scale = useTransform(progress, [0, 1], [1.06, 1]);
  const y = useTransform(progress, [0, 1], [-60, 0]);
  return (
    <section className="work-final-cta" ref={ref}>
      <motion.div
        className="work-final-cta-image"
        style={reduced ? undefined : { scale, y }}
      >
        <Photo
          src="/images/tzpnoVuiPL9CIASVtJD4w77vGPQ.jpg"
          alt={
            vietnamese
              ? "Xe Mercedes màu bạc trong xưởng chăm sóc ô tô"
              : "Silver Mercedes sedan displayed inside a clean professional automotive workshop"
          }
          unoptimized
          sizes="100vw"
        />
      </motion.div>
      <div className="container work-final-cta-content">
        <div className="work-final-cta-panel">
          <div className="work-final-cta-inset" aria-hidden="true" />
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
          <div className="work-final-cta-actions">
            <Button href="/contact">
              {vietnamese ? "Liên hệ ngay" : "Contact Us"}
            </Button>
            <Button href={site.phoneHref} variant="secondary" icon="phone">
              {vietnamese ? "Gọi ngay" : "Call Now"}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
