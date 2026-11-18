import type { Metadata } from "next";
import { AccessoriesCatalog } from "@/components/sections/accessories";
import { LocationSection } from "@/components/sections/location";
import { WorkFinalCTA as FinalCTA } from "@/components/sections/our-work-motion";
import { publicMetadata } from "@/lib/public-cms";

export const generateMetadata = (): Promise<Metadata> =>
  publicMetadata("/phu-kien", {
    title: "Phụ kiện ô tô",
    description:
      "Camera hành trình, màn hình Android, Android Box và cảm biến áp suất lốp đang có tại cửa hàng.",
  });
export default function AccessoriesPage() {
  // Reuses the homepage look: every accessories/section style is scoped to .home-page.
  return (
    <div className="home-page accessories-page" lang="vi">
      <AccessoriesCatalog />
      <LocationSection vietnamese />
      <FinalCTA vietnamese />
    </div>
  );
}
