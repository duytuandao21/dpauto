import type { BookingStatus } from "@/lib/booking/types";
import type { AdminIconName } from "@/components/admin/admin-icon";
import type { OperationsData } from "./operations";
import { createOperationsSeed } from "./operations-seed";

export type ManagerBooking = {
  id: string;
  customerId: string;
  serviceIds: string[];
  advisorId: string;
  date: string;
  time: string;
  status: BookingStatus;
  note: string;
  changeKind?: "new" | "rescheduled" | "cancelled";
  holds?: { slotId: string; minutes: number }[];
};
export type ManagerCustomer = {
  id: string;
  name: string;
  phone: string;
  model: string;
  plate: string;
};
export type ManagerService = {
  id: string;
  name: string;
  group: string;
  duration: number;
  active: boolean;
};
export type ManagerStaff = {
  id: string;
  name: string;
  role: "manager" | "advisor" | "technician";
  phone: string;
  email: string;
  active: boolean;
};
export type CapacitySlot = {
  id: string;
  time: string;
  group: string;
  resource: string;
  unit: string;
  total: number;
  reserved: number;
  state: "available" | "limited" | "full";
  date: string;
  locked?: boolean;
  reason?: string;
};
export type ContentItem = {
  id: string;
  kind: "content" | "news" | "media" | "seo";
  title: string;
  description: string;
  body: string;
  published: boolean;
  image?: string;
};
export type ManagerEvent = {
  id: string;
  time: string;
  actor: string;
  action: string;
  target: string;
};
export type ManagerSettings = {
  name: string;
  phone: string;
  address: string;
  open: string;
  close: string;
  leadMinutes: number;
  advanceDays: number;
  notifyNew: boolean;
  notifyUpcoming: boolean;
};
export type ManagerData = OperationsData & {
  bookings: ManagerBooking[];
  customers: ManagerCustomer[];
  services: ManagerService[];
  staff: ManagerStaff[];
  capacity: CapacitySlot[];
  content: ContentItem[];
  events: ManagerEvent[];
  settings: ManagerSettings;
};

export const serviceGroups = [
  "Tất cả nhóm",
  "Bảo dưỡng",
  "Chăm sóc xe",
  "Phụ kiện",
];
export const managerNavigation: {
  title: string;
  items: { path: string; label: string; icon: AdminIconName }[];
}[] = [
  {
    title: "Tổng quan",
    items: [
      { path: "", label: "Dashboard", icon: "overview" },
      { path: "/lich-hen", label: "Quản lý lịch hẹn", icon: "calendar" },
      { path: "/bao-cao", label: "Báo cáo & thống kê", icon: "overview" },
      { path: "/canh-bao", label: "Cảnh báo điều hành", icon: "bell" },
    ],
  },
  {
    title: "Vận hành garage",
    items: [
      { path: "/dieu-phoi", label: "Điều phối xe", icon: "car" },
      { path: "/phieu-dich-vu", label: "Phiếu dịch vụ", icon: "tool" },
      { path: "/bao-gia", label: "Giám sát báo giá", icon: "website" },
      { path: "/nang-luc", label: "Khung giờ & năng lực", icon: "time" },
      { path: "/dich-vu", label: "Danh mục dịch vụ", icon: "tool" },
      { path: "/nhan-su", label: "Nhân sự & ca làm", icon: "customers" },
      { path: "/khach-hang", label: "Khách hàng & phương tiện", icon: "car" },
    ],
  },
  {
    title: "Nguồn lực & tài chính",
    items: [
      { path: "/kho", label: "Kho & phụ tùng", icon: "tool" },
      { path: "/tai-chinh", label: "Tài chính & công nợ", icon: "overview" },
    ],
  },
  {
    title: "Quản trị website",
    items: [
      { path: "/website/noi-dung", label: "Nội dung website", icon: "website" },
      {
        path: "/website/bai-viet",
        label: "Tin tức & bài viết",
        icon: "website",
      },
      { path: "/website/hinh-anh", label: "Thư viện hình ảnh", icon: "car" },
      { path: "/website/seo", label: "SEO & hiển thị", icon: "search" },
    ],
  },
  {
    title: "Hệ thống",
    items: [
      { path: "/thong-bao", label: "Thông báo & Zalo OA", icon: "bell" },
      { path: "/cau-hinh", label: "Cấu hình hệ thống", icon: "settings" },
      { path: "/nhat-ky", label: "Nhật ký hoạt động", icon: "time" },
    ],
  },
];

