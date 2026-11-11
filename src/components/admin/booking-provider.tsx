"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  startTransition,
} from "react";
import { localBookingRepository } from "@/lib/booking/repository";
import { createSeed } from "@/lib/booking/seed";
import { AdminLoading } from "./primitives";
import {
  bookingTime,
  createDemoId,
  formatDate,
  localDate,
  terminal,
  transitionBooking,
  validateDraft,
} from "@/lib/booking/logic";
import type {
  Booking,
  BookingAction,
  BookingData,
  BookingDraft,
  CapacityConfig,
} from "@/lib/booking/types";

type Confirmation = {
  title: string;
  message: string;
  label?: string;
  danger?: boolean;
  buttonTone?: "confirm" | "arrive" | "complete";
  onConfirm: () => void;
};
interface Context {
  theme: "dark" | "light";
  toggleTheme: () => void;
  data: BookingData;
  ready: boolean;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  notify: (message: string) => void;
  ask: (confirmation: Confirmation) => void;
  act: (id: string, action: BookingAction) => void;
  saveBooking: (draft: BookingDraft, id?: string) => Booking;
  reschedule: (id: string, date: string, time: string) => void;
  saveSettings: (value: CapacityConfig) => void;
  reset: () => void;
}
const BookingContext = createContext<Context | null>(null);
const empty: BookingData = {
  version: 1,
  bookings: [],
  customers: [],
  vehicles: [],
  capacity: {
    open: "08:00",
    close: "18:00",
    closedDays: [0],
    holidays: "",
    slotMinutes: 30,
    carsPerSlot: 3,
    notifyNew: true,
    notifyUpcoming: true,
  },
};

