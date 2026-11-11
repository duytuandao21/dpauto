"use client";

import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { useRef, type ReactNode } from "react";
import { Photo } from "@/components/ui/photo";
import type { SiteImage } from "@/lib/content";

export function Reveal({
  children,
  className = "",
  delay = 0,
  card = false,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  card?: boolean;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={
        reduced
          ? false
          : card
            ? { opacity: 0, x: 24, y: 48, rotateX: 6, rotateY: 20 }
            : { opacity: 0, y: 35 }
      }
      whileInView={{ opacity: 1, x: 0, y: 0, rotateX: 0, rotateY: 0 }}
      viewport={{ once: true, amount: 0.08 }}
      transition={
        card
          ? { type: "spring", stiffness: 500, damping: 60, mass: 1, delay }
          : { duration: 0.65, ease: [0.44, 0, 0.56, 1], delay }
      }
    >
      {children}
    </motion.div>
  );
}

export function ParallaxPhoto({
  image,
  className = "",
  strong = false,
}: {
  image: SiteImage;
  className?: string;
  strong?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const progress = useSpring(scrollYProgress, {
    stiffness: 500,
    damping: 60,
    mass: 1,
  });
  const y = useTransform(progress, [0, 1], strong ? [-40, 160] : [-45, 45]);
  const scale = useTransform(progress, [0, 1], [1.15, 1]);
  return (
    <div ref={ref} className={`parallax-photo ${className}`}>
      <motion.div
        className="parallax-photo__inner"
        style={reduced ? undefined : { y, scale }}
      >
        <Photo {...image} sizes="100vw" />
      </motion.div>
    </div>
  );
}
