"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Photo } from "@/components/ui/photo";
import { Icon } from "@/components/ui/icon";
import { Reveal } from "@/components/motion/reveal";
import type { SiteImage } from "@/lib/content";

export function Gallery({
  images,
  className = "",
  mosaic = false,
  vietnamese = false,
}: {
  images: SiteImage[];
  className?: string;
  mosaic?: boolean;
  vietnamese?: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const change = (direction: number) =>
    setSelected((i) =>
      i === null ? null : (i + direction + images.length) % images.length,
    );
  useEffect(() => {
    if (selected === null) return;
    previousFocus.current = document.activeElement as HTMLElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    const key = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
      if (e.key === "ArrowRight") change(1);
      if (e.key === "ArrowLeft") change(-1);
      if (e.key === "Tab") {
        const buttons =
          dialog.current?.querySelectorAll<HTMLButtonElement>("button");
        if (!buttons?.length) return;
        const first = buttons[0],
          last = buttons[buttons.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last ||
            document.activeElement === dialog.current)
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", key);
      previousFocus.current?.focus();
    };
    // A single keyboard/focus lifecycle for the open dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected === null, images.length]);
  return (
    <>
      <div
        className={`gallery-grid ${mosaic ? "gallery-grid--mosaic" : ""} ${className}`}
      >
        {images.map((img, i) => (
          <Reveal
            key={`${img.src}-${i}`}
            className="gallery-tile"
            delay={Math.min(i * 0.05, 0.2)}
          >
            <button
              onClick={() => setSelected(i)}
              aria-label={`${vietnamese ? "Xem ảnh" : "Open image"}: ${img.alt}`}
            >
              <Photo {...img} />
              <span className="gallery-zoom">
                <Icon name="expand" />
              </span>
            </button>
          </Reveal>
        ))}
      </div>
      <AnimatePresence>
        {selected !== null && (
          <motion.div
            className="lightbox"
            ref={dialog}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={vietnamese ? "Thư viện ảnh" : "Image gallery"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.44, 0, 0.56, 1] }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelected(null);
            }}
          >
            <button
              className="lightbox-close"
              aria-label={vietnamese ? "Đóng ảnh" : "Close gallery"}
              onClick={() => setSelected(null)}
            >
              <Icon name="close" />
            </button>
            <button
              className="lightbox-prev"
              aria-label={vietnamese ? "Ảnh trước" : "Previous image"}
              onClick={() => change(-1)}
            >
              ‹
            </button>
            <Photo
              {...images[selected]}
              className="lightbox-image"
              sizes="100vw"
            />
            <button
              className="lightbox-next"
              aria-label={vietnamese ? "Ảnh tiếp" : "Next image"}
              onClick={() => change(1)}
            >
              ›
            </button>
            <p className="lightbox-caption">
              {images[selected].alt}
              <span>
                {selected + 1} / {images.length}
              </span>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
