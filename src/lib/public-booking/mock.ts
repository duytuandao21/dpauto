import type { IconName } from "@/components/ui/icon";

// Frontend fixtures only. These values do not describe the station's real capacity.
// Replace this adapter with the availability API; do not allocate capacity here.
export type SlotStatus = "available" | "limited" | "full" | "unavailable";
export type DemoScenario = "normal" | "full" | "closed" | "error";
export type BookingService = {
  id: string;
  name: string;
  description: string;
  durationLabel: string;
  icon: IconName;
  disabled?: boolean;
};
export type TimeSlot = {
  id: string;
  time: string;
  period: "morning" | "afternoon";
  status: SlotStatus;
};
export type Availability = {
  date: string;
  serviceIds: string[];
  scenario: DemoScenario;
  slots: TimeSlot[];
};
export type CustomerFields = {
  name: string;
  phone: string;
  plate: string;
  vehicle: string;
};
export type CustomerErrors = Partial<Record<keyof CustomerFields, string>>;

export const bookingServices: BookingService[] = [
  {
    id: "maintenance",
    name: "Bảo dưỡng định kỳ",
    description: "Chăm sóc xe theo mốc bảo dưỡng",
    durationLabel: "Khoảng 90–120 phút",
    icon: "shield",
  },
  {
    id: "oil",
    name: "Thay dầu / Lọc dầu",
    description: "Chăm sóc động cơ, vận hành êm ái",
    durationLabel: "Khoảng 30–60 phút",
    icon: "box",
  },
  {
    id: "repair",
    name: "Kiểm tra, sửa chữa",
    description: "Kiểm tra tình trạng và tư vấn xử lý",
    durationLabel: "Tùy tình trạng xe",
    icon: "tool",
  },
  {
    id: "chassis",
    name: "Lốp / Phanh / Gầm",
    description: "An tâm trên mọi hành trình",
    durationLabel: "Khoảng 60–120 phút",
    icon: "award",
  },
  {
    id: "electrical",
    name: "Điện / Điều hòa",
    description: "Kiểm tra hệ thống điện, làm mát",
    durationLabel: "Khoảng 60–90 phút",
    icon: "door",
  },
  {
    id: "detailing",
    name: "Chăm sóc, làm đẹp xe",
    description: "Vệ sinh, bảo vệ và làm mới xe",
    durationLabel: "Tùy gói dịch vụ",
    icon: "sparkles",
  },
  {
    id: "consultation",
    name: "Khác / Cần tư vấn",
    description: "Để DPAuto hỗ trợ bạn lựa chọn",
    durationLabel: "Trao đổi khi xác nhận",
    icon: "phone",
  },
];

export const slotLabels: Record<SlotStatus, string> = {
  available: "Còn chỗ",
  limited: "Sắp đầy",
  full: "Hết chỗ",
  unavailable: "Không phục vụ",
};

export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function parseDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}
export function addDays(value: string, amount: number): string {
  const date = parseDate(value);
  date.setDate(date.getDate() + amount);
  return dateKey(date);
}
export function stationToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function displayDate(value: string, weekday = false): string {
  return new Intl.DateTimeFormat("vi-VN", {
    ...(weekday ? { weekday: "long" as const } : {}),
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parseDate(value));
}
export function dayStatus(
  value: string,
  today: string,
): "available" | "limited" | "full" | "closed" {
  const offset = Math.round(
    (parseDate(value).getTime() - parseDate(today).getTime()) / 86400000,
  );
  if (offset % 14 === 5) return "closed";
  if (offset % 14 === 3) return "full";
  if (offset % 7 === 2) return "limited";
  return "available";
}
export function validateCustomer(customer: CustomerFields): CustomerErrors {
  const errors: CustomerErrors = {};
  if (!customer.name.trim()) errors.name = "Bạn vui lòng nhập họ và tên.";
  else if (customer.name.trim().length < 2)
    errors.name = "Họ và tên cần ít nhất 2 ký tự.";
  const phone = customer.phone.replace(/[\s().-]/g, "");
  if (!phone) errors.phone = "Bạn vui lòng nhập số điện thoại.";
  else if (!/^(?:0|\+84|84)(?:3|5|7|8|9)\d{8}$/.test(phone))
    errors.phone = "Nhập số di động Việt Nam hợp lệ (10 số hoặc +84).";
  return errors;
}

const fixtureTimes = [
  "07:30",
  "08:30",
  "09:30",
  "10:30",
  "11:30",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
];
const generalStatuses: SlotStatus[] = [
  "available",
  "limited",
  "full",
  "available",
  "unavailable",
  "available",
  "limited",
  "full",
  "available",
  "unavailable",
];
const detailingStatuses: SlotStatus[] = [
  "limited",
  "full",
  "available",
  "available",
  "unavailable",
  "full",
  "available",
  "limited",
  "available",
  "unavailable",
];

export async function loadMockAvailability({
  date,
  serviceIds,
  scenario,
  signal,
}: {
  date: string;
  serviceIds: string[];
  scenario: DemoScenario;
  signal: AbortSignal;
}): Promise<Availability> {
  await new Promise<void>((resolve, reject) => {
    if (signal.aborted)
      return reject(new DOMException("Aborted", "AbortError"));
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, 450);
    signal.addEventListener("abort", abort, { once: true });
  });
  if (scenario === "error") throw new Error("MOCK_AVAILABILITY_ERROR");
  // Named fixtures model different service contexts; no real capacity calculation.
  const statuses = serviceIds.includes("detailing")
    ? detailingStatuses
    : generalStatuses;
  const stationTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
  return {
    date,
    serviceIds: [...serviceIds],
    scenario,
    slots: fixtureTimes.map((time, index) => ({
      id: time,
      time,
      period: index < 5 ? "morning" : "afternoon",
      status:
        scenario === "closed" ||
        (date === stationToday() && time <= stationTime)
          ? "unavailable"
          : scenario === "full"
            ? "full"
            : statuses[index],
    })),
  };
}
