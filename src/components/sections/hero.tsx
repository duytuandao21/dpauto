"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Photo } from "@/components/ui/photo";
import { homeDefaults } from "@/lib/home-defaults";
import { useImage, useSection } from "@/components/site/site-content";
import type { CmsPayload } from "@/lib/api/cms";
import type { SiteImage } from "@/lib/content";

const interval = 5000;

/** Image-only hero: admin photos crossfade every 5s; dots show the count and the current one. */
export function Hero({ copy }: { copy?: CmsPayload | null }) {
  const resolve = useImage();
  const hero =
    useSection("home.hero", homeDefaults["home.hero"]) ||
    homeDefaults["home.hero"];
  // Before slides existed the hero had one background; legacy pages saved only imageId.
  const background: SiteImage =
    resolve(hero.image) ||
    (copy?.imageId
      ? {
          src: `/api/v1/public/cms/assets/${copy.imageId}`,
          alt: hero.image.alt,
          media: copy.image,
        }
      : homeDefaults["home.hero"].image);
  const uploaded = (
    ((hero as { slides?: unknown }).slides || []) as Parameters<
      typeof resolve
    >[0][]
  )
    .map((s) => resolve(s))
    .filter((s): s is SiteImage => !!s?.src);
  const slides = uploaded.length ? uploaded : [background];
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useReducedMotion();
  const swipe = useRef<number | null>(null);
  const current = index % count;

  // Restarts on every change, so a dot tap also gets the full 5 seconds.
  useEffect(() => {
    if (count < 2 || paused || reduced) return;
    const timer = setTimeout(() => setIndex((i) => (i + 1) % count), interval);
    return () => clearTimeout(timer);
  }, [current, count, paused, reduced]);

  const go = (step: number) => setIndex((current + step + count) % count);
  return (
    <section
      className="hero-slider"
      aria-roledescription="carousel"
      aria-label="Hình ảnh DPAuto"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onPointerDown={(e) => {
        if (e.pointerType !== "mouse") swipe.current = e.clientX;
      }}
      onPointerUp={(e) => {
        const start = swipe.current;
        swipe.current = null;
        if (start === null || count < 2) return;
        const dx = e.clientX - start;
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
      }}
      onPointerCancel={() => (swipe.current = null)}
    >
      <h1 className="hero-slider-title">{hero.title}</h1>
      {slides.map((image, i) => (
        <div
          key={image.src + i}
          className="hero-slide"
          data-active={i === current || undefined}
          role="group"
          aria-roledescription="slide"
          aria-label={`${i + 1} / ${count}`}
          aria-hidden={i !== current}
        >
          <Photo {...image} priority={i === 0} sizes="100vw" />
        </div>
      ))}
      {count > 1 && (
        <div className="hero-slider-dots">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Xem ảnh ${i + 1}`}
              aria-current={i === current || undefined}
              onClick={() => setIndex(i)}
            >
              <span />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
