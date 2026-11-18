import React, {
  createContext,
  useContext,
  useState,
  useSyncExternalStore,
} from "react";

declare global {
  interface Window {
    advisorQa: any;
    advisorQaErrors: string[];
  }
}
const state = window.advisorQa;
export const apiEnabled = true;
export const newRequestKey = () => crypto.randomUUID();
export class ApiFailure extends Error {}
export const useSession = () => state.session;
export const AuthGate = ({ children }: { children: React.ReactNode }) =>
  children;
export const AdvisorProvider = AuthGate;
export const useAdvisor = () => ({ orders: [], ready: true });
export const signOut = async () => {
  throw Error("QA is read-only");
};
const Theme = createContext({ theme: "light", toggleTheme() {} });
export function BookingProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState(state.theme);
  return (
    <Theme.Provider
      value={{
        theme,
        toggleTheme: () => setTheme(theme === "light" ? "dark" : "light"),
      }}
    >
      {children}
    </Theme.Provider>
  );
}
export function useBookings() {
  return {
    ...useContext(Theme),
    data: state.data,
    ready: true,
    error: "",
    selectedDate: "",
    setSelectedDate() {},
    reset() {},
    notify() {},
    ask() {},
  };
}
const subscribe = (callback: () => void) => {
  addEventListener("popstate", callback);
  return () => removeEventListener("popstate", callback);
};
const navigate = (href: string) => {
  history.pushState({}, "", href);
  dispatchEvent(new PopStateEvent("popstate"));
};
export const useRouter = () => ({ push: navigate, replace: navigate });
export const usePathname = () =>
  useSyncExternalStore(subscribe, () => location.pathname);
export const useSearchParams = () =>
  new URLSearchParams(useSyncExternalStore(subscribe, () => location.search));
export default function Link({
  children,
  scroll,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { scroll?: boolean }) {
  return (
    <a
      {...props}
      onClick={(event) => {
        props.onClick?.(event);
        if (
          event.defaultPrevented ||
          props.target === "_blank" ||
          !props.href?.startsWith("/co-van")
        )
          return;
        event.preventDefault();
        navigate(props.href);
      }}
    >
      {children}
    </a>
  );
}
export async function collection(path: string): Promise<any[]> {
  if (path.startsWith("admin/service-visits")) return state.visits;
  if (path.startsWith("admin/services")) return state.data.services;
  if (path.startsWith("admin/staff"))
    return [{ id: "advisor", name: "Trần Minh Khang", active: true }];
  if (path.startsWith("admin/customers")) return state.data.customers;
  if (path.startsWith("admin/vehicles")) return state.data.vehicles;
  return [];
}
export async function request(path: string): Promise<any> {
  const resource = path.split("?")[0];
  let data: any = [];
  if (resource.endsWith("/workflow")) data = state.workflow;
  else if (resource.endsWith("/legacy-records")) data = [];
  else if (resource === "admin/service-visits/visit") data = state.visit;
  else if (resource === "admin/service-visits")
    data = path.includes("bookingId=") ? [] : state.visits;
  else if (resource === "admin/services") data = state.data.services;
  else if (resource === "admin/notifications") data = state.notices;
  else if (resource.startsWith("admin/vehicles/"))
    data = state.data.vehicles.find((v: any) => resource.endsWith(v.id));
  else if (resource.startsWith("admin/bookings/")) data = state.booking;
  return {
    data,
    page: {
      hasMore: resource === "admin/notifications" && !path.includes("limit=1"),
      nextCursor:
        resource === "admin/notifications" && !path.includes("limit=1")
          ? "qa-next"
          : null,
    },
    meta: {
      catalogVersion: 1,
      policyVersion: 1,
      privacyNoticeVersion: "BOOKING_V1",
      unread: 2,
    },
  };
}
export async function command(): Promise<never> {
  throw Error("QA is read-only");
}
