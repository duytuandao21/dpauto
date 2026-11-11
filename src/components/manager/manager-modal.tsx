"use client";

import { useEffect, useRef, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AdminIcon } from "@/components/admin/admin-icon";

export function ManagerModal({
  title,
  children,
  onClose,
  theme,
  drawer = false,
  footer,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  theme: "light" | "dark";
  drawer?: boolean;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const dismiss = useRef(onClose);
  dismiss.current = onClose;
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const focus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      focus?.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(
    <dialog
      ref={ref}
      className={`adm-dialog mgr-dialog ${drawer ? "mgr-drawer" : ""}`}
      data-theme={theme}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        dismiss.current();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]',
          ) ?? [],
        ).filter((el) => el.getClientRects().length);
        const first = controls[0],
          last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        }
        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      <header className="mgr-modal-head">
        <div>
          <span className="adm-eyebrow">DPAUTO · ĐIỀU HÀNH</span>
          <h2 id={titleId}>{title}</h2>
        </div>
        <button
          type="button"
          className="adm-icon-btn"
          aria-label="Đóng hộp thoại"
          onClick={onClose}
        >
          <AdminIcon name="close" />
        </button>
      </header>
      <div className="mgr-modal-body">{children}</div>
      {footer && <footer className="mgr-modal-footer">{footer}</footer>}
    </dialog>,
    document.body,
  );
}
