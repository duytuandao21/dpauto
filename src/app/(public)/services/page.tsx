import type { Metadata } from "next";
import { ServicesBanner, ServicesList } from "@/components/sections/services";
import { WorkFinalCTA } from "@/components/sections/our-work-motion";
import { publicMetadata } from "@/lib/public-cms";

export const generateMetadata = (): Promise<Metadata> =>
  publicMetadata("/services", { title: "Dịch vụ" });
export default function ServicesPage() {
  return (
    <div className="services-page">
      <ServicesBanner />
      <ServicesList />
      <WorkFinalCTA />
    </div>
  );
}
