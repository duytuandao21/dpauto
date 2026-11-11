import { AdvisorPrintPage } from "@/components/advisor/print-page";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdvisorPrintPage id={decodeURIComponent(id)} kind="quote" />;
}
