import type { Metadata } from "next";
import { VehicleLookup } from "@/components/pages/vehicle-lookup";
import { publicMetadata } from "@/lib/public-cms";

export const generateMetadata = (): Promise<Metadata> =>
  publicMetadata("/tra-cuu", {
    title: "Tra cứu tiến độ xe",
    description:
      "Xem xe của anh/chị đang ở bước nào tại trạm dịch vụ: báo giá, thi công hay sẵn sàng bàn giao.",
  });

// Section styles come from the homepage theme (.home-page), like /phu-kien.
export default function VehicleLookupPage() {
  return (
    <div className="home-page lookup-page" lang="vi">
      <VehicleLookup />
    </div>
  );
}
