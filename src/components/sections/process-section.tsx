"use client";

import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { useRef } from "react";
import { Photo } from "@/components/ui/photo";
import { homeDefaults } from "@/lib/home-defaults";
import type { SiteImage } from "@/lib/content";
import { useImage, useSection } from "@/components/site/site-content";

const scrollSpring = { stiffness: 500, damping: 60, mass: 1 };

function ProcessImage({ photo, note }: { photo: SiteImage; note?: string }) {
  const image = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  // The reference maps entry progress until the whole image is inside the viewport.
  const { scrollYProgress } = useScroll({
    target: image,
    offset: ["start end", "end end"],
  });
  const progress = useSpring(scrollYProgress, scrollSpring);
  const scale = useTransform(progress, [0, 1], [1.15, 1]);
  const y = useTransform(progress, [0, 1], [-40, 160]);

  return (
    <div className="process-image">
      <motion.div
        ref={image}
        className="process-image-media"
        style={reduced ? { top: 0, bottom: 0 } : { scale, y }}
      >
        <Photo
          {...photo}
          sizes="(max-width: 809px) 100vw, (max-width: 1199px) 50vw, 58vw"
        />
      </motion.div>
      <aside className="process-note">
        <span className="process-note-accent" aria-hidden="true" />
        <p>{note}</p>
      </aside>
    </div>
  );
}

function ProcessStep({
  step,
  index,
}: {
  step: { title: string; description: string };
  index: number;
}) {
  const card = useRef<HTMLLIElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: card,
    offset: ["start end", "end end"],
  });
  const progress = useSpring(scrollYProgress, scrollSpring);
  const scale = useTransform(progress, [0, 1], [1.1, 1]);

  return (
    <motion.li
      ref={card}
      className="process-step"
      style={{ top: 100 + index * 60, scale: reduced ? 1 : scale }}
    >
      <div className="process-step-card">
        <span className="process-step-number">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="process-step-copy">
          <h3>{step.title}</h3>
          <p>{step.description}</p>
        </div>
      </div>
    </motion.li>
  );
}

export function ProcessSection() {
  const section = useSection("home.process", homeDefaults["home.process"]),
    resolve = useImage();
  if (!section) return null;
  const image = resolve(section.image, homeDefaults["home.process"].image)!;
  const steps = (section.items as { title?: string; text?: string }[]).map(
    (s) => ({
      title: s.title || "",
      description: s.text || "",
    }),
  );
  return (
    <section className="section light process-section" id="Our Service Process">
      <div className="container">
        <div className="section-heading">
          <h2>{section.title}</h2>
        </div>
        <div className="process-layout">
          <ProcessImage photo={image} note={section.note} />
          <ol className="process-steps">
            {steps.map((step, index) => (
              <ProcessStep key={step.title} step={step} index={index} />
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
