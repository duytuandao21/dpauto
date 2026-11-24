"use client";
import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { CmsIcon, type CmsIconName } from "./icon";

export type Tone =
  "neutral" | "info" | "success" | "warn" | "danger" | "purple";

export function Button({
  variant = "outline",
  size,
  icon,
  children,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost" | "danger";
  size?: "sm";
  icon?: CmsIconName;
}) {
  return (
    <button
      type="button"
      className={`cms-btn cms-btn-${variant} ${size ? "cms-btn-sm" : ""} ${!children ? "cms-btn-icon" : ""} ${className}`}
      {...rest}
    >
      {icon && <CmsIcon name={icon} />}
      {children}
    </button>
  );
}
export function ButtonLink({
  href,
  variant = "outline",
  icon,
  children,
  size,
  external,
}: {
  href: string;
  variant?: "primary" | "outline" | "ghost";
  icon?: CmsIconName;
  children?: ReactNode;
  size?: "sm";
  external?: boolean;
}) {
  const className = `cms-btn cms-btn-${variant} ${size ? "cms-btn-sm" : ""} ${!children ? "cms-btn-icon" : ""}`;
  return external ? (
    <a className={className} href={href} target="_blank" rel="noreferrer">
      {icon && <CmsIcon name={icon} />}
      {children}
    </a>
  ) : (
    <Link className={className} href={href}>
      {icon && <CmsIcon name={icon} />}
      {children}
    </Link>
  );
}
export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <span className="cms-badge" data-tone={tone}>
      {children}
    </span>
  );
}
export function Card({
  title,
  description,
  action,
  footer,
  children,
  pad = true,
  className = "",
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  pad?: boolean;
  className?: string;
}) {
  return (
    <section className={`cms-card ${className}`}>
      {(title || action) && (
        <div className="cms-card-head">
          {title && <h2>{title}</h2>}
          {action}
          {description && <p>{description}</p>}
        </div>
      )}
      {pad ? <div className="cms-card-body">{children}</div> : children}
      {footer && <div className="cms-card-foot">{footer}</div>}
    </section>
  );
}
export function Stat({
  icon,
  value,
  label,
  note,
  trend,
  href,
}: {
  icon: CmsIconName;
  value: ReactNode;
  label: string;
  note?: string;
  trend?: { text: string; tone?: "warn" };
  href?: string;
}) {
  const body = (
    <>
      <div className="cms-stat-top">
        <CmsIcon name={icon} />
        {trend && (
          <span className="cms-stat-trend" data-tone={trend.tone}>
            <CmsIcon name={trend.tone ? "alert" : "trend"} size={14} />
            {trend.text}
          </span>
        )}
      </div>
      <strong>{value}</strong>
      <span>{label}</span>
      {note && <small>{note}</small>}
    </>
  );
  return href ? (
    <Link className="cms-card cms-stat" href={href}>
      {body}
    </Link>
  ) : (
    <div className="cms-card cms-stat">{body}</div>
  );
}
export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="cms-page-header">
      <div>
        {back && (
          <Link className="cms-back" href={back.href}>
            <CmsIcon name="arrowLeft" size={14} />
            {back.label}
          </Link>
        )}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="cms-actions">{actions}</div>}
    </header>
  );
}
export function Field({
  label,
  help,
  error,
  children,
  wide,
}: {
  label: ReactNode;
  help?: ReactNode;
  error?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <label
      className={`cms-field ${wide ? "cms-span-2" : ""}`}
      data-invalid={!!error || undefined}
    >
      <span>{label}</span>
      {children}
      {(error || help) && <small>{error || help}</small>}
    </label>
  );
}
export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`cms-input ${props.className || ""}`} />;
}
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea {...props} className={`cms-textarea ${props.className || ""}`} />
  );
}
/** Short text that may still contain line breaks (titles): Enter adds a new line. */
export function TextLine(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <Textarea rows={2} {...props} className={`cms-textarea--line ${props.className || ""}`} />;
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`cms-select ${props.className || ""}`} />
  );
}
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className="cms-switch">
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="cms-switch-track" aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}
export function Tabs<T extends string>({
  value,
  onChange,
  items,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: string; icon?: CmsIconName }[];
  label: string;
}) {
  return (
    <div className="cms-tabs" role="tablist" aria-label={label}>
      {items.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          className="cms-tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
        >
          {t.icon && <CmsIcon name={t.icon} size={14} />}
          {t.label}
        </button>
      ))}
    </div>
  );
}
export function Empty({
  icon = "file",
  title,
  children,
}: {
  icon?: CmsIconName;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="cms-empty">
      <CmsIcon name={icon} />
      <strong>{title}</strong>
      {children}
    </div>
  );
}
export function Alert({
  tone = "info",
  children,
}: {
  tone?: "info" | "warn" | "danger";
  children: ReactNode;
}) {
  return (
    <div
      className="cms-alert"
      data-tone={tone}
      role={tone === "danger" ? "alert" : undefined}
    >
      <CmsIcon name={tone === "info" ? "help" : "alert"} />
      <div>{children}</div>
    </div>
  );
}
export function Skeleton({
  height = 20,
  width = "100%",
}: {
  height?: number;
  width?: number | string;
}) {
  return (
    <div
      className="cms-skeleton"
      style={{ height, width }}
      aria-hidden="true"
    />
  );
}
export function Loading({ rows = 4 }: { rows?: number }) {
  return (
    <div className="cms-stack-sm" aria-busy="true" aria-label="Đang tải">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={44} />
      ))}
    </div>
  );
}

