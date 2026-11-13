"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { request, command, collection } from "@/lib/api/client";
import {
  bookingFromApi,
  customerFromApi,
  vehicleFromApi,
  sourceCode,
  type ApiCustomer,
  type ApiVehicle,
} from "@/lib/api/booking-adapter";
import {
  stationTime,
  type ApiBooking,
  type ApiService,
  type ApiStaff,
} from "@/lib/api/types";
import { stationToday } from "@/lib/public-booking/mock";
import { bookingTime, shiftDate } from "@/lib/booking/logic";
import type { Booking, BookingData, BookingDraft } from "@/lib/booking/types";
import { BookingContext, type Confirmation } from "./booking-provider";
import { useSession } from "./auth-gate";

const empty: BookingData = {
  version: 1,
  bookings: [],
  customers: [],
  vehicles: [],
  services: [],
  advisors: [],
  capacity: {
    open: "",
    close: "",
    closedDays: [],
    holidays: "",
    slotMinutes: 0,
    carsPerSlot: 0,
    notifyNew: false,
    notifyUpcoming: false,
  },
};
export function RemoteBookingProvider({ children }: { children: ReactNode }) {
  const session = useSession()!,
    path = usePathname();
  const [data, setData] = useState(empty),
    [ready, setReady] = useState(false),
    [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState(stationToday),
    [theme, setTheme] = useState<"light" | "dark">("light"),
    [toast, setToast] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null),
    [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null),
    ref = useRef(data);
  const versions = useRef({
    catalogVersion: 1,
    policyVersion: 1,
    privacyNoticeVersion: "",
  });
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const customerId = /^\/co-van\/khach-hang\/([a-f\d-]{36})/.exec(
        path,
      )?.[1];
      const bookingId =
        /^\/co-van\/(?:lich-hen|tiep-nhan)\/([a-f\d-]{36})/.exec(path)?.[1];
      const vehicleId = /^\/co-van\/xe\/([a-f\d-]{36})/.exec(path)?.[1];
      const query = customerId
        ? "customerId=" + customerId
        : vehicleId
          ? "vehicleId=" + vehicleId
          : `from=${shiftDate(selectedDate, -7)}&to=${shiftDate(selectedDate, 7)}`;
      const [bookings, customers, vehicles, services, staff, metadata] =
        await Promise.all([
          collection<ApiBooking>("admin/bookings?" + query, signal),
          collection<ApiCustomer>("admin/customers", signal),
          collection<ApiVehicle>("admin/vehicles", signal),
          collection<ApiService>("admin/services", signal),
          collection<ApiStaff>("admin/staff", signal),
          request<ApiService[]>("admin/services?limit=1", { signal }),
        ]);
      versions.current = {
        catalogVersion: Number(metadata.meta.catalogVersion),
        policyVersion: Number(metadata.meta.policyVersion),
        privacyNoticeVersion: String(metadata.meta.privacyNoticeVersion),
      };
      const values = bookings.map(bookingFromApi);
      if (bookingId) {
        const detail = (
          await request<ApiBooking>("admin/bookings/" + bookingId, { signal })
        ).data;
        const booking = bookingFromApi(detail);
        const timeline = await collection<{
          id: string;
          occurredAt: string;
          summary: string;
          reason: string | null;
        }>("admin/bookings/" + bookingId + "/events", signal);
        booking.events = timeline.map((e) => ({
          id: e.id,
          at: e.occurredAt,
          label: e.summary,
          detail: e.reason || "",
        }));
        const index = values.findIndex((b) => b.id === booking.id);
        if (index >= 0) values[index] = booking;
        else values.push(booking);
      }
      const result = {
        ...empty,
        bookings: values,
        customers: customers.map(customerFromApi),
        vehicles: vehicles.map(vehicleFromApi),
        services: services.map((s) => ({
          id: s.id,
          name: s.name,
          duration: s.estimatedDurationMinutes,
        })),
        advisors: staff
          .filter((s) => s.active && s.jobRole === "ADVISOR")
          .map((s) => ({ id: s.id, name: s.name })),
      };
      if (!signal?.aborted) {
        ref.current = result;
        setData(result);
        setReady(true);
        setError("");
      }
      return result;
    },
    [selectedDate, path],
  );
  useEffect(() => {
    const c = new AbortController();
    setReady(false);
    void refresh(c.signal).catch((e) => {
      if (e.name !== "AbortError") {
        setError(e.message);
        setReady(true);
      }
    });
    return () => c.abort();
  }, [refresh]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("dpauto.advisor.theme.v2");
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch {}
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 5500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (confirmation && !dialog.current?.open) dialog.current?.showModal();
  }, [confirmation]);
  useEffect(() => {
    const update = () => {
      void refresh().catch((e) => setError(e.message));
    };
    window.addEventListener("focus", update);
    window.addEventListener("dpauto-data-updated", update);
    const timer = setInterval(update, 60000);
    return () => {
      window.removeEventListener("focus", update);
      window.removeEventListener("dpauto-data-updated", update);
      clearInterval(timer);
    };
  }, [refresh]);
  async function act(id: string, action: string) {
    const current = ref.current.bookings.find((b) => b.id === id);
    if (!current) return;
    try {
      if (!["confirm", "cancel", "no_show"].includes(action))
        throw new Error("Thao tác chưa khả dụng.");
      await command(`admin/bookings/${id}/${action.replace("_", "-")}`, {
        expectedVersion: current.version,
        reason:
          action === "cancel"
            ? "Khách yêu cầu hủy lịch"
            : action === "no_show"
              ? "Cố vấn đã liên hệ và kiểm tra khách không đến"
              : "Đã trao đổi và thống nhất với khách",
        ...(action === "confirm"
          ? { confirmedStartAt: bookingTime(current), customerAgreed: true }
          : action === "no_show"
            ? { checkedManually: true }
            : {}),
      });
      await refresh();
      setToast("Đã cập nhật lịch hẹn.");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Chưa thể cập nhật.");
    }
  }
  async function saveBooking(
    draft: BookingDraft,
    id?: string,
  ): Promise<Booking> {
    const existing = ref.current.bookings.find((b) => b.id === id);
    const vehicle = draft.vehicleId
      ? { id: draft.vehicleId }
      : draft.model.trim() || draft.plate.trim()
        ? {
            ...(draft.model.trim() ? { model: draft.model.trim() } : {}),
            ...(draft.plate.trim() ? { plate: draft.plate.trim() } : {}),
          }
        : null;
    const common = {
      ...(!existing ||
      JSON.stringify(existing.serviceIds) !== JSON.stringify(draft.serviceIds)
        ? { serviceIds: draft.serviceIds }
        : {}),
      catalogVersion: versions.current.catalogVersion,
      policyVersion: versions.current.policyVersion,
      ...(existing || draft.customerNote.trim()
        ? { customerNote: draft.customerNote.trim() }
        : {}),
      ...(existing || draft.internalNote.trim()
        ? { internalNote: draft.internalNote.trim() }
        : {}),
    };
    const receipt = existing
      ? await command<{ bookingId: string }>(
          `admin/bookings/${id}`,
          {
            ...common,
            expectedVersion: existing.version,
            reason: "Cập nhật thông tin theo yêu cầu khách",
            customerContact: { name: draft.name, phone: draft.phone },
            vehicle,
          },
          "PATCH",
        )
      : await command<{ bookingId: string }>("admin/bookings", {
          ...common,
          customer: draft.customerId
            ? { id: draft.customerId }
            : { name: draft.name, phone: draft.phone },
          vehicle,
          requestedStartAt: `${draft.date}T${draft.time}:00+07:00`,
          source: sourceCode[draft.source],
          ...(session.roles.includes("MANAGER")
            ? { advisorId: draft.advisorId || null }
            : {}),
          notice: {
            privacyNoticeVersion: versions.current.privacyNoticeVersion,
            privacyNoticeAcknowledged: true,
            marketingConsent: false,
          },
        });
    const result = await refresh();
    const saved = result.bookings.find((b) => b.id === receipt.data.bookingId);
    return (
      saved ||
      bookingFromApi(
        (await request<ApiBooking>("admin/bookings/" + receipt.data.bookingId))
          .data,
      )
    );
  }
  async function reschedule(id: string, date: string, time: string) {
    const b = ref.current.bookings.find((b) => b.id === id);
    if (!b) throw new Error("Không tìm thấy lịch hẹn.");
    await command(`admin/bookings/${id}/reschedule`, {
      expectedVersion: b.version,
      reason: "Đã trao đổi và thống nhất giờ mới với khách",
      newStartAt: `${date}T${time}:00+07:00`,
      customerAgreed: true,
      policyVersion: versions.current.policyVersion,
    });
    await refresh();
    setSelectedDate(date);
    setToast("Đã đổi lịch hẹn.");
  }
  return (
    <BookingContext.Provider
      value={{
        data,
        ready,
        error,
        selectedDate,
        setSelectedDate,
        theme,
        toggleTheme: () =>
          setTheme((old) => {
            const next = old === "light" ? "dark" : "light";
            try {
              localStorage.setItem("dpauto.advisor.theme.v2", next);
            } catch {}
            return next;
          }),
        notify: setToast,
        ask: setConfirmation,
        act,
        saveBooking,
        reschedule,
        saveSettings: () =>
          setToast("Cấu hình vận hành do quản lý cửa hàng cập nhật."),
        reset: () => {
          void refresh().catch((e) => setError(e.message));
        },
      }}
    >
      {children}
      {toast && (
        <div className="adm-toast" data-theme={theme} role="status">
          {toast}
        </div>
      )}
      <dialog
        ref={dialog}
        className="adm-dialog"
        data-theme={theme}
        aria-labelledby="remote-confirm-title"
        onCancel={(e) => {
          if (busy) e.preventDefault();
          else setConfirmation(null);
        }}
        onClose={() => {
          if (!busy) setConfirmation(null);
        }}
      >
        {confirmation && (
          <>
            <h2 id="remote-confirm-title">{confirmation.title}</h2>
            <p>{confirmation.message}</p>
            <div className="adm-dialog-actions">
              <button
                className="adm-btn"
                disabled={busy}
                onClick={() => {
                  dialog.current?.close();
                  setConfirmation(null);
                }}
              >
                Quay lại
              </button>
              <button
                disabled={busy}
                className={`adm-btn ${confirmation.danger ? "adm-danger" : "adm-primary"}${confirmation.buttonTone ? ` adm-booking-action adm-action-${confirmation.buttonTone}` : ""}`}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await confirmation.onConfirm();
                    dialog.current?.close();
                    setConfirmation(null);
                  } catch (e) {
                    setToast(
                      e instanceof Error ? e.message : "Chưa thể thực hiện.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Đang xử lý…" : confirmation.label || "Xác nhận"}
              </button>
            </div>
          </>
        )}
      </dialog>
    </BookingContext.Provider>
  );
}
