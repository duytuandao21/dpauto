import type { Metadata } from "next";
import { NewsBanner } from "@/components/sections/news-page-motion";
import { WorkFinalCTA as ReferenceFinalCTA } from "@/components/sections/our-work-motion";
import { NewsSection, FeaturedArticle } from "@/components/sections/news";
import { publicArticles, publicMetadata } from "@/lib/public-cms";

export const generateMetadata = (): Promise<Metadata> =>
  publicMetadata("/news", { title: "Tin tức từ HyperAuto Care" });
export default async function NewsPage() {
  const articles = await publicArticles();
  return (
    <div className="news-page">
      <NewsBanner />
      {articles.length > 0 && (
        <FeaturedArticle article={articles[5] || articles[0]} />
      )}
      <NewsSection
        title="Tin tức, hướng dẫn & ưu đãi"
        items={articles}
        more={false}
        originalImages
      />
      <ReferenceFinalCTA />
    </div>
  );
}
