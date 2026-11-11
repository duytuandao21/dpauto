"use client";

import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Photo } from "@/components/ui/photo";
import { banners, type SiteImage } from "@/lib/content";

const imageSpring = { stiffness: 500, damping: 60, mass: 1 };
const phoneQuery = "(max-width: 809.98px)";
const subscribePhone = (callback: () => void) => {
  const query = matchMedia(phoneQuery);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
};

export function AboutBanner() {
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, imageSpring);
  const scale = useTransform(progress, [0, 1], [1, 1.4]);
  return (
    <section className="work-banner about-banner">
      <motion.div
        className="work-banner-image"
        style={reduced ? undefined : { scale }}
      >
        <Photo {...banners.about} priority unoptimized sizes="100vw" />
      </motion.div>
      <div className="work-banner-overlay" />
      <div className="container work-banner-heading">
        <h1>About HyperAuto Care</h1>
      </div>
    </section>
  );
}

export function AboutReveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className: string;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  const workshop = className === "workshop-card";
  const phone = useSyncExternalStore(
    subscribePhone,
    () => matchMedia(phoneQuery).matches,
    () => false,
  );
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, x: 40 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{
        type: "spring",
        duration: workshop ? 0.8 : 0.85,
        bounce: 0.2,
        delay: reduced || phone ? 0 : delay,
      }}
    >
      {children}
    </motion.div>
  );
}

function useGalleryMotion() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end end"],
  });
  const progress = useSpring(scrollYProgress, imageSpring);
  const y = useTransform(progress, [0, 1], [-60, 0]);
  const scale = useTransform(progress, [0, 1], [1.06, 1]);
  return { ref, style: reduced ? undefined : { y, scale } };
}

export function AboutGalleryImage({ image }: { image: SiteImage }) {
  const { ref, style } = useGalleryMotion();
  const [open, setOpen] = useState(false);
  const [ratio, setRatio] = useState(1);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "Tab") {
        e.preventDefault();
        dialog.current?.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", key);
      trigger.current?.focus({ preventScroll: true });
    };
  }, [open]);
  return (
    <>
      <div className="about-gallery-image" ref={ref}>
        <motion.div
          className="about-gallery-image-inner"
          style={{ ...style, visibility: open ? "hidden" : "visible" }}
        >
          <button
            ref={trigger}
            aria-label={`Open image: ${image.alt}`}
            onClick={() => {
              const rect = ref.current?.getBoundingClientRect();
              if (rect) setRatio(rect.width / rect.height);
              setOpen(true);
            }}
          >
            <Photo
              {...image}
              unoptimized
              sizes="(max-width: 1199px) 100vw, 50vw"
            />
          </button>
        </motion.div>
      </div>
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                className="about-lightbox"
                ref={dialog}
                role="dialog"
                aria-modal="true"
                aria-label={image.alt}
                tabIndex={-1}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.44, 0, 0.56, 1] }}
                onClick={() => setOpen(false)}
              >
                <div
                  className="about-lightbox-photo"
                  style={{
                    aspectRatio: ratio,
                    width: `min(1600px, calc((100dvh - 40px) * ${ratio}), calc(100vw - 40px))`,
                  }}
                >
                  <Photo {...image} unoptimized sizes="100vw" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

export function AboutVideo({ src }: { src: string }) {
  const { ref, style } = useGalleryMotion();
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div
      className={`about-story-video ${playing ? "is-playing" : ""}`}
      ref={ref}
    >
      <motion.div className="about-story-video-inner" style={style}>
        <video
          ref={video}
          src={`${src}#t=0.001`}
          muted
          loop
          playsInline
          preload="auto"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onError={() => setError(true)}
        />
        <button
          aria-label={playing ? "Pause video" : "Play video"}
          onClick={() => {
            if (!video.current) return;
            if (video.current.paused)
              video.current.play().catch(() => setError(true));
            else video.current.pause();
          }}
        />
        <span className="about-video-play" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            {playing ? (
              <path d="M6 5h4v14H6zm8 0h4v14h-4z" />
            ) : (
              <path d="M8.25 5.35C8.25 4.55 9.13 4.07 9.8 4.5L19.23 10.65C19.84 11.05 19.84 11.95 19.23 12.35L9.8 18.5C9.13 18.93 8.25 18.45 8.25 17.65V5.35Z" />
            )}
          </svg>
        </span>
        {error && (
          <a className="about-video-error" href={src}>
            Open video
          </a>
        )}
      </motion.div>
    </div>
  );
}

export function AboutTeamImage({ image }: { image: SiteImage }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end end"],
  });
  const progress = useSpring(scrollYProgress, imageSpring);
  const distance = useRef(80);
  const y = useTransform(progress, (value) => value * distance.current);
  const scale = useTransform(progress, [0, 1], [1.06, 1]);
  useEffect(() => {
    const query = matchMedia("(max-width: 1199.98px)");
    const update = () => {
      distance.current = query.matches ? 60 : 80;
    };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return (
    <div className="about-team-image">
      <motion.div
        ref={ref}
        className="about-team-image-inner"
        style={reduced ? { y: distance.current } : { y, scale }}
      >
        <Photo {...image} unoptimized sizes="100vw" />
      </motion.div>
    </div>
  );
}
