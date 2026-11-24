"use client";

import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { useRef, useSyncExternalStore } from "react";
import Image from "next/image";
import { Photo } from "@/components/ui/photo";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { heroFeatures, homeDefaults } from "@/lib/home-defaults";
import { useImage, useSection, useSite } from "@/components/site/site-content";
import { BookingLauncher } from "@/components/public-booking/booking-dialog";
import type { CmsPayload } from "@/lib/api/cms";
import type { SiteImage } from "@/lib/content";

const desktopQuery = "(min-width: 1200px)";
function subscribeDesktop(notify: () => void) {
  const query = matchMedia(desktopQuery);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
}

export function Hero({ copy }: { copy?: CmsPayload | null }) {
  const { settings } = useSite(),
    resolve = useImage();
  const hero =
    useSection("home.hero", homeDefaults["home.hero"]) ||
    homeDefaults["home.hero"];
  // Legacy pages saved only imageId; those resolve through the old endpoint.
  const background: SiteImage =
    resolve(hero.image) ||
    (copy?.imageId
      ? {
          src: `/api/v1/public/cms/assets/${copy.imageId}`,
          alt: hero.image.alt,
        }
      : homeDefaults["home.hero"].image);
  const teamPhoto = resolve(
    hero.images?.[0],
    homeDefaults["home.hero"].images[0],
  )!;
  const features = (hero.items as { text?: string }[]).map((f, i) => ({
    icon: (heroFeatures[i % heroFeatures.length]?.icon || "award") as IconName,
    text: f.text || "",
  }));
  const root = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const desktop = useSyncExternalStore(
    subscribeDesktop,
    () => matchMedia(desktopQuery).matches,
    () => false,
  );
  const { scrollY, scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, {
    stiffness: 500,
    damping: 60,
    mass: 1,
  });
  const copyTarget = useTransform(scrollY, (value) => {
    if (typeof document === "undefined") return 0;
    const section = document.getElementById("services");
    if (!section) return 0;
    return Math.max(
      0,
      Math.min(
        1,
        value /
          Math.max(
            1,
            section.offsetTop + section.offsetHeight - innerHeight - 80,
          ),
      ),
    );
  });
  const copyProgress = useSpring(copyTarget, {
    stiffness: 500,
    damping: 60,
    mass: 1,
  });
  const scale = useTransform(progress, [0, 1], [1, 1.4]);
  const parallax = useTransform(scrollY, (value) => value * 0.7);
  const y = useSpring(parallax, { stiffness: 500, damping: 60, mass: 1 });
  const copyScale = useTransform(copyProgress, [0, 1], [1, 1.4]);
  const rotateY = useTransform(copyProgress, [0, 1], [0, 50]);
  const featureProgress = useTransform(copyProgress, [0.25, 1], [0, 1]);
  const featureOpacity = useTransform(featureProgress, [0, 1], [1, 0]);
  const featureScale = useTransform(featureProgress, [0, 1], [1, 0.8]);
  return (
    <section className="hero" ref={root}>
      <motion.div
        className="hero-background"
        style={reduced ? undefined : { scale, y: desktop ? y : 0 }}
      >
        <Photo
          src={background.src}
          media={background.media || (copy?.imageId ? copy.image : undefined)}
          alt={background.alt}
          priority
          sizes="(max-width: 809px) 1920px, 100vw"
        />
      </motion.div>
      <div className="hero-shade" />
      <div className="container hero-main">
        <motion.div
          className="hero-copy"
          style={reduced ? undefined : { scale: copyScale, rotateY }}
        >
          <motion.a
            href={hero.note || homeDefaults["home.hero"].note}
            target="_blank"
            rel="noopener noreferrer"
            className="google-review"
            aria-label="Xem đánh giá Google của DPAuto: 5 trên 5 sao (mở trong tab mới)"
          >
            <Image
              src="/icons/google.png"
              alt=""
              width={20}
              height={20}
              unoptimized
              className="google-review-logo"
            />
            <span className="google-review-brand">Google</span>
            <span className="google-review-stars" aria-hidden="true">
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i}>★</span>
              ))}
            </span>
            <span className="google-review-rating">5/5</span>
          </motion.a>
          <motion.h1>{hero.title}</motion.h1>
          <motion.p>{hero.description}</motion.p>
          <motion.div className="button-row">
            <Button
              href={hero.cta?.href || settings.phoneHref}
              variant="secondary"
              icon="phone"
            >
              {hero.cta?.label || "Gọi ngay"}
            </Button>
            <BookingLauncher />
          </motion.div>
        </motion.div>
      </div>
      <aside className="hero-location">
        <a
          href={
            settings.directions || "https://maps.app.goo.gl/tQo14o41XcLVovCV7"
          }
          target="_blank"
          rel="noopener noreferrer"
          className="hero-address"
        >
          <Icon name="pin" />
          <span>
            {`${settings.address},`}
            <br /> {settings.city}
          </span>
        </a>
        <Photo {...teamPhoto} />
        <p>
          <Icon name="clock" />
          Giờ mở cửa
        </p>
        <dl className="hours hours--compact">
          {(settings.custom
            ? settings.hours
            : ["T2 – T6", "Thứ Bảy", "Chủ Nhật"].map((label) => ({
                label,
                value: "07:30 – 17:30",
              }))
          ).map((h) => (
            <div key={h.label}>
              <dt>{`${h.label}:`}</dt>
              <dd>{h.value}</dd>
            </div>
          ))}
        </dl>
      </aside>
      <motion.div
        className="container hero-features"
        style={
          reduced ? undefined : { opacity: featureOpacity, scale: featureScale }
        }
      >
        {features.map((f) => (
          <div key={f.text}>
            <Icon name={f.icon} />
            <p>{f.text}</p>
          </div>
        ))}
      </motion.div>
    </section>
  );
}
