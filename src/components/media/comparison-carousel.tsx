"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { projects } from "@/lib/content";
import { BeforeAfter } from "./before-after";

const slides = [projects[4], projects[1], projects[0]];
const titles = ["Phục hồi đèn pha", "Vệ sinh nội thất", "Hiệu chỉnh sơn"];

export function ComparisonCarousel() {
  const [index, setIndex] = useState(0);
  const [hover, setHover] = useState(false);
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  const [width, setWidth] = useState(1000);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.2 });
  const reduced = useReducedMotion();
  useEffect(() => {
    const observer = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!inView || hover || keyboardFocus || reduced) return;
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % slides.length),
      5500,
    );
    return () => clearInterval(timer);
  }, [inView, hover, keyboardFocus, reduced]);
  const move = (direction: number) =>
    setIndex((i) => (i + direction + slides.length) % slides.length);
  return (
    <div
      className="comparison-carousel"
      ref={ref}
      onPointerEnter={(event) => {
        // Touch browsers also emit mouseenter and can leave it active after a tap.
        if (
          event.pointerType === "mouse" &&
          matchMedia("(hover: hover) and (pointer: fine)").matches
        )
          setHover(true);
      }}
      onPointerLeave={() => setHover(false)}
      onFocusCapture={(event) => {
        setKeyboardFocus(event.target.matches(":focus-visible"));
      }}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setKeyboardFocus(false);
      }}
      aria-roledescription="carousel"
      aria-label="Kết quả trước và sau"
    >
      <motion.div
        className="comparison-track"
        animate={{ x: -index * (width + 40) }}
        transition={{ type: "spring", stiffness: 200, damping: 40, mass: 1 }}
      >
        {slides.map((project, i) => (
          <motion.div
            key={project.title}
            className="comparison-slide"
            style={{ width }}
            animate={{
              opacity: i === index ? 1 : 0.1,
              scale: i === index ? 1 : 0.95,
            }}
            transition={{ type: "spring", stiffness: 200, damping: 40 }}
            aria-hidden={i !== index}
            inert={i !== index}
          >
            <h3>{titles[i]}</h3>
            <div className="comparison-rule" />
            <BeforeAfter
              before={project.before}
              after={project.after}
              label={titles[i]}
              autoReveal={i === index}
              hoverFollow
              originalImages
              vietnamese
            />
          </motion.div>
        ))}
      </motion.div>
      <button
        className="carousel-arrow carousel-arrow--previous"
        onClick={() => move(-1)}
        aria-label="Xem ảnh trước"
      >
        <svg viewBox="0 0 24 24">
          <path d="m14 4-8 8 8 8" />
        </svg>
      </button>
      <button
        className="carousel-arrow carousel-arrow--next"
        onClick={() => move(1)}
        aria-label="Xem ảnh tiếp"
      >
        <svg viewBox="0 0 24 24">
          <path d="m10 4 8 8-8 8" />
        </svg>
      </button>
      <div className="carousel-dots">
        {slides.map((p, i) => (
          <button
            key={p.title}
            aria-label={`Xem ${titles[i]}`}
            aria-current={index === i ? "true" : undefined}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
    </div>
  );
}