export function BookingProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState(empty),
    [ready, setReady] = useState(false),
    [selectedDate, setSelectedDate] = useState("");
  const dataRef = useRef(data);
  const [toast, setToast] = useState(""),
    [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("dpauto.advisor.theme.v2");
      if (saved === "light" || saved === "dark")
        startTransition(() => setTheme(saved));
    } catch {}
    let value: BookingData;
    try {
      value = localBookingRepository.load() || createSeed();
    } catch {
      value = createSeed();
      setToast("Không đọc được dữ liệu đã lưu. Đang dùng dữ liệu ban đầu.");
    }
    value = {
      ...value,
      vehicles: value.vehicles.map((vehicle) => {
        const match = /^DEMO-(\d{3})$/.exec(vehicle.plate);
        return match
          ? {
              ...vehicle,
              plate: `59A-123.${String(39 + Number(match[1])).padStart(2, "0")}`,
            }
          : vehicle;
      }),
    };
    dataRef.current = value;
    startTransition(() => {
      setData(value);
      setSelectedDate(localDate());
      setReady(true);
    });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (confirmation && !dialog.current?.open) dialog.current?.showModal();
  }, [confirmation]);
  function notify(message: string) {
    setToast(message);
  }
  function toggleTheme() {
    const value = theme === "dark" ? "light" : "dark";
    setTheme(value);
    try {
      localStorage.setItem("dpauto.advisor.theme.v2", value);
    } catch {
      notify("Đã đổi giao diện cho phiên hiện tại.");
    }
  }
  function commit(value: BookingData, message: string) {
    dataRef.current = value;
    setData(value);
    try {
      localBookingRepository.save(value);
      notify(message + " trên thiết bị này.");
    } catch {
      notify(
        message +
          " · Bộ nhớ trình duyệt không khả dụng; dữ liệu chỉ giữ trong phiên này.",
      );
    }
  }
  function act(id: string, action: BookingAction) {
    const current = dataRef.current;
    try {
      commit(
        {
          ...current,
          bookings: current.bookings.map((b) =>
            b.id === id ? transitionBooking(b, action) : b,
          ),
        },
        "Đã cập nhật trạng thái lịch hẹn",
      );
    } catch (e) {
      notify(e instanceof Error ? e.message : "Không thể cập nhật lịch hẹn.");
    }
  }
  function saveBooking(draft: BookingDraft, id?: string) {
    const current = dataRef.current,
      existing = current.bookings.find((b) => b.id === id);
    if (id && (!existing || terminal(existing.status)))
      throw new Error(
        "Lịch đã kết thúc hoặc không còn tồn tại; không thể sửa.",
      );
    if (Object.keys(validateDraft(draft, localDate(), existing)).length)
      throw new Error("Vui lòng kiểm tra các trường bắt buộc.");
    const customerId =
      draft.customerId ||
      current.customers.find(
        (c) => c.phone === draft.phone.replace(/[\s.-]/g, ""),
      )?.id ||
      createDemoId();
    const customer = {
      id: customerId,
      name: draft.name.trim(),
      phone: draft.phone.replace(/[\s.-]/g, ""),
    };
    const vehicleId = draft.vehicleId || createDemoId();
    const oldVehicle = current.vehicles.find((v) => v.id === vehicleId);
    const vehicle = {
      id: vehicleId,
      customerId,
      model: draft.model.trim(),
      plate: draft.plate.trim().toUpperCase(),
      year: oldVehicle?.year || "",
    };
    const now = new Date().toISOString(),
      requestedAt = `${draft.date}T${draft.time}:00`;
    const confirmedAt =
      draft.confirmedDate && draft.confirmedTime
        ? `${draft.confirmedDate}T${draft.confirmedTime}:00`
        : undefined;
    if (existing?.status !== "pending" && existing && !confirmedAt)
      throw new Error("Lịch đã xác nhận cần giữ ngày giờ xác nhận.");
    const timeChanged =
      existing &&
      (existing.requestedAt !== requestedAt ||
        existing.confirmedAt !== confirmedAt);
    const booking: Booking = {
      id:
        existing?.id ||
        `DP-${createDemoId().replace(/-/g, "").slice(-8).toUpperCase()}`,
      customerId,
      vehicleId,
      serviceIds: draft.serviceIds,
      requestedAt,
      confirmedAt,
      createdAt: existing?.createdAt || now,
      status:
        existing?.status === "pending" && confirmedAt
          ? "confirmed"
          : existing?.status || (confirmedAt ? "confirmed" : "pending"),
      source: draft.source,
      advisorId: draft.advisorId,
      customerNote: draft.customerNote.trim(),
      internalNote: draft.internalNote.trim(),
      events: [
        ...(existing?.events || []),
        {
          id: createDemoId(),
          at: now,
          label: existing
            ? timeChanged
              ? "Đổi lịch hẹn"
              : "Cập nhật thông tin"
            : "Tạo lịch hẹn",
          detail: timeChanged
            ? `${formatDate(bookingTime(existing))} ${bookingTime(existing).slice(11, 16)} → ${formatDate(confirmedAt || requestedAt)} ${(confirmedAt || requestedAt).slice(11, 16)}`
            : "Cố vấn dịch vụ",
        },
      ],
    };
    commit(
      {
        ...current,
        customers: [
          ...current.customers.filter((c) => c.id !== customerId),
          customer,
        ],
        vehicles: [
          ...current.vehicles.filter((v) => v.id !== vehicleId),
          vehicle,
        ],
        bookings: existing
          ? current.bookings.map((b) => (b.id === id ? booking : b))
          : [...current.bookings, booking],
      },
      existing ? "Đã cập nhật lịch hẹn" : "Đã tạo lịch hẹn",
    );
    return booking;
  }
  function reschedule(id: string, date: string, time: string) {
    const current = dataRef.current,
      b = current.bookings.find((item) => item.id === id);
    if (!b || !["pending", "confirmed"].includes(b.status))
      throw new Error("Chỉ có thể đổi lịch đang chờ hoặc đã xác nhận.");
    const at = `${date}T${time}:00`,
      previous = bookingTime(b);
    commit(
      {
        ...current,
        bookings: current.bookings.map((item) =>
          item.id !== id
            ? item
            : {
                ...item,
                requestedAt: b.status === "pending" ? at : b.requestedAt,
                confirmedAt: b.status === "confirmed" ? at : undefined,
                events: [
                  ...b.events,
                  {
                    id: createDemoId(),
                    at: new Date().toISOString(),
                    label: "Đổi lịch hẹn",
                    detail: `${formatDate(previous)} ${previous.slice(11, 16)} → ${formatDate(at)} ${time}`,
                  },
                ],
              },
        ),
      },
      "Đã đổi lịch hẹn",
    );
    setSelectedDate(date);
  }
  function reset() {
    commit(createSeed(), "Đã khôi phục dữ liệu ban đầu");
    setSelectedDate(localDate());
  }
  if (!ready)
    return (
      <div className="adm-app" data-theme={theme} lang="vi">
        <div className="adm-main">
          <AdminLoading />
        </div>
      </div>
    );
  return (
    <BookingContext.Provider
      value={{
        theme,
        toggleTheme,
        data,
        ready,
        selectedDate,
        setSelectedDate,
        notify,
        ask: setConfirmation,
        act,
        saveBooking,
        reschedule,
        reset,
        saveSettings: (value) =>
          commit({ ...dataRef.current, capacity: value }, "Đã lưu cấu hình"),
      }}
    >
      {children}
      {toast && (
        <div className="adm-toast" data-theme={theme} role="status">
          <span>{toast}</span>
          <button
            type="button"
            aria-label="Đóng thông báo"
            onClick={() => setToast("")}
          >
            ×
          </button>
        </div>
      )}
      <dialog
        ref={dialog}
        className="adm-dialog"
        data-theme={theme}
        aria-labelledby="adm-confirm-title"
        onCancel={() => setConfirmation(null)}
        onClose={() => setConfirmation(null)}
      >
        {confirmation && (
          <>
            <span className="adm-eyebrow">XÁC NHẬN THAO TÁC</span>
            <h2 id="adm-confirm-title">{confirmation.title}</h2>
            <p>{confirmation.message}</p>
            <div className="adm-dialog-actions">
              <button
                className="adm-btn"
                onClick={() => {
                  dialog.current?.close();
                  setConfirmation(null);
                }}
              >
                Quay lại
              </button>
              <button
                className={`adm-btn ${confirmation.danger ? "adm-danger" : "adm-primary"}${confirmation.buttonTone ? ` adm-booking-action adm-action-${confirmation.buttonTone}` : ""}`}
                onClick={() => {
                  const action = confirmation.onConfirm;
                  dialog.current?.close();
                  setConfirmation(null);
                  action();
                }}
              >
                {confirmation.label || "Xác nhận"}
              </button>
            </div>
          </>
        )}
      </dialog>
    </BookingContext.Provider>
  );
}
export function useBookings() {
  const value = useContext(BookingContext);
  if (!value) throw new Error("Thiếu BookingProvider");
  return value;
}
