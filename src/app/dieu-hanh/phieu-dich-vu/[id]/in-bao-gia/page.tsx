import { WorkflowPrint } from "@/components/advisor/workflow-print";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <WorkflowPrint id={id} kind="quote" root="/dieu-hanh" />;
}
