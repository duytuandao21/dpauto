"use client";

import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { useRef } from "react";
import { homeVi as home } from "@/lib/home-vi";
import { Photo } from "@/components/ui/photo";

const scrollSpring = { stiffness: 500, damping: 60, mass: 1 };

function ProcessImage() {
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
          src="/images/DtZUUfzGF1adTjqnD7pA9HwQuI.webp"
          alt="Kỹ thuật viên đánh bóng sơn xe tại xưởng chăm sóc ô tô"
          sizes="(max-width: 809px) 100vw, (max-width: 1199px) 50vw, 58vw"
        />
      </motion.div>
      <aside className="process-note">
        <span className="process-note-accent" aria-hidden="true" />
        <p>
          Một số dịch vụ nhận xe trực tiếp. Với phủ ceramic, dán PPF, phim cách
          nhiệt và chăm sóc chuyên sâu, bạn nên gọi trước.
        </p>
      </aside>
    </div>
  );
}

function ProcessStep({
  step,
  index,
}: {
  step: (typeof home.process)[number];
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
  return (
    <section className="section light process-section" id="Our Service Process">
      <div className="container">
        <div className="section-heading">
          <h2>Quy trình chăm sóc xe</h2>
        </div>
        <div className="process-layout">
          <ProcessImage />
          <ol className="process-steps">
            {home.process.map((step, index) => (
              <ProcessStep key={step.title} step={step} index={index} />
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
