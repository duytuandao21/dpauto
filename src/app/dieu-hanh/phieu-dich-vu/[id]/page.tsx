import { LiveVisitDetail } from "@/components/advisor/live-visits";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LiveVisitDetail manager id={id} />;
}
