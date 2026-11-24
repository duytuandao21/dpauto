import { Suspense } from "react";
import { MediaLibraryPage } from "@/components/cms/media";

export default function Page() {
  return (
    <Suspense>
      <MediaLibraryPage />
    </Suspense>
  );
}
