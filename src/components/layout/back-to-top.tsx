"use client";
import { useEffect, useState } from "react";

/** Small square button that returns to the top once the visitor has scrolled down. */
export function BackToTop() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const update = () => setShown(window.scrollY > 600);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return (
    <button
      type="button"
      className="back-to-top"
      data-shown={shown}
      aria-label="Lên đầu trang"
      tabIndex={shown ? 0 : -1}
      onClick={() =>
        window.scrollTo({
          top: 0,
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
        })
      }
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 19V5M6 11l6-6 6 6" />
      </svg>
    </button>
  );
}
