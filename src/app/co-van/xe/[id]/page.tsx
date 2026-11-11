import { VehicleProfile } from "@/components/advisor/vehicle-profile";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <VehicleProfile id={decodeURIComponent(id)} />;
}
