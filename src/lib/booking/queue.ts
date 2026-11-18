import type { Booking } from "./types";

export function pendingQueue(bookings: Booking[]) {
  return bookings
    .filter((b) => b.status === "pending")
    .sort(
      (a, b) =>
        (a.scheduledAt || a.requestedAt)
          .slice(0, 10)
          .localeCompare((b.scheduledAt || b.requestedAt).slice(0, 10)) ||
        a.createdAt.localeCompare(b.createdAt),
    );
}
