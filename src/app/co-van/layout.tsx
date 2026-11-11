import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminLoading } from "@/components/admin/primitives";
import "@/styles/admin.css";
import "@/styles/advisor.css";
import "@/styles/advisor-coreui.css";

export const metadata: Metadata = {
  title: { absolute: "DPAuto | Cố vấn dịch vụ" },
  robots: { index: false, follow: false },
};
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminShell>
      <Suspense fallback={<AdminLoading />}>{children}</Suspense>
    </AdminShell>
  );
}
