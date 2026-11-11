"use client";

import Image from "next/image";
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { useRef, useSyncExternalStore } from "react";
import { homeVi as home } from "@/lib/home-vi";
import { Photo } from "@/components/ui/photo";

const icons = [
  "award",
  "cog",
  "drill",
  "list-checks",
  "smile-plus",
  "calendar-cog",
];
const desktopDelays = [0, 0.2, 0.4, 0.2, 0.4, 0.6];

function subscribeToBreakpoints(notify: () => void) {
  const queries = [
    matchMedia("(min-width: 1200px)"),
    matchMedia("(min-width: 810px)"),
  ];
  queries.forEach((query) => query.addEventListener("change", notify));
  return () =>
    queries.forEach((query) => query.removeEventListener("change", notify));
}

function BenefitsImage() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end end"],
  });
  const progress = useSpring(scrollYProgress, {
    stiffness: 500,
    damping: 60,
    mass: 1,
  });
  const scale = useTransform(progress, [0, 1], [1.06, 1]);
  const y = useTransform(progress, [0, 1], [-10, 0]);
  const overlayY = useTransform(progress, [0, 1], [-500, 0]);

  return (
    <motion.div
      ref={ref}
      className="benefits-image"
      style={reduced ? undefined : { scale, y }}
    >
      <Photo
        src="/images/5jFIDmf3fDYVLCeKxRoGZM5XCA.webp"
        alt="Xe SUV trong xưởng chăm sóc ô tô HyperAuto Care"
        sizes="(max-width: 1400px) 100vw, 1400px"
      />
      <motion.div
        className="benefits-image-overlay"
        style={reduced ? undefined : { y: overlayY }}
        aria-hidden="true"
      />
    </motion.div>
  );
}

export function BenefitsSection() {
  const columns = useSyncExternalStore(
    subscribeToBreakpoints,
    () => (innerWidth >= 1200 ? 3 : innerWidth >= 810 ? 2 : 1),
    () => 3,
  );
  const reduced = useReducedMotion();

  return (
    <section className="benefits-section">
      <div className="container benefits-content">
        <div className="benefits-heading">
          <h2>Vì sao chọn HyperAuto Care?</h2>
        </div>
        <div className="benefits-grid">
          {home.benefits.map((benefit, index) => (
            <motion.div
              key={benefit.title}
              className="benefit-item"
              initial={reduced ? false : { opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{
                type: "spring",
                duration: columns === 1 ? 0.75 : 0.85,
                bounce: 0.2,
                delay:
                  columns === 3
                    ? desktopDelays[index]
                    : columns === 2
                      ? (index % 2) * 0.2
                      : 0,
              }}
            >
              <span className="benefit-accent" aria-hidden="true" />
              <span className="benefit-icon">
                <Image
                  src={`/icons/benefits/${icons[index]}.svg`}
                  width={28}
                  height={28}
                  alt=""
                />
              </span>
              <div className="benefit-copy">
                <h3>{benefit.title}</h3>
                <p>{benefit.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
      <BenefitsImage />
    </section>
  );
}
