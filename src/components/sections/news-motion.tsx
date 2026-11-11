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
import { Button } from "@/components/ui/button";
import type { SiteImage } from "@/lib/content";

export function NewsCardFrame({
  image,
  children,
  className = "",
  originalImages = false,
}: {
  image: SiteImage;
  children: ReactNode;
  className?: string;
  originalImages?: boolean;
}) {
  const imageRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: imageRef,
    offset: ["start end", "end end"],
  });
  const progress = useSpring(scrollYProgress, {
    stiffness: 254,
    damping: 60,
    mass: 1,
  });
  const y = useTransform(progress, [0, 1], [0, 60]);
  const scrollScale = useTransform(progress, [0, 1], [1.06, 1]);
  const hoverScale = useSpring(1, {
    duration: 0.6,
    bounce: 0.2,
  });
  const scale = useTransform(() =>
    Math.max(scrollScale.get(), hoverScale.get()),
  );

  return (
    <motion.article
      className={`news-card ${className}`}
      onHoverStart={() => hoverScale.set(1.06)}
      onHoverEnd={() => hoverScale.set(1)}
    >
      <div className="news-card-image">
        <motion.div
          ref={imageRef}
          className="news-card-image-inner"
          style={reduced ? { y: 60 } : { y, scale }}
        >
          <Photo
            {...image}
            unoptimized={originalImages}
            sizes="(max-width: 809px) 100vw, (max-width: 1199px) 50vw, 33vw"
          />
        </motion.div>
      </div>
      {children}
    </motion.article>
  );
}

export function NewsButton({
  href,
  children,
  light = false,
}: {
  href: string;
  children: ReactNode;
  light?: boolean;
}) {
  return (
    <Button
      href={href}
      className={`news-button ${light ? "news-button--light" : ""}`}
      variant={light ? "light" : "secondary"}
    >
      {children}
    </Button>
  );
}
