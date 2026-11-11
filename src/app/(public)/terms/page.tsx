import type { Metadata } from "next";
import { legal } from "@/lib/content";
import { LegalContent } from "@/components/pages/legal-content";

export const metadata: Metadata = { title: "Terms of Service" };
export default function TermsPage() {
  return (
    <section className="legal-page">
      <LegalContent blocks={legal.terms} />
    </section>
  );
}
