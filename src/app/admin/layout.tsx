import type { Metadata } from "next";
import { WorkspaceShell } from "@/components/internal/workspace-shell";
import "@/styles/admin.css";

export const metadata: Metadata = {
  title: { absolute: "DPAuto | Quản trị website" },
  robots: { index: false, follow: false },
};

export default function WebsiteAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <WorkspaceShell>{children}</WorkspaceShell>;
}
