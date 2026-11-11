"use client";

import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { Photo } from "@/components/ui/photo";
import type { Service } from "@/lib/content";

export function ServiceHero({ service }: { service: Service }) {
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, {
    stiffness: 500,
    damping: 60,
    mass: 1,
  });
  const scale = useTransform(progress, [0, 1], [1, 1.4]);
  return (
    <section className="service-hero">
      <motion.div
        className="service-hero-image"
        style={reduced ? undefined : { scale }}
      >
        <Photo {...service.image} priority unoptimized sizes="100vw" />
        <div className="service-hero-shade" />
      </motion.div>
      <div className="container service-hero-copy">
        <span className="eyebrow">SERVICE</span>
        <h1>{service.title}</h1>
        <p>{service.description}</p>
      </div>
    </section>
  );
}