export function Dialog({
  title,
  description,
  children,
  footer,
  onClose,
  size,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  size?: "lg";
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId(),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const focus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    d.showModal();
    return () => {
      d.close();
      document.body.style.overflow = overflow;
      focus?.focus?.({ preventScroll: true });
    };
  }, []);
  const theme =
    typeof document !== "undefined"
      ? document.querySelector(".cms-app")?.getAttribute("data-theme") ||
        "light"
      : "light";
  return createPortal(
    <div className="cms-app" data-theme={theme} style={{ minHeight: 0 }}>
      <dialog
        ref={ref}
        className="cms-dialog"
        data-size={size}
        aria-labelledby={id}
        onCancel={(e) => {
          e.preventDefault();
          close.current();
        }}
        onClick={(e) => e.target === e.currentTarget && close.current()}
      >
        <div className="cms-dialog-inner">
          <header>
            <div>
              <h2 id={id}>{title}</h2>
              {description && <p>{description}</p>}
            </div>
            <Button
              variant="ghost"
              size="sm"
              icon="x"
              aria-label="Đóng"
              onClick={() => close.current()}
            />
          </header>
          <div className="cms-dialog-body">{children}</div>
          {footer && <footer>{footer}</footer>}
        </div>
      </dialog>
    </div>,
    document.body,
  );
}

/** Dropdown menu that closes on outside click and Escape. */
export function Menu({
  label,
  trigger,
  children,
}: {
  label: string;
  trigger?: ReactNode;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false),
    ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) =>
      !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div className="cms-menu" ref={ref}>
      {trigger ? (
        <span onClick={() => setOpen(!open)}>{trigger}</span>
      ) : (
        <Button
          icon="more"
          aria-label={label}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        />
      )}
      {open && (
        <div className="cms-menu-list" role="menu">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

type Toast = { id: number; tone: "success" | "danger" | "info"; text: string };
const ToastContext = createContext<(tone: Toast["tone"], text: string) => void>(
  () => {},
);
export const useToast = () => useContext(ToastContext);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((tone: Toast["tone"], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, tone, text }]);
    setTimeout(
      () => setToasts((t) => t.filter((x) => x.id !== id)),
      tone === "danger" ? 8000 : 4000,
    );
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="cms-toasts" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="cms-toast"
            data-tone={t.tone}
            role={t.tone === "danger" ? "alert" : "status"}
          >
            <CmsIcon
              name={
                t.tone === "danger"
                  ? "alert"
                  : t.tone === "success"
                    ? "check"
                    : "help"
              }
            />
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const errorText = (
  e: unknown,
  fallback = "Không thể thực hiện yêu cầu.",
) => (e instanceof Error && e.message ? e.message : fallback);
export function timeAgo(iso: string) {
  const s = Math.round((Date.now() - +new Date(iso)) / 1000);
  if (s < 60) return "vừa xong";
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
  if (s < 30 * 86400) return `${Math.floor(s / 86400)} ngày trước`;
  return new Date(iso).toLocaleDateString("vi-VN");
}
export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
export const bytes = (n: number | null | undefined) =>
  n == null
    ? "—"
    : n >= 1073741824
      ? `${(n / 1073741824).toFixed(1)} GB`
      : n >= 1048576
        ? `${(n / 1048576).toFixed(1)} MB`
        : `${n ? Math.max(1, Math.round(n / 1024)) : 0} KB`;
export const money = (n: number | null | undefined) =>
  n == null ? "Liên hệ" : `${n.toLocaleString("vi-VN")}đ`;
