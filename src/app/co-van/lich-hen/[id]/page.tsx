import { BookingsWorkspace } from "@/components/admin/bookings-workspace";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BookingsWorkspace id={id} />;
}
