import { redirect } from "next/navigation";

// Booking slots moved under "Thiết lập" (GĐ3); keep old links (and ?date=) working.
export default async function SlotsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  redirect(
    "/dieu-hanh/cau-hinh?tab=khung-gio" +
      (date ? "&date=" + encodeURIComponent(date) : ""),
  );
}
