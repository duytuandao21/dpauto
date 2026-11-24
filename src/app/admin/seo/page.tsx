import { Suspense } from "react";
import { SeoPage } from "@/components/cms/pages/seo";

export default function Page() {
  return (
    <Suspense>
      <SeoPage />
    </Suspense>
  );
}
