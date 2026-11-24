"use client";

import {
  useAnimationFrame,
  useInView,
  useMotionValue,
  useReducedMotion,
  motion,
} from "motion/react";
import {
  useRef,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent,
} from "react";
import { homeDefaults } from "@/lib/home-defaults";
import { useImage, useSection } from "@/components/site/site-content";
import type { SiteImage } from "@/lib/content";
import { Photo } from "@/components/ui/photo";
import { HomeSectionHeading as SectionHeading } from "./home-motion";

function subscribeDesktop(notify: () => void) {
  const query = matchMedia("(min-width: 1200px)");
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
}

type Review = {
  name: string;
  text: string;
  service: string;
  photo?: SiteImage;
  layout?: string;
};
function Ticker({
  reviews,
  reverse = false,
}: {
  reviews: Review[];
  reverse?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null),
    track = useRef<HTMLDivElement>(null),
    drag = useRef<{ x: number; offset: number } | null>(null);
  const x = useMotionValue(0),
    offset = useRef(0);
  const inView = useInView(ref);
  const desktop = useSyncExternalStore(
    subscribeDesktop,
    () => matchMedia("(min-width: 1200px)").matches,
    () => true,
  );
  const reduced = useReducedMotion();
  useAnimationFrame((_, delta) => {
    if (!desktop || !inView || reduced || drag.current || !track.current)
      return;
    const width = track.current.scrollWidth / 3;
    offset.current += ((reverse ? 1 : -1) * 40 * delta) / 1000;
    offset.current = ((offset.current % width) + width) % width;
    x.set(offset.current - width);
  });
  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (!desktop || e.pointerType === "touch") return;
    drag.current = { x: e.clientX, offset: offset.current };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  return (
    <div
      className={`review-ticker ${reverse ? "review-ticker--reverse" : ""}`}
      ref={ref}
      onPointerDown={down}
      onPointerMove={(e) => {
        if (drag.current) {
          offset.current = drag.current.offset + e.clientX - drag.current.x;
          x.set(offset.current - (track.current?.scrollWidth ?? 0) / 3);
        }
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
    >
      <motion.div className="review-track" ref={track} style={{ x }}>
        {[0, 1, 2].flatMap((copy) =>
          reviews.map((review) => (
            <article
              key={`${copy}-${review.name}`}
              className={`review-card ${review.photo && review.layout === "wide" ? "review-card--wide" : ""} ${review.photo && review.layout !== "wide" ? "review-card--photo" : ""}`}
              aria-hidden={copy !== 0}
              data-review-copy={copy}
              data-review-name={review.name}
              style={
                {
                  "--review-width": reverse
                    ? "calc((100cqw - 24px) / 3)"
                    : "calc((60cqw - 36px) / 3)",
                } as CSSProperties
              }
            >
              {review.photo && <Photo {...review.photo} />}
              <p>{review.text}</p>
              <div>
                <h3>{review.name}</h3>
                <span>{review.service}</span>
              </div>
            </article>
          )),
        )}
      </motion.div>
    </div>
  );
}

export function ReviewsSection() {
  const section = useSection("home.reviews", homeDefaults["home.reviews"]),
    resolve = useImage();
  if (!section) return null;
  const reviews: Review[] = (
    section.items as {
      author?: string;
      text?: string;
      meta?: string;
      image?: SiteImage | null;
      label?: string;
    }[]
  ).map((r) => ({
    name: r.author || "",
    text: r.text || "",
    service: r.meta || "",
    photo: resolve(r.image),
    layout: r.label,
  }));
  // Two rows that scroll in opposite directions, split like the original 3 + 4 layout.
  const split = Math.ceil(reviews.length * (3 / 7));
  return (
    <section className="section light reviews-section">
      <div className="container">
        <SectionHeading
          title={section.title}
          description={section.description}
        />
      </div>
      <Ticker reviews={reviews.slice(0, split)} reverse />
      <Ticker reviews={reviews.slice(split)} />
    </section>
  );
}
