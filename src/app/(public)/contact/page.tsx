import type { Metadata } from "next";
import { banners } from "@/lib/content";
import { homeVi } from "@/lib/home-vi";
import {
  WorkBanner,
  WorkFinalCTA,
} from "@/components/sections/our-work-motion";
import { LocationSection } from "@/components/sections/location";
import { FAQ } from "@/components/sections/faq";
import { publicPage, publicMetadata } from "@/lib/public-cms";
import { CmsPage } from "@/components/sections/cms-page";
import { notFound } from "next/navigation";

export const generateMetadata = (): Promise<Metadata> =>
  publicMetadata("/contact", { title: "Liên hệ" });
export default async function ContactPage() {
  const content = await publicPage("contact");
  if (content?.withdrawn) notFound();
  return (
    <div className="contact-page">
      <WorkBanner title="Liên hệ" image={banners.contact} />
      <LocationSection />
      {content?.payload && <CmsPage content={content.payload} />}
      <FAQ items={homeVi.faq} />
      <WorkFinalCTA />
    </div>
  );
}
