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
import { homeVi as home } from "@/lib/home-vi";
import { Photo } from "@/components/ui/photo";
import { HomeSectionHeading as SectionHeading } from "./home-motion";

function subscribeDesktop(notify: () => void) {
  const query = matchMedia("(min-width: 1200px)");
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
}

type Review = (typeof home.reviews)[number];
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
              className={`review-card ${review.name === "Michael R." ? "review-card--wide" : ""} ${review.name === "Jason M." ? "review-card--photo" : ""}`}
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
              {(review.name === "Jason M." || review.name === "Michael R.") && (
                <Photo
                  src={
                    review.name === "Jason M."
                      ? "/images/goYpkWeKDzA4B82FnuXUu7k24k.webp"
                      : "/images/Lkhwq0ZpwZj3WdTam0yk91jo.webp"
                  }
                  alt={`Đánh giá của ${review.name} tại HyperAuto Care`}
                  unoptimized
                />
              )}
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
  return (
    <section className="section light reviews-section">
      <div className="container">
        <SectionHeading
          title="Khách hàng nói gì?"
          description="Trải nghiệm thực tế của khách hàng tại HyperAuto Care."
        />
      </div>
      <Ticker reviews={home.reviews.slice(0, 3)} reverse />
      <Ticker reviews={home.reviews.slice(3)} />
    </section>
  );
}
