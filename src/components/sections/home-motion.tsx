"use client";

import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";

type StartTransform = {
  x?: number;
  y?: number;
  scale?: number;
  rotateX?: number;
  rotateY?: number;
};

export function HomeScrollFrame({
  children,
  className,
  from = {},
  exit,
}: {
  children: ReactNode;
  className?: string;
  from?: StartTransform;
  exit?: StartTransform;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: exit
      ? ["start end", "center 75%", "center 25%", "end start"]
      : ["start end", "end end"],
  });
  const progress = useSpring(scrollYProgress, {
    stiffness: 500,
    damping: 60,
    mass: 1,
  });
  const range = exit ? [0, 1 / 3, 2 / 3, 1] : [0, 1];
  const keyframes = (start: number, end: number, rest = 0) =>
    exit ? [start, rest, rest, end] : [start, rest];
  const x = useTransform(progress, range, keyframes(from.x ?? 0, exit?.x ?? 0));
  const y = useTransform(progress, range, keyframes(from.y ?? 0, exit?.y ?? 0));
  const scale = useTransform(
    progress,
    range,
    keyframes(from.scale ?? 1, exit?.scale ?? 1, 1),
  );
  const rotateX = useTransform(
    progress,
    range,
    keyframes(from.rotateX ?? 0, exit?.rotateX ?? 0),
  );
  const rotateY = useTransform(
    progress,
    range,
    keyframes(from.rotateY ?? 0, exit?.rotateY ?? 0),
  );
  return (
    <motion.div
      ref={ref}
      className={className}
      style={reduced ? undefined : { x, y, scale, rotateX, rotateY }}
    >
      {children}
    </motion.div>
  );
}

export function HomeAppear({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { x: 40, opacity: 0 }}
      whileInView={{ x: 0, opacity: 1 }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{
        type: "spring",
        duration: 0.8,
        bounce: 0.2,
        delay: reduced ? 0 : delay,
      }}
    >
      {children}
    </motion.div>
  );
}

export function HomeSectionHeading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
  );
}

export function HomeSocialLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: "facebook" | "instagram";
  children: ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const reduced = useReducedMotion();
  return (
    <motion.a
      className="home-social-link"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <motion.span
        aria-hidden="true"
        className="home-social-overlay"
        layout
        initial={false}
        style={{
          borderRadius: 10,
          width: hovered ? "calc(100% + 2px)" : 1,
          height: hovered ? "calc(100% + 2px)" : 1,
        }}
        animate={{ opacity: hovered ? 1 : 0 }}
        transition={
          reduced
            ? { duration: 0 }
            : { type: "spring", duration: 0.4, bounce: 0.2 }
        }
      />
      <Icon name={icon} />
      <span>{children}</span>
    </motion.a>
  );
}
