import type { Metadata } from "next";
import { banners, home } from "@/lib/content";
import {
  WorkBanner,
  WorkFinalCTA,
} from "@/components/sections/our-work-motion";
import { LocationSection } from "@/components/sections/location";
import { FAQ } from "@/components/sections/faq";

export const metadata: Metadata = { title: "Contact Us" };
export default function ContactPage() {
  return (
    <div className="contact-page">
      <WorkBanner title="Contact Us" image={banners.contact} />
      <LocationSection />
      <FAQ items={home.faq} />
      <WorkFinalCTA />
    </div>
  );
}
