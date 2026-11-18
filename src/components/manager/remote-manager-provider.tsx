"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { request, command, collection, ApiFailure } from "@/lib/api/client";
import type {
  ApiBooking,
  ApiPolicy,
  ApiBucket,
  ApiService,
  ApiSettings,
  ApiStaff,
} from "@/lib/api/types";
import { stationTime } from "@/lib/api/types";
import type { ApiCustomer, ApiVehicle } from "@/lib/api/booking-adapter";
import type {
  ManagerData,
  ManagerService,
  ManagerStaff,
} from "@/lib/manager/mock";
import { stationToday } from "@/lib/public-booking/mock";
import { shiftDate, warningText } from "@/lib/booking/logic";
import {
  ManagerContext,
  type ManagerContext as Value,
} from "./manager-provider";
import { ManagerModal } from "./manager-modal";
import { usePathname } from "next/navigation";
import { bookingFromApi } from "@/lib/api/booking-adapter";

const groupCodes: Record<string, string> = {
  "Bảo dưỡng": "MAINTENANCE",
  "Chăm sóc xe": "DETAILING",
  "Phụ kiện": "ACCESSORIES",
  Khác: "OTHER",
};
const empty: ManagerData = {
  bookings: [],
  customers: [],
  services: [],
  staff: [],
  capacity: [],
  content: [],
  events: [],
  orders: [],
  parts: [],
  movements: [],
  shifts: [],
  holidays: [],
  settings: {
    name: "",
    phone: "",
    address: "",
    open: "",
    close: "",
    leadMinutes: 0,
    advanceDays: 1,
    notifyNew: false,
    notifyUpcoming: false,
  },
};
export function RemoteManagerProvider({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [data, setData] = useState<ManagerData | null>(null),
    [policy, setPolicy] = useState<ApiPolicy | null>(null),
    [error, setError] = useState("");
  const [today, setToday] = useState(stationToday),
    [now, setNow] = useState(Date.now),
    [theme, setTheme] = useState<"light" | "dark">("light"),
    [toast, setToast] = useState("");
  const [period, setPeriod] = useState(() => ({
    from: stationToday(),
    to: stationToday(),
  }));
  const [confirmation, setConfirmation] = useState<
      Parameters<Value["ask"]>[0] | null
    >(null),
    [busy, setBusy] = useState(false);
  const raw = useRef<{
    bookings: ApiBooking[];
    services: ApiService[];
    staff: ApiStaff[];
    settings?: ApiSettings;
    policy?: ApiPolicy | null;
  }>({ bookings: [], services: [], staff: [] });
  const ref = useRef<ManagerData>(empty);
  const setRange = useCallback(
    (from: string, to = from) =>
      setPeriod((old) =>
        old.from === from && old.to === to ? old : { from, to },
      ),
    [],
  );
  const load = useCallback(
    async (signal?: AbortSignal) => {
      const [
        bookings,
        pending,
        customers,
        vehicles,
        services,
        staff,
        settings,
        policyResponse,
        calendar,
        audit,
      ] = await Promise.all([
        collection<ApiBooking>(
          `admin/bookings?from=${period.from}&to=${period.to}`,
          signal,
        ),
        path === "/dieu-hanh/lich-hen"
          ? collection<ApiBooking>("admin/bookings?status=PENDING", signal)
          : Promise.resolve([] as ApiBooking[]),
        collection<ApiCustomer>("admin/customers", signal),
        collection<ApiVehicle>("admin/vehicles", signal),
        collection<ApiService>("admin/services", signal),
        collection<ApiStaff>("admin/staff", signal),
        request<ApiSettings>("admin/site-settings", { signal }),
        request<ApiPolicy>("admin/capacity/policy", { signal }).catch((e) => {
          if (e instanceof ApiFailure && e.code === "CAPACITY_NOT_CONFIGURED")
            return null;
          throw e;
        }),
        request<{ buckets: ApiBucket[] }>(
          `admin/capacity/calendar?from=${period.from}&to=${period.to > shiftDate(period.from, 30) ? shiftDate(period.from, 30) : period.to}`,
          { signal },
        ),
        request<
          {
            id: string;
            occurredAt: string;
            actor: { name: string } | string;
            action: string;
            summary: string;
            entityType: string;
          }[]
        >(`admin/audit-logs?from=${today}&to=${today}&limit=100`, { signal }),
      ]);
      const p = policyResponse?.data || null;
      const appointments = Array.from(
        new Map([...bookings, ...pending].map((b) => [b.id, b])).values(),
      );
      const vehicleOf = new Map<string, ApiVehicle>();
      for (const v of vehicles)
        for (const x of v.customerContacts)
          if (!vehicleOf.has(x.customerId)) vehicleOf.set(x.customerId, v);
      const result: ManagerData = {
        ...empty,
        bookings: appointments.map((b) => {
          const time = stationTime(b.scheduledStartAt);
          return {
            id: b.id,
            record: bookingFromApi(b),
            code: b.code,
            serviceVisitId: b.serviceVisitId,
            version: b.version,
            customerId: b.customerId!,
            serviceIds: b.services.map((s) => s.id),
            serviceNames: Object.fromEntries(
              b.services.map((s) => [s.id, s.name]),
            ),
            advisorId: b.assignedAdvisor?.id || "",
            date: time.slice(0, 10),
            time: time.slice(11, 16),
            period:
              b.status === "PENDING" && b.requestedPeriod
                ? b.requestedPeriod === "MORNING"
                  ? "morning"
                  : "afternoon"
                : undefined,
            status:
              b.status.toLowerCase() as ManagerData["bookings"][number]["status"],
            note: b.customerNote || "",
            changeKind: b.changeKind.toLowerCase() as
              "new" | "rescheduled" | "cancelled",
            customerSnapshot: b.customer,
            vehicleSnapshot: b.vehicle,
          };
        }),
        customers: customers.map((c) => {
          const vehicle = vehicleOf.get(c.id);
          return {
            id: c.id,
            name: c.name,
            phone: c.phone,
            model: vehicle?.model || "",
            plate: vehicle?.plate || "",
          };
        }),
        services: services.map((s) => ({
          id: s.id,
          code: s.code,
          name: s.name,
          group: s.category.name,
          duration: s.estimatedDurationMinutes,
            qualityChecks: s.qualityChecks,
            technicianRequired: s.technicianRequired,
          active: s.active,
          bookable: s.bookable,
          version: s.version,
          requirements: s.requirements.map(
            ({ poolId, units, offsetMinutes, durationMinutes }) => ({
              poolId,
              units,
              offsetMinutes,
              durationMinutes,
            }),
          ),
        })),
        staff: staff.map((s) => ({
          id: s.id,
          name: s.name,
          role: s.jobRole.toLowerCase() as ManagerStaff["role"],
          phone: (s.phone || "").replace(/^\+84/, "0"),
          email: s.email || "",
          active: s.active,
          version: s.version,
          accountEnabled: s.accountEnabled,
          workload: (
            s as ApiStaff & {
              workload?: { pending: number; confirmed: number };
            }
          ).workload,
        })),
        capacity: calendar.data.buckets.map((b) => {
          const t = stationTime(b.startAt);
          return {
            id: b.id,
            time: t.slice(11, 16),
            date: t.slice(0, 10),
            group: "Lịch hẹn",
            resource: "Lịch hẹn",
            unit: "lịch",
            endTime: stationTime(b.endAt).slice(11, 16),
            pending: b.pendingCount,
            confirmed: b.confirmedCount,
            free: b.freeUnits,
            total: b.capacityLimit,
            reserved: b.heldUnits,
            state: b.freeUnits ? "available" : "full",
            locked: b.closed,
            version: b.version,
          };
        }),
        settings: {
          ...empty.settings,
          name: settings.data.name,
          phone: settings.data.phone.replace(/^\+84/, "0"),
          address: settings.data.address,
          open: p?.hours[0]?.opensAt || "",
          close: p?.hours[0]?.closesAt || "",
          leadMinutes: p?.leadMinutes || 0,
          advanceDays: p?.advanceDays || 30,
        },
        events: audit.data.map((e) => ({
          id: e.id,
          time: stationTime(e.occurredAt).slice(11, 16),
          actor: typeof e.actor === "string" ? e.actor : e.actor.name,
          action: e.summary,
          target: e.entityType,
        })),
      };
      if (!signal?.aborted) {
        raw.current = {
          bookings: appointments,
          services,
          staff,
          settings: settings.data,
          policy: p,
        };
        ref.current = result;
        setPolicy(p);
        setData(result);
        setError("");
      }
    },
    [period, today, path],
  );
  useEffect(() => {
    const c = new AbortController();
    void load(c.signal).catch((e) => {
      if (e.name !== "AbortError") setError(e.message);
    });
    return () => c.abort();
  }, [load]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("dpauto.manager.theme");
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch {}
  }, []);
  useEffect(() => {
    let last = Date.now();
    const refresh = () => {
      last = Date.now();
      setToday(stationToday());
      setNow(Date.now());
      void load().catch((e) => setError(e.message));
    };
    // Tab focus fires often; skip reloading the full station data again within 15s.
    const focus = () => {
      if (Date.now() - last >= 15000) refresh();
    };
    const timer = setInterval(refresh, 60000);
    window.addEventListener("focus", focus);
    window.addEventListener("dpauto-data-updated", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", focus);
      window.removeEventListener("dpauto-data-updated", refresh);
    };
  }, [load]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5500);
    return () => clearTimeout(timer);
  }, [toast]);
  async function commandBooking(
    id: string,
    action: string,
    input: Record<string, unknown>,
  ) {
    const b = raw.current.bookings.find((b) => b.id === id);
    if (!b) throw new Error("Không tìm thấy lịch hẹn.");
    const receipt = await command<{ warnings?: string[] }>(
      `admin/bookings/${id}/${action}`,
      { ...input, expectedVersion: input.expectedVersion ?? b.version },
    );
    await load();
    setToast("Đã cập nhật lịch hẹn." + warningText(receipt.data?.warnings));
  }
  async function savePolicy(input: Record<string, unknown>) {
    await command("admin/capacity/policy", input, "PUT");
    await load();
    setToast("Đã lưu thiết lập nhận lịch.");
  }
  async function update(
    change: (d: ManagerData) => ManagerData,
    message: string,
    target = "Cập nhật vận hành",
  ) {
    const previous = ref.current,
      next = change(previous);
    try {
      if (next.services !== previous.services) {
        const item = next.services.find(
          (s) =>
            JSON.stringify(s) !==
            JSON.stringify(previous.services.find((p) => p.id === s.id)),
        );
        if (!item) return;
        const old = raw.current.services.find((s) => s.id === item.id);
        const body = {
          name: item.name,
          categoryCode: groupCodes[item.group] || "OTHER",
          active: item.active,
          bookable: !!item.bookable && item.active,
          sortOrder: old?.sortOrder || 0,
          estimatedDurationMinutes: item.duration,
            qualityChecks: item.qualityChecks || [],
            technicianRequired: item.technicianRequired || false,
        };
        if (old)
          await command(
            `admin/services/${item.id}`,
            { ...body, expectedVersion: old.version, reason: target },
            "PATCH",
          );
        else await command("admin/services", { ...body, code: item.code });
      } else if (next.staff !== previous.staff) {
        const item = next.staff.find(
          (s) =>
            JSON.stringify(s) !==
            JSON.stringify(previous.staff.find((p) => p.id === s.id)),
        );
        if (!item) return;
        const old = raw.current.staff.find((s) => s.id === item.id);
        const account = item.createAccount
          ? {
              email: item.email,
              temporaryPassword: item.temporaryPassword,
              role: item.role === "manager" ? "MANAGER" : "ADVISOR",
              permissions: [],
            }
          : undefined;
        const body = {
          name: item.name,
          email: item.email,
          phone: item.phone,
          jobRole: item.role.toUpperCase(),
          active: item.active,
        };
        if (old)
          await command(
            `admin/staff/${item.id}`,
            {
              ...body,
              expectedVersion: old.version,
              reason: target,
              ...(account ? { account: { enable: account } } : {}),
            },
            "PATCH",
          );
        else
          await command("admin/staff", {
            ...body,
            ...(account ? { account } : {}),
          });
      } else if (next.capacity !== previous.capacity) {
        const slot = next.capacity.find(
          (s) =>
            JSON.stringify(s) !==
            JSON.stringify(previous.capacity.find((p) => p.id === s.id)),
        );
        if (!slot) return;
        const old = previous.capacity.find((s) => s.id === slot.id);
        if (!old)
          await command("admin/capacity/days", {
            date: slot.date,
            expectedPolicyVersion: raw.current.policy?.configurationVersion,
            reason: target,
          });
        else
          await command(
            `admin/capacity/buckets/${slot.id}`,
            {
              expectedVersion: old.version,
              startAt: `${slot.date}T${slot.time}:00+07:00`,
              reason: slot.reason || target,
              capacityLimit: slot.total,
              closed: !!slot.locked,
            },
            "PATCH",
          );
      } else if (next.holidays !== previous.holidays) {
        const h = next.holidays.find(
          (h) =>
            !previous.holidays.some(
              (p) => p.date === h.date && p.reason === h.reason,
            ),
        );
        if (!h)
          throw new Error(
            "Hãy mở ngày nghỉ trong phần khung giờ đặt lịch để điều chỉnh.",
          );
        await command("admin/capacity/blocks", {
          startsAt: h.date + "T00:00:00+07:00",
          endsAt: h.date + "T23:59:59+07:00",
          kind: "HOLIDAY",
          reason: h.reason,
        });
      } else if (next.settings !== previous.settings) {
        const value = next.settings,
          old = raw.current.settings!;
        if (
          ["open", "close", "leadMinutes", "advanceDays"].some(
            (k) =>
              value[k as keyof typeof value] !==
              previous.settings[k as keyof typeof value],
          )
        )
          throw new Error(
            "Vui lòng chỉnh giờ và giới hạn nhận lịch tại phần thiết lập nhận lịch.",
          );
        await command(
          "admin/site-settings",
          {
            expectedVersion: old.version,
            reason: target,
            name: value.name,
            phone: value.phone,
            address: value.address,
            directionsUrl: old.directionsUrl,
            privacyNoticeVersion: old.privacyNoticeVersion,
            marketingNoticeVersion: old.marketingNoticeVersion,
          },
          "PUT",
        );
      } else throw new Error("Thao tác chưa khả dụng.");
      await load();
      setToast(message);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Chưa thể lưu thay đổi.");
      throw e;
    }
  }
  return (
    <ManagerContext.Provider
      value={{
        data: data || empty,
        ready: !!data,
        error,
        today,
        now,
        theme,
        toggleTheme: () =>
          setTheme((old) => {
            const next = old === "light" ? "dark" : "light";
            try {
              localStorage.setItem("dpauto.manager.theme", next);
            } catch {}
            return next;
          }),
        update,
        notify: setToast,
        ask: setConfirmation,
        policy,
        setRange,
        refresh: () => load(),
        commandBooking,
        savePolicy,
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
          onClose={() => {
            if (!busy) setConfirmation(null);
          }}
          footer={
            <>
              <button
                className="adm-btn"
                disabled={busy}
                onClick={() => setConfirmation(null)}
              >
                Quay lại
              </button>
              <button
                disabled={busy}
                className={`adm-btn ${confirmation.danger ? "adm-danger" : "adm-primary"}`}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await confirmation.action();
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
            </>
          }
        >
          {confirmation.message}
        </ManagerModal>
      )}
    </ManagerContext.Provider>
  );
}
