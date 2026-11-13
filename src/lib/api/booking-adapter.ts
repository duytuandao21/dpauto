import type {
  Booking,
  BookingSource,
  BookingStatus,
  Customer,
  Vehicle,
} from "@/lib/booking/types";
import type { ApiBooking } from "./types";
import { stationTime } from "./types";
export const sources: Record<string, BookingSource> = {
  PHONE: "Điện thoại",
  AT_STATION: "Tại trạm",
  WEBSITE: "Website",
  QR: "QR",
  ZALO: "Zalo",
  OTHER: "Điện thoại",
};
export const sourceCode: Record<BookingSource, string> = {
  "Điện thoại": "PHONE",
  "Tại trạm": "AT_STATION",
  Website: "WEBSITE",
  QR: "QR",
  Zalo: "ZALO",
};
export function bookingFromApi(b: ApiBooking): Booking {
  return {
    id: b.id,
    code: b.code,
    version: b.version,
    customerId: b.customerId!,
    vehicleId: b.vehicle?.id || "",
    serviceIds: b.services.map((s) => s.id),
    serviceNames: Object.fromEntries(b.services.map((s) => [s.id, s.name])),
    requestedAt: stationTime(b.requestedStartAt),
    scheduledAt: stationTime(b.scheduledStartAt),
    confirmedAt: b.confirmedStartAt
      ? stationTime(b.confirmedStartAt)
      : undefined,
    createdAt: b.createdAt || b.requestedStartAt,
    status: b.status.toLowerCase() as BookingStatus,
    source: sources[b.source],
    advisorId: b.assignedAdvisor?.id || "",
    customerNote: b.customerNote || "",
    internalNote: b.internalNote || "",
    customerSnapshot: b.customer,
    vehicleSnapshot: b.vehicle,
    serviceVisitId: b.serviceVisitId,
    allowedActions:
      b.allowedActions ||
      (b.status === "PENDING"
        ? [...(b.assignedAdvisor ? ["confirm"] : []), "cancel"]
        : b.status === "CONFIRMED"
          ? ["arrive", "cancel"]
          : []),
    events: [],
  };
}
export type ApiCustomer = {
  id: string;
  name: string;
  phone: string;
  version: number;
  bookingCount?: number;
  vehicleCount?: number;
};
export type ApiVehicle = {
  id: string;
  model: string | null;
  plate: string | null;
  year: number | null;
  customerContacts: { customerId: string; name: string }[];
};
export const customerFromApi = (c: ApiCustomer): Customer => ({
  id: c.id,
  name: c.name,
  phone: c.phone,
  bookingCount: c.bookingCount,
  vehicleCount: c.vehicleCount,
});
export const vehicleFromApi = (v: ApiVehicle): Vehicle => ({
  id: v.id,
  model: v.model || "",
  plate: v.plate || "",
  year: v.year ? String(v.year) : "",
  customerId: v.customerContacts[0]?.customerId || "",
  customerIds: v.customerContacts.map((c) => c.customerId),
});
