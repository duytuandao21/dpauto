import type { Metadata } from "next";
import { legal } from "@/lib/content";
import { LegalContent } from "@/components/pages/legal-content";
import { publicPage, publicMetadata } from "@/lib/public-cms";
import { CmsPage } from "@/components/sections/cms-page";
import { notFound } from "next/navigation";

export const generateMetadata = (): Promise<Metadata> =>
  publicMetadata("/privacy", { title: "Privacy Policy" });
export default async function PrivacyPage() {
  const content = await publicPage("privacy");
  if (content?.withdrawn) notFound();
  return (
    <section className="legal-page">
      {content?.payload ? (
        <CmsPage content={content.payload} />
      ) : (
        <LegalContent blocks={legal.privacy} />
      )}
    </section>
  );
}
