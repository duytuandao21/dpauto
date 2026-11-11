"use client";

import { MotionConfig, useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";

function SmoothScroll() {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  useEffect(() => {
    if (
      reduced ||
      window.matchMedia("(max-width: 767px)").matches ||
      /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
    )
      return;
    let target = window.scrollY,
      current = target,
      frame = 0;
    const cancel = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      target = current = window.scrollY;
    };
    const tick = () => {
      current += (target - current) * 0.154;
      window.scrollTo({ top: current, behavior: "instant" });
      if (Math.abs(target - current) > 0.4) frame = requestAnimationFrame(tick);
      else {
        window.scrollTo({ top: target, behavior: "instant" });
        frame = 0;
      }
    };
    const wheel = (event: WheelEvent) => {
      if (
        event.ctrlKey ||
        event.metaKey ||
        document.body.style.overflow === "hidden"
      )
        return;
      let node = event.target instanceof Element ? event.target : null;
      while (node && node !== document.body) {
        const style = getComputedStyle(node);
        if (
          /auto|scroll/.test(style.overflowY) &&
          node.scrollHeight > node.clientHeight + 1
        )
          return;
        if (node.hasAttribute("data-native-scroll")) return;
        node = node.parentElement;
      }
      event.preventDefault();
      if (!frame || Math.abs(window.scrollY - current) > 80)
        target = current = window.scrollY;
      target = Math.max(
        0,
        Math.min(
          document.documentElement.scrollHeight - innerHeight,
          target + event.deltaY * (event.deltaMode === 1 ? 16 : 1),
        ),
      );
      if (!frame) frame = requestAnimationFrame(tick);
    };
    window.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("hashchange", cancel);
    window.addEventListener("pointerdown", cancel);
    window.addEventListener("keydown", cancel);
    return () => {
      cancel();
      window.removeEventListener("wheel", wheel);
      window.removeEventListener("hashchange", cancel);
      window.removeEventListener("pointerdown", cancel);
      window.removeEventListener("keydown", cancel);
    };
  }, [pathname, reduced]);
  return null;
}

export function SiteEffects({ children }: { children: ReactNode }) {
  const vietnamese = usePathname() === "/";
  useEffect(() => {
    document.documentElement.lang = vietnamese ? "vi" : "en";
  }, [vietnamese]);
  return (
    <MotionConfig reducedMotion="user">
      <SmoothScroll />
      <a href="#main-content" className="skip-link">
        {vietnamese ? "Chuyển đến nội dung" : "Skip to content"}
      </a>
      {children}
    </MotionConfig>
  );
}
