import { LiveReception } from "@/components/advisor/live-reception";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LiveReception manager id={id} />;
}
