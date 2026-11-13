import type { ManagerBooking } from "@/lib/manager/mock";
import { visitStages, type VisitStage } from "./visits";

export function managerSectionActive(path: string, section: string) {
  const base = "/dieu-hanh" + section;
  return path === base || (!!section && path.startsWith(base + "/"));
}
export function managerVisitStage(value: string | null): VisitStage | "" {
  const old: Record<string, VisitStage> = {
    reception: "RECEIVED",
    quote: "INSPECTED",
    work: "IN_PROGRESS",
    acceptance: "QUALITY_CHECK",
    ready: "READY",
    done: "HANDED_OVER",
  };
  if (!value) return "";
  return Object.hasOwn(visitStages, value)
    ? (value as VisitStage)
    : Object.hasOwn(old, value)
      ? old[value]
      : "";
}
export function managerBookingSummary(
  values: ManagerBooking[],
  from: string,
  to: string,
) {
  const bookings = values.filter((b) => b.date >= from && b.date <= to);
  return {
    bookings,
    total: bookings.length,
    pending: bookings.filter((b) => b.status === "pending").length,
    confirmed: bookings.filter((b) => b.status === "confirmed").length,
    unassigned: bookings.filter(managerBookingNeedsAdvisor).length,
    received: bookings.filter((b) =>
      ["arrived", "completed"].includes(b.status),
    ).length,
  };
}

export function managerBookingNeedsAdvisor(booking: ManagerBooking) {
  return !booking.advisorId && ["pending", "confirmed"].includes(booking.status);
}
