import Link from "next/link";
import { articles, type Article } from "@/lib/content";
import { homeArticles } from "@/lib/home-vi";
import { Button } from "@/components/ui/button";
import { NewsButton, NewsCardFrame } from "./news-motion";
import { FeaturedArticleFrame } from "./news-page-motion";

export function ArticleMeta({ article }: { article: Article }) {
  return (
    <div className="article-meta">
      <span>{article.category}</span>
      <span>/</span>
      <time>{article.date}</time>
    </div>
  );
}

export function NewsCard({
  article,
  className,
  originalImages = false,
  vietnamese = false,
}: {
  article: Article;
  className?: string;
  originalImages?: boolean;
  vietnamese?: boolean;
}) {
  return (
    <NewsCardFrame
      image={article.image}
      className={className}
      originalImages={originalImages}
    >
      <div className="news-card-copy">
        <ArticleMeta article={article} />
        <h3>
          <Link href={`/news/${article.slug}`}>{article.title}</Link>
        </h3>
        <p>{article.description}</p>
        <NewsButton href={`/news/${article.slug}`}>
          {vietnamese ? "Đọc tiếp" : "Read More"}
        </NewsButton>
      </div>
    </NewsCardFrame>
  );
}

export function NewsSection({
  title = "Latest News from Hyper Auto Care",
  items,
  more = true,
  originalImages = false,
  vietnamese = false,
}: {
  title?: string;
  items?: Article[];
  more?: boolean;
  originalImages?: boolean;
  vietnamese?: boolean;
}) {
  return (
    <section className="section news-section">
      <div className="container">
        <div className="news-heading">
          <h2>{title}</h2>
        </div>
        <div className="news-grid">
          {(items ?? (vietnamese ? homeArticles : articles).slice(0, 4)).map(
            (article, index) => (
              <NewsCard
                key={article.slug}
                article={article}
                vietnamese={vietnamese}
                originalImages={originalImages}
                className={
                  !items && index === 3 ? "news-card--tablet-only" : undefined
                }
              />
            ),
          )}
        </div>
        {more && (
          <div className="section-bottom">
            <NewsButton href="/news" light>
              {vietnamese ? "Xem thêm" : "View More"}
            </NewsButton>
          </div>
        )}
      </div>
    </section>
  );
}

export function FeaturedArticle() {
  const article = articles[5];
  return (
    <FeaturedArticleFrame
      image={article.image}
      heading={
        <>
          <span className="eyebrow">FEATURED</span>
          <h2>From the Workshop</h2>
        </>
      }
    >
      <ArticleMeta article={article} />
      <h3>
        <Link href={`/news/${article.slug}`}>{article.title}</Link>
      </h3>
      <p>{article.description}</p>
      <Button href={`/news/${article.slug}`}>Read More</Button>
    </FeaturedArticleFrame>
  );
}
