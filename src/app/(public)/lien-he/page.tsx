import type { Metadata } from "next";
import { homeDefaults } from "@/lib/home-defaults";
import { section } from "@/lib/site-content";
import {
  WorkBanner,
  WorkFinalCTA,
} from "@/components/sections/our-work-motion";
import { LocationSection } from "@/components/sections/location";
import { FAQ } from "@/components/sections/faq";
import { publicFeed, publicPage, publicMetadata } from "@/lib/public-cms";
import { CmsPage, hasBody } from "@/components/sections/cms-page";
import { notFound } from "next/navigation";

export const generateMetadata = (): Promise<Metadata> =>
  publicMetadata("/contact", { title: "Liên hệ" });
export default async function ContactPage() {
  const content = await publicPage("contact");
  if (content?.withdrawn) notFound();
  const faq = section(await publicFeed(), "home.faq", homeDefaults["home.faq"]);
  return (
    <div className="contact-page">
      <WorkBanner pageKey="contact" />
      <LocationSection />
      {hasBody(content?.payload) && <CmsPage content={content!.payload!} />}
      {faq && (
        <FAQ
          items={(faq.items as { title?: string; text?: string }[]).map(
            (f) => ({ question: f.title || "", answer: f.text || "" }),
          )}
        />
      )}
      <WorkFinalCTA />
    </div>
  );
}
