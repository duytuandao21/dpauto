import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { articles } from "@/lib/content";
import { ArticleMeta, NewsSection } from "@/components/sections/news";
import { RichContent } from "@/components/sections/shared";
import { WorkFinalCTA } from "@/components/sections/our-work-motion";
import { Photo } from "@/components/ui/photo";

export const dynamicParams = false;
export function generateStaticParams() {
  return articles.map((article) => ({ slug: article.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = articles.find((a) => a.slug === slug);
  return { title: article?.title, description: article?.description };
}
export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = articles.find((a) => a.slug === slug);
  if (!article) notFound();
  return (
    <div className="detail-page article-detail-page">
      <article className="article-page">
        <header className="article-heading">
          <ArticleMeta article={article} />
          <h1>{article.title}</h1>
          <p>{article.description}</p>
        </header>
        <div className="article-cover">
          <div className="article-cover-image">
            <Photo {...article.image} priority unoptimized sizes="1100px" />
          </div>
        </div>
        <div className="article-body">
          <RichContent blocks={article.content} />
          <Link href="/news" className="back-link">
            &lt; Back to News &amp; Promotion
          </Link>
        </div>
      </article>
      <NewsSection
        title="More from HyperAuto Care"
        items={articles.filter((a) => a.slug !== slug).slice(0, 3)}
        more={false}
        originalImages
      />
      <WorkFinalCTA />
    </div>
  );
}
