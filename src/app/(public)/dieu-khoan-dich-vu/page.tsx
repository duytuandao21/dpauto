import type { Metadata } from "next";
import { legal } from "@/lib/content";
import { LegalContent } from "@/components/pages/legal-content";
import { publicPage, publicMetadata } from "@/lib/public-cms";
import { CmsPage, hasBody } from "@/components/sections/cms-page";
import { notFound } from "next/navigation";

export const generateMetadata = (): Promise<Metadata> =>
  publicMetadata("/terms", { title: "Điều khoản dịch vụ" });
export default async function TermsPage() {
  const content = await publicPage("terms");
  if (content?.withdrawn) notFound();
  return (
    <section className="legal-page">
      {hasBody(content?.payload) ? (
        <CmsPage content={content!.payload!} />
      ) : (
        <LegalContent blocks={legal.terms} />
      )}
    </section>
  );
}
