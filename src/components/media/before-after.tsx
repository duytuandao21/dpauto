"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { useInView, useReducedMotion } from "motion/react";
import { Photo } from "@/components/ui/photo";
import type { SiteImage } from "@/lib/content";

function subscribeDesktop(notify: () => void) {
  const query = matchMedia("(min-width: 1024px)");
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
}

export function BeforeAfter({
  before,
  after,
  label,
  autoReveal = true,
  hoverFollow = false,
  className = "",
  originalImages = false,
  vietnamese = false,
}: {
  before: SiteImage;
  after: SiteImage;
  label: string;
  autoReveal?: boolean;
  hoverFollow?: boolean;
  className?: string;
  originalImages?: boolean;
  vietnamese?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(50);
  const inView = useInView(root, { amount: 0.35, once: true });
  const reduced = useReducedMotion();
  const touched = useRef(false);
  const dragging = useRef(false);
  const played = useRef(false);
  const autoAnimating = useRef(false);
  const desktop = useSyncExternalStore(
    subscribeDesktop,
    () => matchMedia("(min-width: 1024px)").matches,
    () => false,
  );
  useEffect(() => {
    if (!autoReveal || !desktop) setPosition(50);
    else if (!played.current) setPosition(100);
  }, [autoReveal, desktop]);
  useEffect(() => {
    if (!inView || !autoReveal || !desktop || touched.current || played.current)
      return;
    played.current = true;
    if (reduced) {
      setPosition(10);
      return;
    }
    let frame = 0;
    const start = performance.now();
    autoAnimating.current = true;
    const tick = (time: number) => {
      if (touched.current) return;
      const t = Math.min((time - start) / 1500, 1);
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      setPosition(100 - 90 * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
      else autoAnimating.current = false;
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      autoAnimating.current = false;
    };
  }, [inView, autoReveal, reduced, desktop]);
  const update = (event: PointerEvent<HTMLDivElement>) => {
    const r = root.current!.getBoundingClientRect();
    setPosition(
      Math.max(0, Math.min(100, ((event.clientX - r.left) / r.width) * 100)),
    );
  };
  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    touched.current = true;
    autoAnimating.current = false;
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    update(e);
  };
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 2;
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    touched.current = true;
    autoAnimating.current = false;
    setPosition((p) =>
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? 100
          : Math.max(
              0,
              Math.min(100, p + (e.key === "ArrowRight" ? step : -step)),
            ),
    );
  };
  return (
    <div
      ref={root}
      className={`before-after ${hoverFollow ? "before-after--hover" : ""} ${className}`}
      role="slider"
      tabIndex={0}
      aria-label={
        vietnamese
          ? `So sánh trước và sau: ${label}`
          : `${label} before and after comparison`
      }
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(position)}
      aria-valuetext={`${Math.round(position)}% ${vietnamese ? "trước" : "before"}`}
      onKeyDown={key}
      onPointerDown={down}
      onPointerMove={(e) => {
        if (autoAnimating.current) return;
        if (
          dragging.current ||
          (hoverFollow &&
            desktop &&
            e.pointerType === "mouse" &&
            matchMedia("(hover: hover) and (pointer: fine)").matches)
        )
          update(e);
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
      onPointerCancel={() => {
        dragging.current = false;
      }}
    >
      <Photo
        {...after}
        sizes="(max-width:809px) 100vw, 80vw"
        unoptimized={originalImages}
      />
      <div
        className="before-after__before"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        <Photo
          {...before}
          sizes="(max-width:809px) 100vw, 80vw"
          unoptimized={originalImages}
        />
      </div>
      <span className="comparison-label comparison-label--before">
        {vietnamese ? "Trước" : "Before"}
      </span>
      <span className="comparison-label comparison-label--after">
        {vietnamese ? "Sau" : "After"}
      </span>
      <div className="comparison-divider" style={{ left: `${position}%` }}>
        <span className="comparison-handle">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9.5 7 4.5 12 9.5 17M14.5 7 19.5 12 14.5 17" />
          </svg>
        </span>
      </div>
    </div>
  );
}
