import type { BookingData, BookingRepository } from "./types";

export const BOOKING_STORAGE_KEY = "dpauto.booking-ui.v1";
export const localBookingRepository: BookingRepository = {
  load() {
    const raw = localStorage.getItem(BOOKING_STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as BookingData;
    if (
      value.version !== 1 ||
      !Array.isArray(value.bookings) ||
      !Array.isArray(value.customers) ||
      !Array.isArray(value.vehicles) ||
      !value.capacity
    )
      throw new Error("Dữ liệu lưu không hợp lệ.");
    const customerIds = new Set(value.customers.map((c) => c.id)),
      vehicleIds = new Set(value.vehicles.map((v) => v.id));
    if (
      value.bookings.some(
        (b) =>
          !customerIds.has(b.customerId) ||
          !vehicleIds.has(b.vehicleId) ||
          !Array.isArray(b.events) ||
          !Array.isArray(b.serviceIds) ||
          ![
            "pending",
            "confirmed",
            "arrived",
            "completed",
            "cancelled",
            "no_show",
          ].includes(b.status),
      )
    )
      throw new Error("Dữ liệu lưu không hợp lệ.");
    return value;
  },
  save(data) {
    localStorage.setItem(BOOKING_STORAGE_KEY, JSON.stringify(data));
  },
  clear() {
    localStorage.removeItem(BOOKING_STORAGE_KEY);
  },
};
