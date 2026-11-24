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
      kind="page"
      sectionKey={key}
      back={{ href: "/admin/trang", label: "Các trang" }}
    />
  );
}
