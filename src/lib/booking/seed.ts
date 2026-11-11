import { localDate, shiftDate } from "./logic";
import type {
  Advisor,
  BookingData,
  BookingStatus,
  CapacityConfig,
  Service,
} from "./types";

export const advisors: Advisor[] = [
  { id: "a1", name: "Minh Anh" },
  { id: "a2", name: "Quốc Bảo" },
  { id: "a3", name: "Hoàng Long" },
];
export const bookingServices: Service[] = [
  { id: "wash", name: "Rửa xe chuyên sâu", duration: 60 },
  { id: "interior", name: "Vệ sinh nội thất", duration: 120 },
  { id: "ceramic", name: "Phủ ceramic", duration: 240 },
  { id: "ppf", name: "Dán phim PPF", duration: 240 },
  { id: "tint", name: "Dán phim cách nhiệt", duration: 120 },
  { id: "accessories", name: "Lắp đặt phụ kiện", duration: 90 },
];
export const defaultCapacity: CapacityConfig = {
  open: "08:00",
  close: "18:00",
  closedDays: [0],
  holidays: "",
  slotMinutes: 30,
  carsPerSlot: 3,
  notifyNew: true,
  notifyUpcoming: true,
};
export function createSeed(today = localDate()): BookingData {
  const names = [
    "Nguyễn Văn An",
    "Trần Minh Khang",
    "Lê Hoàng Nam",
    "Phạm Thu Hà",
    "Đặng Ngọc Mai",
    "Võ Anh Tuấn",
    "Đỗ Thanh Tâm",
    "Bùi Minh Đức",
  ];
  const models = [
    "Toyota Vios",
    "Mazda CX-5",
    "Kia Seltos",
    "Honda City",
    "Hyundai Accent",
    "Ford Everest",
    "Toyota Cross",
    "VinFast VF 8",
  ];
  const customers = names.map((name, i) => ({
    id: `c${i + 1}`,
    name,
    phone: `09000000${String(i + 1).padStart(2, "0")}`,
  }));
  const vehicles = models.map((model, i) => ({
    id: `v${i + 1}`,
    customerId: `c${i + 1}`,
    model,
    plate: `59A-${String(12340 + i).slice(0, 3)}.${String(12340 + i).slice(3)}`,
    year: String(2021 + (i % 4)),
  }));
  vehicles.push({
    id: "v9",
    customerId: "c1",
    model: "Toyota Fortuner",
    plate: "59A-123.49",
    year: "2023",
  });
  const states: BookingStatus[] = [
    "pending",
    "confirmed",
    "arrived",
    "completed",
    "pending",
    "confirmed",
    "cancelled",
    "no_show",
    "completed",
    "pending",
    "confirmed",
    "pending",
    "confirmed",
    "pending",
    "confirmed",
    "completed",
    "pending",
    "confirmed",
  ];
  const offsets = [0, 0, 0, 0, 0, 0, -1, -1, -1, 1, 1, 1, 2, 2, 3, -2, 4, 4];
  const times = ["08:30", "09:00", "10:00", "11:00", "14:00", "15:30"];
  return {
    version: 1,
    customers,
    vehicles,
    capacity: { ...defaultCapacity },
    bookings: states.map((status, i) => {
      const date = shiftDate(today, offsets[i]),
        at = `${date}T${times[i % 6]}:00`,
        created = `${shiftDate(date, -1)}T09:00:00`;
      const events = [
        {
          id: `e${i}-0`,
          at: created,
          label: "Tạo lịch hẹn",
          detail: "Khách hàng đặt lịch",
        },
      ];
      if (status !== "pending")
        events.push({
          id: `e${i}-1`,
          at: `${shiftDate(date, -1)}T10:00:00`,
          label: status === "cancelled" ? "Hủy lịch" : "Xác nhận lịch",
          detail: "Cố vấn dịch vụ",
        });
      if (["arrived", "completed", "no_show"].includes(status))
        events.push({
          id: `e${i}-2`,
          at,
          label: status === "no_show" ? "Không đến" : "Tiếp nhận xe",
          detail: "Cố vấn dịch vụ",
        });
      if (status === "completed")
        events.push({
          id: `e${i}-3`,
          at: `${date}T17:00:00`,
          label: "Hoàn thành",
          detail: "Đã hoàn tất dịch vụ",
        });
      return {
        id: `DP-${String(i + 1).padStart(4, "0")}`,
        customerId: `c${(i % 8) + 1}`,
        vehicleId: `v${(i % 8) + 1}`,
        serviceIds: [bookingServices[i % 6].id],
        requestedAt: at,
        confirmedAt: status !== "pending" ? at : undefined,
        createdAt: created,
        status,
        source: (["Website", "Điện thoại", "Tại trạm", "Zalo", "QR"] as const)[
          i % 5
        ],
        advisorId: advisors[i % 3].id,
        customerNote:
          i % 3 === 0 ? "Khách cần tư vấn thêm trước khi thực hiện." : "",
        internalNote: i === 2 ? "Kiểm tra tình trạng xe khi tiếp nhận." : "",
        events,
      };
    }),
  };
}
