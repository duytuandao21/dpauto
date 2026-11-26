import type { Metadata } from "next";
import { ManagerShell } from "@/components/manager/manager-shell";
import "@/styles/admin.css";
import "@/styles/advisor.css";
import "@/styles/advisor-coreui.css";
import "@/styles/manager.css";
import "@/styles/manager-coreui.css";
import "@/styles/manager-operations.css";
// The manager shell is .adm-app.adv-ui like /co-van; .mgr-app keeps page-level rules until GĐ2.
import "@/styles/advisor-redesign.css";

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
