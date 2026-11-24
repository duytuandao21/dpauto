import { ServiceEditor } from "@/components/cms/pages/content";

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ServiceEditor key={slug} slug={slug === "moi" ? null : slug} />;
}
