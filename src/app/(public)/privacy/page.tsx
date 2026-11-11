import type { Metadata } from "next";
import { legal } from "@/lib/content";
import { LegalContent } from "@/components/pages/legal-content";

export const metadata: Metadata = { title: "Privacy Policy" };
export default function PrivacyPage() {
  return (
    <section className="legal-page">
      <LegalContent blocks={legal.privacy} />
    </section>
  );
}
