import { redirect } from "next/navigation";
import { OverviewPage } from "@/components/cms/pages/overview";

// Old tab links (/admin?tab=…, also used by /dieu-hanh/website redirects) map to the new sections.
const legacyTabs: Record<string, string> = {
  content: "/admin/trang",
  news: "/admin/tin-tuc",
  media: "/admin/thu-vien-anh",
  seo: "/admin/seo",
};

export default async function WebsiteAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  if (tab && legacyTabs[tab]) redirect(legacyTabs[tab]);
  return <OverviewPage />;
}
