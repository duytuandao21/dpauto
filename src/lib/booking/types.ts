import type { PartnerSnapshot } from "@/lib/api/partners";
export type BookingStatus =
  "pending" | "confirmed" | "arrived" | "completed" | "cancelled" | "no_show";
export type BookingSource =
  "Điện thoại" | "Tại trạm" | "Website" | "QR" | "Zalo";
export interface Customer {
  id: string;
  name: string;
  phone: string;
  bookingCount?: number;
  vehicleCount?: number;
  version?: number;
}
export interface Vehicle {
  id: string;
  customerId: string;
  customerIds?: string[];
  model: string;
  plate: string;
  year: string;
}
export interface Service {
  id: string;
  name: string;
  duration: number;
  active?: boolean;
  bookable?: boolean;
}
export interface Advisor {
  id: string;
  name: string;
}
export interface BookingEvent {
  id: string;
  at: string;
  label: string;
  detail: string;
}
export interface Booking {
  id: string;
  code?: string;
  /** Partner car (Xe đối tác): partner and sale names at the time. */
  partner?: PartnerSnapshot | null;
  version?: number;
  scheduledAt?: string;
  allowedActions?: string[];
  serviceVisitId?: string | null;
  customerSnapshot?: { name: string; phone: string };
  vehicleSnapshot?: {
    model: string | null;
    plate: string | null;
    year?: string | number | null;
  } | null;
  serviceNames?: Record<string, string>;
  customerId: string;
  vehicleId: string;
  serviceIds: string[];
  requestedAt: string;
  /** Half-day the customer asked for; set while the advisor has not fixed an exact time. */
  period?: "morning" | "afternoon";
  originalPeriod?: "morning" | "afternoon";
  confirmedAt?: string;
  createdAt: string;
  lastContactOutcome?: string | null;
  contactAttempts?: number;
  callbackAt?: string | null;
  status: BookingStatus;
  source: BookingSource;
  advisorId: string;
  customerNote: string;
  internalNote: string;
  events: BookingEvent[];
}
export interface CapacityConfig {
  open: string;
  close: string;
  closedDays: number[];
  holidays: string;
  slotMinutes: number;
  carsPerSlot: number;
  notifyNew: boolean;
  notifyUpcoming: boolean;
}
export interface BookingData {
  version: 1;
  bookings: Booking[];
  customers: Customer[];
  vehicles: Vehicle[];
  capacity: CapacityConfig;
  services?: Service[];
  advisors?: Advisor[];
}
export interface BookingRepository {
  load(): BookingData | null;
  save(data: BookingData): void;
  clear(): void;
}
export type BookingAction =
  "confirm" | "arrive" | "complete" | "cancel" | "no_show";
export interface BookingDraft {
  confirmNow?: boolean;
  period?: "morning" | "afternoon";
  customerId: string;
  name: string;
  phone: string;
  vehicleId: string;
  model: string;
  plate: string;
  serviceIds: string[];
  date: string;
  time: string;
  confirmedDate: string;
  confirmedTime: string;
  advisorId: string;
  source: BookingSource;
  customerNote: string;
  internalNote: string;
  /** Sale of a partner car; empty for a normal customer. */
  partnerSaleId?: string;
}
