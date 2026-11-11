import type { CSSProperties } from "react";

export type IconName =
  | "arrow"
  | "chevron"
  | "phone"
  | "pin"
  | "clock"
  | "mail"
  | "check"
  | "shield"
  | "tool"
  | "sparkles"
  | "box"
  | "door"
  | "star"
  | "play"
  | "pause"
  | "volume"
  | "muted"
  | "expand"
  | "close"
  | "facebook"
  | "instagram"
  | "award"
  | "menu";
const paths: Record<
  Exclude<IconName, "facebook" | "instagram">,
  React.ReactNode
> = {
  arrow: (
    <>
      <path d="M7 17 17 7M7 7h10v10" />
    </>
  ),
  chevron: <path d="m6 9 6 6 6-6" />,
  phone: (
    <>
      <path d="M15 3a6 6 0 0 1 6 6M15 7a2 2 0 0 1 2 2M5 3h4l2 5-3 2a14 14 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2C9 21 3 15 3 5a2 2 0 0 1 2-2Z" />
    </>
  ),
  pin: (
    <>
      <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  clock: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M7 2v4m10-4v4M3 10h18m-13 6 3 3 5-6" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 6 9 7 9-7" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  shield: (
    <>
      <path d="m12 3 8 4v6c0 5-8 9-8 9s-8-4-8-9V7l8-4Z" />
      <path d="m8 12 3 3 5-5" />
    </>
  ),
  tool: (
    <>
      <path d="M14 6a6 6 0 0 0-7 8L2 19l3 3 5-5a6 6 0 0 0 8-7l-4 4-4-4 4-4Z" />
    </>
  ),
  sparkles: (
    <>
      <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Zm8-2v4m-2-2h4" />
    </>
  ),
  box: (
    <>
      <path d="m12 2 9 5v10l-9 5-9-5V7l9-5Zm-9 5 9 5 9-5M12 12v10M7.5 4.5l9 5" />
    </>
  ),
  door: (
    <>
      <path d="M3 21h18M6 21V4l12-2v19M14 12h.01" />
    </>
  ),
  star: (
    <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2 2 9.3l6.9-1L12 2Z" />
  ),
  play: <path d="m8 5 11 7-11 7V5Z" />,
  pause: (
    <>
      <path d="M8 5v14M16 5v14" />
    </>
  ),
  volume: (
    <>
      <path d="m11 5-6 4H2v6h3l6 4V5Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />
    </>
  ),
  muted: (
    <>
      <path d="m11 5-6 4H2v6h3l6 4V5Zm5 4 6 6m0-6-6 6" />
    </>
  ),
  expand: <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  award: (
    <>
      <path d="m12 2 3 2 4 1 1 4 2 3-2 3-1 4-4 1-3 2-3-2-4-1-1-4-2-3 2-3 1-4 4-1 3-2Z" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  menu: <path d="M5 6h14M5 12h14M5 18h14" />,
};
export function Icon({
  name,
  className = "",
  style,
}: {
  name: IconName;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      className={`icon ${className}`}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === "facebook" ? (
        <path
          fill="currentColor"
          stroke="none"
          d="M14 22v-9h3l.5-4H14V6.5c0-1.2.3-2 2-2h2V1.1C17.6 1 16.4 1 15 1c-3 0-5 1.8-5 5v3H7v4h3v9h4Z"
        />
      ) : name === "instagram" ? (
        <>
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r=".5" />
        </>
      ) : (
        paths[name]
      )}
    </svg>
  );
}
