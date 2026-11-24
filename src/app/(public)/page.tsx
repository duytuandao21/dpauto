import type { Metadata } from "next";
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
import { homeDefaults } from "@/lib/home-defaults";
import { section as merged } from "@/lib/site-content";
import {
  publicFeed,
  publicContent,
  publicArticles,
  publicMetadata,
} from "@/lib/public-cms";

const fallbackMetadata: Metadata = {
  title: "Chăm sóc ô tô chuyên nghiệp",
  description:
    "Dịch vụ chăm sóc ô tô, vệ sinh nội thất, hiệu chỉnh sơn, phủ ceramic và dán phim bảo vệ tại DPAuto.",
};

export const generateMetadata = () => publicMetadata("/", fallbackMetadata);
export default async function HomePage() {
  const documents = await publicContent(),
    news = await publicArticles(true);
  const section = (key: string) =>
    documents.find((d) => d.kind === "PAGE" && d.key === key);
  const feed = await publicFeed(),
    newsSection = merged(feed, "home.news", homeDefaults["home.news"]),
    faq = merged(feed, "home.faq", homeDefaults["home.faq"]);
  const hero = section("home.hero"),
    services = section("home.services"),
    pricing = section("home.pricing"),
    cta = section("home.cta");
  return (
    <div className="home-page" lang="vi">
      {!hero?.withdrawn &&
        !(hero?.payload as { hidden?: boolean } | null)?.hidden && (
          <Hero copy={hero?.payload} />
        )}
      {!services?.withdrawn && (
        <ServicesSection
          title={services?.payload?.title}
          description={services?.payload?.description}
        />
      )}
      <AccessoriesSection />
      <ProcessSection />
      {!pricing?.withdrawn && (
        <PricingSection
          title={pricing?.payload?.title}
          description={pricing?.payload?.description}
        />
      )}
      <WorkSection />
      <SocialGallery />
      <BenefitsSection />
      <ReviewsSection />
      <BrandsSection />
      {newsSection && (
        <NewsSection
          title={newsSection.title}
          items={news.slice(0, 4)}
          vietnamese
        />
      )}
      {faq && (
        <FAQ
          items={(faq.items as { title?: string; text?: string }[]).map(
            (f) => ({ question: f.title || "", answer: f.text || "" }),
          )}
          title={faq.title}
          description={faq.description}
        />
      )}
      <LocationSection vietnamese />
      {!cta?.withdrawn && (
        <FinalCTA vietnamese copy={cta?.payload || undefined} />
      )}
    </div>
  );
}
