import type { Metadata } from "next";
import { ServicesBanner, ServicesList } from "@/components/sections/services";
import { WorkFinalCTA } from "@/components/sections/our-work-motion";

export const metadata: Metadata = { title: "Our Services" };
export default function ServicesPage() {
  return (
    <div className="services-page">
      <ServicesBanner />
      <ServicesList />
      <WorkFinalCTA />
    </div>
  );
}
