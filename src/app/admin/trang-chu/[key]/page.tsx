import { SectionEditor } from "@/components/cms/pages/sections";

export default async function Page({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  return (
    <SectionEditor
      key={key}
      kind="home"
      sectionKey={`home.${key}`}
      back={{ href: "/admin/trang-chu", label: "Trang chủ" }}
    />
  );
}
