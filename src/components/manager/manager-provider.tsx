"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { AdminLoading } from "@/components/admin/primitives";
import { localDate, shiftDate } from "@/lib/booking/logic";
import { createManagerData, type ManagerData } from "@/lib/manager/mock";
import { ManagerModal } from "./manager-modal";

type Confirm = {
  title: string;
  message: string;
  action: () => void;
  label?: string;
  danger?: boolean;
};
type ManagerContext = {
  data: ManagerData;
  today: string;
  now: number;
  theme: "light" | "dark";
  toggleTheme: () => void;
  update: (
    change: (data: ManagerData) => ManagerData,
    message: string,
    target?: string,
  ) => void;
  notify: (message: string) => void;
  ask: (value: Confirm) => void;
};
const Context = createContext<ManagerContext | null>(null);
export function useManager() {
  const value = useContext(Context);
  if (!value) throw new Error("ManagerProvider is required");
  return value;
}

export function ManagerProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<ManagerData | null>(null);
  const [today, setToday] = useState("");
  const [now, setNow] = useState(0);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [toast, setToast] = useState("");
  const [confirmation, setConfirmation] = useState<Confirm | null>(null);
  useEffect(() => {
    document.documentElement.lang = "vi";
    const date = localDate();
    setToday(date);
    setNow(Date.now());
    setData(createManagerData(date, shiftDate));
    try {
      const saved = localStorage.getItem("dpauto.manager.theme");
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch {}
  }, []);
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
      setToday(localDate());
    }, 60000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4200);
    return () => clearTimeout(timer);
  }, [toast]);
  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    try {
      localStorage.setItem("dpauto.manager.theme", next);
    } catch {}
  }
  function update(
    change: (value: ManagerData) => ManagerData,
    message: string,
    target = "Cấu hình hệ thống",
  ) {
    setData((previous) => {
      if (!previous) return previous;
      const next = change(previous);
      return {
        ...next,
        events: [
          {
            id: `EV-${Date.now()}-${previous.events.length}`,
            time: new Intl.DateTimeFormat("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date()),
            actor: "Quản lý",
            action: message,
            target,
          },
          ...next.events,
        ],
      };
    });
    setToast(`${message} trong phiên làm việc này.`);
  }
  if (!data)
    return (
      <div className="adm-app mgr-app" data-theme={theme}>
        <AdminLoading />
      </div>
    );
  return (
    <Context.Provider
      value={{
        data,
        today,
        now,
        theme,
        toggleTheme,
        update,
        notify: setToast,
        ask: setConfirmation,
      }}
    >
      {children}
      {toast && (
        <div className="adm-toast mgr-toast" data-theme={theme} role="status">
          {toast}
        </div>
      )}
      {confirmation && (
        <ManagerModal
          title={confirmation.title}
          theme={theme}
          onClose={() => setConfirmation(null)}
          footer={
            <>
              <button className="adm-btn" onClick={() => setConfirmation(null)}>
                Quay lại
              </button>
              <button
                className={`adm-btn ${confirmation.danger ? "adm-danger" : "adm-primary"}`}
                onClick={() => {
                  confirmation.action();
                  setConfirmation(null);
                }}
              >
                {confirmation.label ?? "Xác nhận"}
              </button>
            </>
          }
        >
          <p>{confirmation.message}</p>
        </ManagerModal>
      )}
    </Context.Provider>
  );
}
