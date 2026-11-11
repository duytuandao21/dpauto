"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { Icon, type IconName } from "./icon";

const MotionLink = motion.create(Link);

export function Button({
  href,
  children,
  variant = "primary",
  icon,
  className = "",
  arrow = false,
  onClick,
  type = "button",
  disabled = false,
}: {
  href?: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "light";
  icon?: IconName;
  className?: string;
  arrow?: boolean;
  onClick?: (event: MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const reduced = useReducedMotion();
  const phone = icon === "phone";
  const light = variant === "light";
  const transition = reduced
    ? { duration: 0 }
    : { type: "spring" as const, duration: 0.4, bounce: 0.1 };
  const inner = (
    <>
      <motion.span
        className="button-overlay"
        aria-hidden="true"
        layout
        initial={false}
        style={{
          // Motion needs the inline radius to preserve it during layout scaling.
          borderRadius: 10,
          left: hovered ? 3 : -1,
          bottom: hovered ? 3 : -1,
          width: hovered ? "calc(100% - 6px)" : 1,
          height: hovered ? "calc(100% - 6px)" : 1,
        }}
        animate={{ opacity: hovered ? 1 : 0 }}
        transition={transition}
      />
      {phone ? (
        <motion.svg
          className="button-phone-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          animate={reduced ? undefined : { rotate: 24, scale: 1.15 }}
          transition={{
            duration: 0.7,
            ease: [0.5, 0, 0.88, 0.77],
            repeat: Infinity,
            repeatType: "mirror",
            repeatDelay: 1.5,
          }}
        >
          <path d="M13 2c4.971 0 9 4.029 9 9M13 6c2.761 0 5 2.239 5 5" />
          <path
            d="M11.832 14.568C12.257 14.763 12.761 14.637 13.045 14.265L13.4 13.8C13.778 13.296 14.37 13 15 13H18C19.105 13 20 13.895 20 15V18C20 19.105 19.105 20 18 20C8.059 20 0 11.941 0 2C0 .895 .895 0 2 0H5C6.105 0 7 .895 7 2V5C7 5.63 6.704 6.222 6.2 6.6L5.732 6.951C5.353 7.24 5.231 7.756 5.44 8.184C6.807 10.96 9.054 13.205 11.832 14.568"
            transform="translate(2 2)"
          />
        </motion.svg>
      ) : icon ? (
        <Icon name={icon} />
      ) : null}
      <span className="button-label">{children}</span>
      {arrow && <Icon name="arrow" className="button-arrow" />}
    </>
  );
  const classes = `button button--${variant} ${phone ? "button--phone" : ""} ${className}`;
  const Tag = !href
    ? motion.button
    : /^(https?:|tel:|mailto:)/.test(href)
      ? motion.a
      : MotionLink;
  return (
    <Tag
      href={href}
      {...(!href ? { type, disabled } : {})}
      className={classes}
      onClick={onClick}
      onHoverStart={() => !disabled && setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      initial={false}
      animate={{
        backgroundColor: light
          ? "#ffffff"
          : variant === "primary"
            ? "var(--button-primary-bg, #ff5a1f)"
            : hovered
              ? "var(--button-secondary-hover-bg, #ff5a1f)"
              : "var(--button-secondary-bg, #202428)",
        color: light
          ? hovered
            ? "var(--button-light-hover-text, #ffffff)"
            : "var(--button-light-text, #0b0d0f)"
          : variant === "secondary"
            ? hovered
              ? "var(--button-secondary-hover-text, #ffffff)"
              : "var(--button-secondary-text, #ffffff)"
            : "#ffffff",
        "--button-border-color": light
          ? hovered
            ? "var(--button-light-hover-border, #ff5a1f)"
            : "var(--button-light-border, #e4e9eb)"
          : phone
            ? "var(--button-phone-border, rgba(255,255,255,0.1))"
            : "var(--button-border, rgba(255,255,255,0.36))",
      }}
      transition={transition}
      {...(href?.startsWith("http")
        ? { target: "_blank", rel: "noopener noreferrer" }
        : {})}
    >
      {inner}
    </Tag>
  );
}
