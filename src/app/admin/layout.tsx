import type { Metadata } from "next";
// admin.css styles the shared sign-in screen shown by CmsShell before a session exists.
import "@/styles/admin.css";
import "@/styles/cms-admin.css";
import { CmsShell } from "@/components/manager/cms-shell";
import { CmsLayout } from "@/components/cms/shell";

export const metadata: Metadata = {
  title: { absolute: "DPAuto | Quản trị website" },
  robots: { index: false, follow: false },
};

export default function WebsiteAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CmsShell>
      <CmsLayout>{children}</CmsLayout>
    </CmsShell>
  );
}