export function createManagerData(
  today: string,
  shift: (date: string, amount: number) => string,
): ManagerData {
  const services: ManagerService[] = [
    {
      id: "m1",
      name: "Bảo dưỡng định kỳ",
      group: "Bảo dưỡng",
      duration: 120,
      active: true,
    },
    {
      id: "m2",
      name: "Thay dầu động cơ",
      group: "Bảo dưỡng",
      duration: 45,
      active: true,
    },
    {
      id: "m3",
      name: "Vệ sinh nội thất",
      group: "Chăm sóc xe",
      duration: 120,
      active: true,
    },
    {
      id: "m4",
      name: "Phủ ceramic",
      group: "Chăm sóc xe",
      duration: 240,
      active: true,
    },
    {
      id: "m5",
      name: "Dán phim cách nhiệt",
      group: "Chăm sóc xe",
      duration: 150,
      active: true,
    },
    {
      id: "m6",
      name: "Lắp camera hành trình",
      group: "Phụ kiện",
      duration: 90,
      active: true,
    },
    {
      id: "m7",
      name: "Kiểm tra điều hòa",
      group: "Bảo dưỡng",
      duration: 60,
      active: false,
    },
  ];
  const names = [
    "Nguyễn An",
    "Trần Minh",
    "Lê Nam",
    "Phạm Hà",
    "Đặng Mai",
    "Võ Tuấn",
    "Đỗ Tâm",
    "Bùi Đức",
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
    id: `MC-${i + 1}`,
    name,
    phone: `09000000${String(i + 1).padStart(2, "0")}`,
    model: models[i],
    plate: `51G-${String(12345 + i * 137).slice(0, 3)}.${String(12345 + i * 137).slice(3)}`,
  }));
  const staff: ManagerStaff[] = [
    {
      id: "MS-5",
      name: "Tuấn Kỹ thuật",
      role: "technician",
      phone: "0900000014",
      email: "tuan@example.com",
      active: true,
    },
    {
      id: "MS-6",
      name: "Hải Kỹ thuật",
      role: "technician",
      phone: "0900000015",
      email: "hai@example.com",
      active: true,
    },
    {
      id: "MS-1",
      name: "Quản lý",
      role: "manager",
      phone: "0900000010",
      email: "quanly@example.com",
      active: true,
    },
    {
      id: "MS-2",
      name: "Minh Anh",
      role: "advisor",
      phone: "0900000011",
      email: "minhanh@example.com",
      active: true,
    },
    {
      id: "MS-3",
      name: "Quốc Bảo",
      role: "advisor",
      phone: "0900000012",
      email: "quocbao@example.com",
      active: true,
    },
    {
      id: "MS-4",
      name: "Hoàng Long",
      role: "advisor",
      phone: "0900000013",
      email: "hoanglong@example.com",
      active: false,
    },
  ];
  const states: BookingStatus[] = [
    "pending",
    "confirmed",
    "arrived",
    "pending",
    "completed",
    "confirmed",
    "pending",
    "cancelled",
    "confirmed",
    "completed",
    "pending",
    "confirmed",
  ];
  const times = [
    "07:30",
    "08:00",
    "08:30",
    "09:00",
    "09:30",
    "10:00",
    "10:30",
    "13:00",
    "13:30",
    "14:00",
    "15:00",
    "16:00",
  ];
  const bookings = Array.from({ length: 84 }, (_, i) => ({
    id: `TT-${String(i + 1).padStart(4, "0")}`,
    customerId: customers[i % customers.length].id,
    serviceIds: [services[i % 6].id],
    advisorId: i % 5 === 0 ? "" : `MS-${2 + (i % 2)}`,
    date: shift(today, i < 12 ? 0 : i < 24 ? 1 : -1 - Math.floor((i - 24) / 3)),
    time: times[i % times.length],
    status: states[i % states.length],
    note: i % 3 === 0 ? "Khách cần tư vấn trước khi thực hiện." : "",
  }));
  // Resource/time units are fixtures, not a capacity allocation algorithm.
  const capacity: CapacitySlot[] = [
    {
      id: "CP-1",
      date: today,
      time: "07:30 – 09:00",
      group: "Bảo dưỡng",
      resource: "Khoang bảo dưỡng",
      unit: "phút nguồn lực",
      total: 180,
      reserved: 90,
      state: "available",
    },
    {
      id: "CP-2",
      date: today,
      time: "09:00 – 10:30",
      group: "Bảo dưỡng",
      resource: "Khoang bảo dưỡng",
      unit: "phút nguồn lực",
      total: 180,
      reserved: 180,
      state: "full",
    },
    {
      id: "CP-3",
      date: today,
      time: "10:30 – 12:00",
      group: "Chăm sóc xe",
      resource: "Khu chăm sóc",
      unit: "phút nguồn lực",
      total: 240,
      reserved: 210,
      state: "limited",
    },
    {
      id: "CP-4",
      date: today,
      time: "13:00 – 14:30",
      group: "Chăm sóc xe",
      resource: "Khu chăm sóc",
      unit: "phút nguồn lực",
      total: 240,
      reserved: 120,
      state: "available",
    },
    {
      id: "CP-5",
      date: today,
      time: "14:30 – 16:00",
      group: "Phụ kiện",
      resource: "Kỹ thuật viên phụ kiện",
      unit: "phút nguồn lực",
      total: 90,
      reserved: 75,
      state: "limited",
    },
    {
      id: "CP-6",
      date: today,
      time: "16:00 – 17:30",
      group: "Bảo dưỡng",
      resource: "Khoang bảo dưỡng",
      unit: "phút nguồn lực",
      total: 180,
      reserved: 60,
      state: "available",
    },
  ];
  const content: ContentItem[] = [
    {
      id: "CT-1",
      kind: "content",
      title: "Hero trang chủ",
      description: "Chăm sóc ô tô chuyên nghiệp",
      body: "Giữ xe sạch đẹp, sáng bóng và bền lâu cùng DPAuto.",
      published: true,
      image: "/images/hero-dpauto-1.png",
    },
    {
      id: "CT-2",
      kind: "content",
      title: "Giới thiệu trạm dịch vụ",
      description: "Trạm dịch vụ Toàn Trung",
      body: "Đội ngũ tận tâm, quy trình rõ ràng và dịch vụ chăm sóc phù hợp cho chiếc xe của bạn.",
      published: true,
      image: "/images/garage-team.jpg",
    },
    {
      id: "CT-3",
      kind: "news",
      title: "Khi nào nên bảo dưỡng ô tô?",
      description: "Kiến thức chăm sóc xe",
      body: "Kiểm tra theo hướng dẫn của nhà sản xuất và điều kiện sử dụng xe.",
      published: true,
      image: "/images/garage-team.jpg",
    },
    {
      id: "CT-4",
      kind: "news",
      title: "Chăm sóc nội thất đúng cách",
      description: "Kinh nghiệm sử dụng",
      body: "Vệ sinh và bảo dưỡng nội thất định kỳ giúp xe luôn sạch sẽ, thoải mái.",
      published: false,
      image: "/images/hero-dpauto-1.png",
    },
    {
      id: "CT-5",
      kind: "media",
      title: "Đội ngũ Toàn Trung",
      description: "Ảnh đội ngũ tại garage",
      body: "Hình ảnh tại trạm dịch vụ Toàn Trung.",
      published: true,
      image: "/images/garage-team.jpg",
    },
    {
      id: "CT-6",
      kind: "media",
      title: "Không gian dịch vụ",
      description: "Ảnh hero DPAuto",
      body: "Hình ảnh tại trạm dịch vụ Toàn Trung.",
      published: true,
      image: "/images/hero-dpauto-1.png",
    },
    {
      id: "CT-7",
      kind: "seo",
      title: "Trang chủ DPAuto",
      description: "Chăm sóc ô tô chuyên nghiệp | DPAuto",
      body: "Trạm dịch vụ Toàn Trung: bảo dưỡng, chăm sóc và lắp đặt phụ kiện ô tô.",
      published: true,
    },
    {
      id: "CT-8",
      kind: "seo",
      title: "Trang dịch vụ",
      description: "Dịch vụ chăm sóc ô tô | DPAuto",
      body: "Khám phá các dịch vụ chăm sóc và bảo vệ xe tại DPAuto.",
      published: false,
    },
  ];
  const operations = createOperationsSeed(today, bookings, services);
  const capacityDays = [today, shift(today, 1)].flatMap((date) =>
    capacity.flatMap((slot, i) =>
      serviceGroups
        .slice(1)
        .map((group, j) => ({
          ...slot,
          id: `CP-${date}-${i}-${j}`,
          date,
          group,
          resource:
            group === "Bảo dưỡng"
              ? "Khoang bảo dưỡng"
              : group === "Chăm sóc xe"
                ? "Khu chăm sóc"
                : "Kỹ thuật phụ kiện",
          total: group === "Phụ kiện" ? 180 : 240,
          reserved: 0,
          state: "available" as const,
        })),
    ),
  );
  const reservedBookings = bookings.map((b) => {
    const order = operations.orders.find((o) => o.bookingId === b.id);
    const status = order
      ? order.stage === "done"
        ? ("completed" as const)
        : ("arrived" as const)
      : b.status;
    const holds = ["pending", "confirmed", "arrived"].includes(status)
      ? services
          .filter((s) => b.serviceIds.includes(s.id))
          .flatMap((s) => {
            const slot = capacityDays.find(
              (c) =>
                c.date === b.date &&
                c.group === s.group &&
                b.time >= c.time.slice(0, 5) &&
                b.time < c.time.slice(-5),
            );
            if (!slot) return [];
            slot.reserved += s.duration;
            return [{ slotId: slot.id, minutes: s.duration }];
          })
      : [];
    return { ...b, status, holds };
  });
  return {
    ...operations,
    bookings: reservedBookings,
    customers,
    staff,
    services,
    capacity: capacityDays.map((s) => ({
      ...s,
      state:
        s.reserved >= s.total
          ? "full"
          : s.reserved >= s.total * 0.8
            ? "limited"
            : "available",
    })),
    content,
    settings: {
      name: "Trạm dịch vụ Toàn Trung",
      phone: "0772 584 279",
      address: "787–789 Quốc lộ 13, Hiệp Bình, TP. Hồ Chí Minh",
      open: "07:30",
      close: "17:30",
      leadMinutes: 60,
      advanceDays: 30,
      notifyNew: true,
      notifyUpcoming: true,
    },
    events: [
      {
        id: "EV-1",
        time: "09:12",
        actor: "Quản lý",
        action: "Phân công lịch hẹn",
        target: "TT-0001 → Minh Anh",
      },
      {
        id: "EV-2",
        time: "08:45",
        actor: "Minh Anh",
        action: "Tiếp nhận xe",
        target: "TT-0003",
      },
      {
        id: "EV-3",
        time: "08:30",
        actor: "Quản lý",
        action: "Cập nhật cấu hình",
        target: "Giờ làm việc",
      },
    ],
  };
}
