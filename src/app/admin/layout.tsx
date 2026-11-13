import type { Metadata } from "next";
import { WorkspaceShell } from "@/components/internal/workspace-shell";
import "@/styles/admin.css";
import "@/styles/advisor.css";
import "@/styles/manager.css";
import "@/styles/manager-coreui.css";
import { CmsShell } from "@/components/manager/cms-shell";

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
      <WorkspaceShell className="mgr-app mgr-desktop-scale">
        {children}
      </WorkspaceShell>
    </CmsShell>
  );
}
