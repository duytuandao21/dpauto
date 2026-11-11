import { ReceptionPage } from "@/components/advisor/reception-page";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReceptionPage id={decodeURIComponent(id)} />;
}
