import { ProjectEditor } from "@/components/cms/pages/content";

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ProjectEditor key={slug} slug={slug === "moi" ? null : slug} />;
}
