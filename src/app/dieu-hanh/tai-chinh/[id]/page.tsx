import { CashReceipt } from "@/components/manager/cash-receipt";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CashReceipt key={id} id={id} />;
}
