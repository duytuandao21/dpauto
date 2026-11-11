import { Icon, type IconName } from "@/components/ui/icon";
export type AdminIconName =
  | "overview"
  | "calendar"
  | "customers"
  | "website"
  | "settings"
  | "bell"
  | "sun"
  | "moon"
  | "plus"
  | "search"
  | "filter"
  | "back"
  | "car"
  | "time"
  | "more"
  | "user"
  | "logout"
  | "collapse"
  | "tool"
  | "check"
  | "phone"
  | "arrow"
  | "close";
const shared: Partial<Record<AdminIconName, IconName>> = {
  tool: "tool",
  check: "check",
  phone: "phone",
  arrow: "arrow",
  close: "close",
};
export function AdminIcon({ name }: { name: AdminIconName }) {
  if (shared[name]) return <Icon name={shared[name]!} />;
  const paths: Partial<Record<AdminIconName, React.ReactNode>> = {
    overview: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="11" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="18" width="7" height="3" rx="1" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M7 3v4m10-4v4M3 11h18M7 15h2m4 0h2m-8 3h2" />
      </>
    ),
    customers: (
      <>
        <circle cx="12" cy="8" r="3" />
        <path d="M6 21v-3a6 6 0 0 1 12 0v3" />
      </>
    ),
    website: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <path d="M3 9h18M8 9v12M7 6h.01m3 0h.01" />
      </>
    ),
    settings: (
      <>
        <path d="m9 3-1 3-3 1-2 5 2 5 3 1 1 3h6l1-3 3-1 2-5-2-5-3-1-1-3Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    bell: (
      <>
        <path d="M5 16v-6a7 7 0 0 1 14 0v6l2 2H3l2-2Zm5 5h4" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
      </>
    ),
    moon: <path d="M20 15a9 9 0 0 1-11-11A9 9 0 1 0 20 15Z" />,
    plus: <path d="M12 5v14M5 12h14" />,
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    filter: (
      <>
        <path d="M3 6h18M6 12h12M9 18h6" />
        <circle cx="8" cy="6" r="2" />
        <circle cx="16" cy="12" r="2" />
      </>
    ),
    back: <path d="m11 5-7 7 7 7M4 12h16" />,
    car: (
      <>
        <path d="m5 8 2-5h10l2 5M3 9h18v9H3V9Zm2 9v3m14-3v3M6 13h2m8 0h2" />
      </>
    ),
    time: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 6v6l4 2" />
      </>
    ),
    more: (
      <>
        <path d="M5 7h14M5 12h14M5 17h9" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="7" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
    logout: (
      <>
        <path d="M10 3H4v18h6m5-14 5 5-5 5m-6-5h11" />
      </>
    ),
    collapse: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <path d="M9 3v18m7-13-3 4 3 4" />
      </>
    ),
  };
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
