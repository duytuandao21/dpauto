import type { Metadata } from "next";
import { AboutContent } from "@/components/pages/about-content";
import { AboutBanner } from "@/components/pages/about-motion";
import { WorkFinalCTA as ReferenceFinalCTA } from "@/components/sections/our-work-motion";

export const metadata: Metadata = { title: "About HyperAuto Care" };
export default function AboutPage() {
  return (
    <div className="about-page">
      <AboutBanner />
      <AboutContent />
      <ReferenceFinalCTA />
    </div>
  );
}
