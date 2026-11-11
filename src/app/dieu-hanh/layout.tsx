import type { Metadata } from "next";
import { ManagerShell } from "@/components/manager/manager-shell";
import "@/styles/admin.css";
import "@/styles/manager.css";
import "@/styles/manager-coreui.css";
import "@/styles/manager-operations.css";

export const metadata: Metadata = {
  title: { absolute: "DPAuto | Điều hành cửa hàng" },
  robots: { index: false, follow: false },
};

export default function OperationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ManagerShell>{children}</ManagerShell>;
}
