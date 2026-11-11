"use client";

import {
  LayoutGroup,
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { useId, useRef, useState } from "react";

export type FAQItem = { question: string; answer: string };
const toggleTransition = {
  type: "spring" as const,
  duration: 0.3,
  bounce: 0.2,
};

function Question({ item }: { item: FAQItem }) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const transition = reduced ? { duration: 0 } : toggleTransition;
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end end"],
  });
  const progress = useSpring(scrollYProgress, {
    stiffness: 500,
    damping: 60,
    mass: 1,
  });
  const x = useTransform(progress, [0, 1], [20, 0]);
  const y = useTransform(progress, [0, 1], [40, 0]);
  const rotateX = useTransform(progress, [0, 1], [11, 0]);
  const rotateY = useTransform(progress, [0, 1], [23, 0]);
  const highlight = hovered && !open;

  return (
    <motion.div
      ref={ref}
      className="faq-entry"
      layout="position"
      style={reduced ? undefined : { x, y, rotateX, rotateY }}
      transition={transition}
    >
      <motion.div
        layout
        className={`faq-item ${open ? "faq-item--open" : ""}`}
        initial={false}
        animate={{
          backgroundColor: highlight
            ? "var(--faq-hover-bg, #0b0d0f)"
            : open
              ? "var(--faq-open-bg, #202428)"
              : "var(--faq-rest-bg, #202428)",
          "--faq-border-color": highlight
            ? "var(--faq-hover-border, #0b0d0f)"
            : open
              ? "var(--faq-open-border, #2d3237)"
              : "var(--faq-rest-border, #2d3237)",
        }}
        onHoverStart={() => setHovered(true)}
        onHoverEnd={() => setHovered(false)}
        onClick={() => setOpen((value) => !value)}
        transition={transition}
        style={{ borderRadius: 16 }}
      >
        <motion.h3 layout="position" transition={transition}>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={id}
            id={`${id}-question`}
          >
            <span className="faq-question-text">{item.question}</span>
            <span className="faq-indicator" aria-hidden="true">
              <motion.svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={false}
                animate={{ rotate: open ? 180 : 90 }}
                transition={transition}
              >
                <path d="M5 12h14" />
                {!open && <path d="M12 5v14" />}
              </motion.svg>
            </span>
          </button>
        </motion.h3>
        {open && (
          <motion.div
            layout="position"
            id={id}
            className="faq-answer"
            role="region"
            aria-labelledby={`${id}-question`}
            transition={transition}
          >
            <p>{item.answer}</p>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}

export function FAQ({
  items,
  compact = false,
  description,
  title = "Frequently Asked Questions",
}: {
  items: FAQItem[];
  compact?: boolean;
  description?: string;
  title?: string;
}) {
  const groupId = useId();
  const list = (
    <LayoutGroup id={groupId}>
      <div className="faq-list">
        {items.map((item) => (
          <Question key={item.question} item={item} />
        ))}
      </div>
    </LayoutGroup>
  );
  return compact ? (
    <div className="faq-compact">
      {description ? (
        <div className="faq-compact-heading">
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      ) : (
        <h2>{title}</h2>
      )}
      {list}
    </div>
  ) : (
    <section className="section faq-section">
      <div className="container faq-layout">
        <div className="faq-heading">
          <h2>{title}</h2>
          <p>
            {description ??
              "Clear answers about appointments, timing, pricing, and service availability."}
          </p>
        </div>
        {list}
      </div>
    </section>
  );
}
