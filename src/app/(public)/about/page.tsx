import type { Metadata } from "next";
import { AboutContent } from "@/components/pages/about-content";
import { AboutBanner } from "@/components/pages/about-motion";
import { WorkFinalCTA as ReferenceFinalCTA } from "@/components/sections/our-work-motion";
import { publicPage, publicMetadata } from "@/lib/public-cms";
import { CmsPage } from "@/components/sections/cms-page";
import { notFound } from "next/navigation";

export const generateMetadata = (): Promise<Metadata> =>
  publicMetadata("/about", { title: "About HyperAuto Care" });
export default async function AboutPage() {
  const content = await publicPage("about");
  if (content?.withdrawn) notFound();
  return (
    <div className="about-page">
      <AboutBanner />
      {content?.payload ? (
        <CmsPage content={content.payload} />
      ) : (
        <AboutContent />
      )}
      <ReferenceFinalCTA />
    </div>
  );
}
