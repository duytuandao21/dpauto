import { bookingServices } from "@/lib/booking/seed";
import type { Booking, BookingData } from "@/lib/booking/types";
import type { QuoteLine, ReceptionDraft, ServiceOrder } from "./types";

export const servicePrices: Record<string, number> = {
  wash: 350000,
  interior: 900000,
  ceramic: 4500000,
  ppf: 12000000,
  tint: 4200000,
  accessories: 1500000,
};

export const operationChecks = [
  "Khởi động",
  "Tiếng động cơ",
  "Chuyển số",
  "Gầm xe",
  "Hệ thống lái",
  "Phanh",
  "Điều hòa",
  "Dầu máy",
  "Nước làm mát",
];

export function makeServiceOrder(
  booking: Booking,
  draft: ReceptionDraft,
  openedAt = new Date().toISOString(),
): ServiceOrder {
  const code = booking.id.replace(/^DP-/, "");
  const lines: QuoteLine[] = booking.serviceIds.map((id) => ({
    id: `service-${id}`,
    kind: "service",
    name: bookingServices.find((service) => service.id === id)?.name || id,
    code: id.toUpperCase(),
    unit: "Lần",
    quantity: 1,
    price: servicePrices[id] || 0,
    discount: 0,
    vat: 0,
  }));
  return {
    id: `DV-${code}`,
    bookingId: booking.id,
    customerId: booking.customerId,
    vehicleId: booking.vehicleId,
    advisorId: booking.advisorId,
    openedAt,
    stage: "quote",
    ...draft,
    quote: {
      id: `BG-${code}`,
      status: "draft",
      lines,
      discount: 0,
      note: "",
    },
    work: {
      technician: "",
      startedAt: "",
      dueAt: "",
      progress: 0,
      checklist: lines.map((line) => ({
        id: line.id,
        label: line.name,
        done: false,
      })),
      note: "",
      logs: [],
    },
    acceptance: {
      inspector: "",
      checkedAt: "",
      result: "pending",
      note: "",
      checks: lines.map((line) => ({
        id: line.id,
        label: line.name,
        passed: false,
      })),
    },
    finance: { deposit: 0, collected: 0 },
    events: [
      {
        id: `event-${code}`,
        at: openedAt,
        label: "Tiếp nhận xe",
        detail: "Tạo phiếu dịch vụ trong dữ liệu giao diện",
      },
    ],
  };
}

export function createAdvisorSeed(data: BookingData): ServiceOrder[] {
  return data.bookings
    .filter((booking) => ["DP-0003", "DP-0004", "DP-0016"].includes(booking.id))
    .map((booking) => {
      const order = makeServiceOrder(
        booking,
        {
          odo: booking.id === "DP-0003" ? "38250" : "",
          request:
            booking.customerNote || "Kiểm tra và thực hiện dịch vụ đã hẹn",
          exterior: "Đã kiểm tra khi tiếp nhận",
          interior: "",
          engine: "",
          dashboard: "",
          tires: "",
          operation: [],
          receptionNote: booking.internalNote,
          photos: [],
        },
        booking.confirmedAt || booking.requestedAt,
      );
      if (booking.status === "completed") {
        order.stage = "done";
        order.quote.status = "confirmed";
        order.work.progress = 100;
        order.work.startedAt = booking.requestedAt;
        order.work.checklist = order.work.checklist.map((item) => ({
          ...item,
          done: true,
        }));
        order.acceptance.result = "passed";
        order.acceptance.checkedAt = booking.requestedAt;
        order.acceptance.checks = order.acceptance.checks.map((item) => ({
          ...item,
          passed: true,
        }));
        if (booking.id === "DP-0004") {
          const total = quoteTotals(
            order.quote.lines,
            order.quote.discount,
          ).total;
          order.finance = {
            deposit: 100000,
            collected: Math.max(0, total - 100000),
          };
        }
      }
      return order;
    });
}

export function quoteTotals(lines: QuoteLine[], discount: number) {
  const beforeDiscount = lines.reduce(
    (sum, line) => sum + line.quantity * line.price,
    0,
  );
  const lineDiscount = lines.reduce(
    (sum, line) => sum + (line.quantity * line.price * line.discount) / 100,
    0,
  );
  const afterLineDiscount = beforeDiscount - lineDiscount;
  const globalDiscount = (afterLineDiscount * discount) / 100;
  const vat = lines.reduce(
    (sum, line) =>
      sum +
      (line.quantity *
        line.price *
        (1 - line.discount / 100) *
        (1 - discount / 100) *
        line.vat) /
        100,
    0,
  );
  return {
    beforeDiscount,
    lineDiscount,
    globalDiscount,
    vat,
    total: afterLineDiscount - globalDiscount + vat,
  };
}

export const formatMoney = (value: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value) +
  " ₫";
