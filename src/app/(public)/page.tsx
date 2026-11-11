import type { Metadata } from "next";
import { homeVi } from "@/lib/home-vi";
import { Hero } from "@/components/sections/hero";
import { ServicesSection } from "@/components/sections/services";
import { AccessoriesSection } from "@/components/sections/accessories";
import {
  ProcessSection,
  PricingSection,
} from "@/components/sections/process-pricing";
import { WorkSection, SocialGallery } from "@/components/sections/work-gallery";
import { BenefitsSection } from "@/components/sections/benefits-section";
import { BrandsSection } from "@/components/sections/brands";
import { ReviewsSection } from "@/components/sections/reviews";
import { NewsSection } from "@/components/sections/news";
import { FAQ } from "@/components/sections/faq";
import { LocationSection } from "@/components/sections/location";
import { WorkFinalCTA as FinalCTA } from "@/components/sections/our-work-motion";

export const metadata: Metadata = {
  title: "Chăm sóc ô tô chuyên nghiệp",
  description:
    "Dịch vụ chăm sóc ô tô, vệ sinh nội thất, hiệu chỉnh sơn, phủ ceramic và dán phim bảo vệ tại HyperAuto Care.",
};

export default function HomePage() {
  return (
    <div className="home-page" lang="vi">
      <Hero />
      <ServicesSection />
      <AccessoriesSection />
      <ProcessSection />
      <PricingSection />
      <WorkSection />
      <SocialGallery />
      <BenefitsSection />
      <ReviewsSection />
      <BrandsSection />
      <NewsSection
        title="Tin mới từ HyperAuto Care"
        vietnamese
        originalImages
      />
      <FAQ
        items={homeVi.faq}
        title="Câu hỏi thường gặp"
        description="Giải đáp về lịch hẹn, thời gian thực hiện và chi phí dịch vụ."
      />
      <LocationSection vietnamese />
      <FinalCTA vietnamese />
    </div>
  );
}
