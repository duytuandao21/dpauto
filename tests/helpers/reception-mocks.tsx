import React from "react";

declare global {
  interface Window {
    receptionTest: {
      calls: { path: string; body: any }[];
      destination: string;
      fail: boolean;
    };
  }
}
window.receptionTest = { calls: [], destination: "", fail: false };
const params = new URLSearchParams(location.search);
const bookingId = params.get("mode") === "walk-in" ? undefined : "booking";
const vehicle = {
  id: "vehicle",
  model: "Honda Jazz",
  plate: "81A-123.45",
  customerContacts: [{ customerId: "customer" }],
};
export const apiEnabled = true;
export const newRequestKey = () => crypto.randomUUID();
export class ApiFailure extends Error {
  code = "";
}
export const useSession = () => ({
  staff: { id: "advisor", name: "Cố vấn Toàn Trung" },
  roles: ["ADVISOR"],
  permissions: ["visits.receive", "visits.create"],
});
export const useSearchParams = () => params;
export const useRouter = () => ({
  push: (path: string) => {
    window.receptionTest.destination = path;
  },
});
export default function Link({
  children,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props}>{children}</a>;
}
const service = {
  id: "service",
  name: "Rửa xe và chăm sóc ngoại thất, vệ sinh nội thất",
  active: true,
  bookable: true,
};
export async function request<T>(path: string): Promise<any> {
  return {
    data: path.startsWith("admin/services")
      ? [
          service,
          { id: "extra", name: "Phủ ceramic", active: true, bookable: true },
        ]
      : path.startsWith("admin/bookings/")
        ? {
            id: bookingId,
            code: "DP-DV15112026-004",
            customerId: "customer",
            version: 3,
            status: "CONFIRMED",
            customer: { name: "Nguyễn Văn Thanh", phone: "0901234567" },
            vehicle: params.get("mode") === "new-car" ? null : vehicle,
            assignedAdvisor: { id: "advisor", name: "Cố vấn Toàn Trung" },
            services: [service],
            confirmedStartAt: "2026-11-15T06:30:00+07:00",
            scheduledStartAt: "2026-11-15T06:30:00+07:00",
            customerNote: "Kiểm tra điều hòa và vệ sinh xe",
          }
        : [],
    meta: {
      catalogVersion: 1,
      policyVersion: 1,
      privacyNoticeVersion: "BOOKING_V1",
    },
  };
}
export async function collection<T>(path: string): Promise<any[]> {
  if (path.startsWith("admin/vehicles"))
    return params.get("mode") === "new-car" ? [] : [vehicle];
  if (path.startsWith("admin/customers"))
    return [{ id: "customer", name: "Nguyễn Văn Thanh", phone: "0901234567" }];
  return [];
}
export async function command<T>(path: string, body: any): Promise<any> {
  window.receptionTest.calls.push({ path, body });
  await new Promise((resolve) => setTimeout(resolve, 150));
  if (window.receptionTest.fail)
    throw new Error("Không thể lưu tiếp nhận. Vui lòng thử lại.");
  return { data: { visitId: "received-visit" } };
}
