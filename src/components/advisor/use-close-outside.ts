"use client";
import { useEffect, type RefObject } from "react";

/** Calls `close` on a click outside `ref` or on Escape, while `open` is true (filter popovers). */
export function useCloseOutside(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  close: () => void,
) {
  useEffect(() => {
    if (!open) return;
    const handle = (e: Event) => {
      if (
        e instanceof KeyboardEvent
          ? e.key === "Escape"
          : !ref.current?.contains(e.target as Node)
      )
        close();
    };
    document.addEventListener("pointerdown", handle);
    document.addEventListener("keydown", handle);
    return () => {
      document.removeEventListener("pointerdown", handle);
      document.removeEventListener("keydown", handle);
    };
  }, [ref, open, close]);
}
