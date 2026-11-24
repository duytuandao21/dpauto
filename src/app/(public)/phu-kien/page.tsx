import type { Metadata } from "next";
import { AccessoriesCatalog } from "@/components/sections/accessories";
import { LocationSection } from "@/components/sections/location";
import { WorkFinalCTA as FinalCTA } from "@/components/sections/our-work-motion";
import { FAQ } from "@/components/sections/faq";
import { publicFeed, publicMetadata } from "@/lib/public-cms";
import { pageDefaults } from "@/lib/page-defaults";
import { section } from "@/lib/site-content";

export const generateMetadata = (): Promise<Metadata> =>
  publicMetadata("/phu-kien", {
    title: "Phụ kiện ô tô",
    description:
      "Camera hành trình, màn hình Android, Android Box và cảm biến áp suất lốp đang có tại cửa hàng.",
  });
export default async function AccessoriesPage() {
  // FAQ questions are edited together with the page heading (PAGE "phu-kien").
  const page = section(await publicFeed(), "phu-kien", pageDefaults["phu-kien"]);
  const items = ((page?.items || []) as { title?: string; text?: string }[])
    .filter((f) => f.title && f.text)
    .map((f) => ({ question: f.title!, answer: f.text! }));
  // Reuses the homepage look: every accessories/section style is scoped to .home-page.
  return (
    <div className="home-page accessories-page" lang="vi">
      <AccessoriesCatalog />
      {items.length > 0 && (
        <FAQ items={items} description="" />
      )}
      <LocationSection vietnamese />
      <FinalCTA vietnamese />
    </div>
  );
}
