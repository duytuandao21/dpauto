"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Closing only rewrites the URL (History API, which Next keeps in sync with usePathname/
 * useSearchParams): no navigation, so the page behind is not re-rendered or reloaded.
 */
function leave(href: string) {
  window.history.replaceState(null, "", href);
}
export function WorkspaceDrawer({
  title,
  closeHref,
  children,
}: {
  title: string;
  closeHref: string;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(() => leave(closeHref), 500);
    return () => clearTimeout(timer);
  }, [closing, closeHref]);

  function close() {
    if (closing) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      leave(closeHref);
      return;
    }
    setClosing(true);
  }

  return (
    <dialog
      ref={dialog}
      className="adm-dialog adv-workspace-drawer"
      data-closing={closing || undefined}
      aria-label={title}
      onAnimationEnd={(event) => {
        if (
          closing &&
          event.target === event.currentTarget &&
          event.animationName === "adv-drawer-out"
        ) {
          leave(closeHref);
        }
      }}
      onCancel={(event) => {
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        close();
      }}
      onKeyDown={(event) => {
        if (
          event.key === "Escape" &&
          event.target instanceof Element &&
          event.target.closest("dialog") === event.currentTarget
        ) {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
      }}
    >
      <header className="adv-drawer-heading">
        <h2>{title}</h2>
        <Link
          href={closeHref}
          scroll={false}
          className="adm-icon-btn"
          aria-label={`Đóng ${title.toLocaleLowerCase("vi")}`}
          autoFocus
          onClick={(event) => {
            if (
              event.button !== 0 ||
              event.metaKey ||
              event.ctrlKey ||
              event.shiftKey ||
              event.altKey
            )
              return;
            event.preventDefault();
            close();
          }}
        >
          ×
        </Link>
      </header>
      <div className="adv-drawer-content">{children}</div>
    </dialog>
  );
}
