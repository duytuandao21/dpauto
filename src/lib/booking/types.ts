export type BookingStatus =
  "pending" | "confirmed" | "arrived" | "completed" | "cancelled" | "no_show";
export type BookingSource =
  "Điện thoại" | "Tại trạm" | "Website" | "QR" | "Zalo";
export interface Customer {
  id: string;
  name: string;
  phone: string;
}
export interface Vehicle {
  id: string;
  customerId: string;
  model: string;
  plate: string;
  year: string;
}
export interface Service {
  id: string;
  name: string;
  duration: number;
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
  customerId: string;
  vehicleId: string;
  serviceIds: string[];
  requestedAt: string;
  confirmedAt?: string;
  createdAt: string;
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
}
export interface BookingRepository {
  load(): BookingData | null;
  save(data: BookingData): void;
  clear(): void;
}
export type BookingAction =
  "confirm" | "arrive" | "complete" | "cancel" | "no_show";
export interface BookingDraft {
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
}
