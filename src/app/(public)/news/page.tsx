import type { Metadata } from "next";
import { articles } from "@/lib/content";
import { NewsBanner } from "@/components/sections/news-page-motion";
import { WorkFinalCTA as ReferenceFinalCTA } from "@/components/sections/our-work-motion";
import { NewsSection, FeaturedArticle } from "@/components/sections/news";

export const metadata: Metadata = { title: "Latest from HyperAuto Care" };
export default function NewsPage() {
  return (
    <div className="news-page">
      <NewsBanner />
      <FeaturedArticle />
      <NewsSection
        title="All News, Guides & Offers"
        items={articles}
        more={false}
        originalImages
      />
      <ReferenceFinalCTA />
    </div>
  );
}
