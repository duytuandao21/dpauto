import type { Metadata } from "next";
import { ServicesBanner, ServicesList } from "@/components/sections/services";
import { WorkFinalCTA } from "@/components/sections/our-work-motion";
import { publicMetadata } from "@/lib/public-cms";

// SEO settings saved in the admin stay keyed by the old path "/services".
export const generateMetadata = async (): Promise<Metadata> => ({
  ...(await publicMetadata("/services", { title: "Dịch vụ" })),
  alternates: { canonical: "/dich-vu" },
});
export default function ServicesPage() {
  return (
    <div className="services-page">
      <ServicesBanner />
      <ServicesList />
      <WorkFinalCTA />
    </div>
  );
}
