import { Suspense } from "react";
import { SettingsPage } from "@/components/cms/pages/settings";

export default function Page() {
  return (
    <Suspense>
      <SettingsPage />
    </Suspense>
  );
}
