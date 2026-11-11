"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useBookings } from "@/components/admin/booking-provider";
import { createAdvisorSeed, makeServiceOrder } from "@/lib/advisor/seed";
import type { ReceptionDraft, ServiceOrder } from "@/lib/advisor/types";

const STORAGE_KEY = "dpauto.advisor-ui.v1";
interface AdvisorContextValue {
  orders: ServiceOrder[];
  ready: boolean;
  receive: (bookingId: string, draft: ReceptionDraft) => ServiceOrder;
  saveOrder: (order: ServiceOrder, message: string) => void;
}

const AdvisorContext = createContext<AdvisorContextValue | null>(null);

export function AdvisorProvider({ children }: { children: React.ReactNode }) {
  const { data, act, notify } = useBookings();
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [ready, setReady] = useState(false);
  const ordersRef = useRef(orders);

  useEffect(() => {
    let initial = createAdvisorSeed(data);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (
          Array.isArray(parsed) &&
          parsed.every(
            (item) =>
              item &&
              typeof item === "object" &&
              typeof item.id === "string" &&
              typeof item.bookingId === "string" &&
              Array.isArray(item.quote?.lines) &&
              Array.isArray(item.events),
          )
        )
          initial = parsed as ServiceOrder[];
      }
    } catch {
      notify("Không đọc được dữ liệu phiếu đã lưu.");
    }
    ordersRef.current = initial;
    setOrders(initial);
    setReady(true);
    // BookingProvider loads data once before rendering this provider.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persist(next: ServiceOrder[], message: string) {
    ordersRef.current = next;
    setOrders(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      notify(`${message} trên thiết bị này.`);
    } catch {
      notify(
        `${message} trong phiên hiện tại. Không thể lưu vào bộ nhớ thiết bị.`,
      );
    }
  }

  function receive(bookingId: string, draft: ReceptionDraft) {
    const booking = data.bookings.find((item) => item.id === bookingId);
    if (!booking || !["confirmed", "arrived"].includes(booking.status))
      throw new Error("Chỉ tiếp nhận lịch đã xác nhận.");
    if (ordersRef.current.some((item) => item.bookingId === bookingId))
      throw new Error("Lịch này đã có phiếu dịch vụ.");
    const order = makeServiceOrder(booking, draft);
    persist([...ordersRef.current, order], "Đã tạo phiếu dịch vụ");
    if (booking.status === "confirmed") act(bookingId, "arrive");
    return order;
  }

  function saveOrder(order: ServiceOrder, message: string) {
    if (!ordersRef.current.some((item) => item.id === order.id))
      throw new Error("Không tìm thấy phiếu dịch vụ.");
    persist(
      ordersRef.current.map((item) => (item.id === order.id ? order : item)),
      message,
    );
  }

  return (
    <AdvisorContext.Provider value={{ orders, ready, receive, saveOrder }}>
      {children}
    </AdvisorContext.Provider>
  );
}

export function useAdvisor() {
  const value = useContext(AdvisorContext);
  if (!value) throw new Error("Thiếu AdvisorProvider");
  return value;
}
