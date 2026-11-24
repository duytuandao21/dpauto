"use client";
import { pageDefaults } from "@/lib/page-defaults";
import { useImage, useSection } from "@/components/site/site-content";

import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { useRef, type ReactNode } from "react";
import { Photo } from "@/components/ui/photo";
import { banners, type SiteImage } from "@/lib/content";

export function NewsBanner() {
  const banner = useSection("news", pageDefaults.news) || pageDefaults.news,
    image = useImage()(banner.image, banners.news)!;
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, {
    stiffness: 500,
    damping: 60,
    mass: 1,
  });
  const scale = useTransform(progress, [0, 1], [1, 1.4]);

  return (
    <section className="news-page-banner">
      <motion.div
        className="news-page-banner-image"
        style={reduced ? undefined : { scale }}
      >
        <Photo {...image} priority sizes="100vw" />
      </motion.div>
      <div className="news-page-banner-overlay" />
      <div className="container news-page-banner-heading">
        <h1>{banner.title}</h1>
      </div>
    </section>
  );
}

export function FeaturedArticleFrame({
  image,
  heading,
  children,
}: {
  image: SiteImage;
  heading: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start center", "end center"],
  });
  const progress = useSpring(scrollYProgress, {
    stiffness: 254,
    damping: 60,
    mass: 1,
  });
  const y = useTransform(progress, [0, 1], [0, 60]);
  const scale = useTransform(progress, [0, 1], [1.06, 1]);

  return (
    <section className="light featured-section" ref={ref}>
      <div className="container">
        <div className="featured-heading">{heading}</div>
        <article className="featured-article">
          <div className="featured-article-image">
            <motion.div
              className="featured-article-image-inner"
              style={reduced ? { y: 60 } : { y, scale }}
            >
              <Photo
                {...image}
                sizes="(max-width: 809px) 100vw, 50vw"
              />
            </motion.div>
          </div>
          <div className="featured-article-copy">{children}</div>
        </article>
      </div>
    </section>
  );
}
