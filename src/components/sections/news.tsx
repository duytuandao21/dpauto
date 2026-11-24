import Link from "next/link";
import { articles, type Article } from "@/lib/content";
import { homeArticles } from "@/lib/home-vi";
import { Button } from "@/components/ui/button";
import { NewsButton, NewsCardFrame } from "./news-motion";
import { FeaturedArticleFrame } from "./news-page-motion";

export function ArticleMeta({ article }: { article: Article }) {
  return (
    <div className="article-meta">
      {article.category && (
        <>
          <span>{article.category}</span>
          <span>/</span>
        </>
      )}
      <time>{article.date}</time>
    </div>
  );
}

export function NewsCard({
  article,
  className,
  vietnamese = true,
}: {
  article: Article;
  className?: string;
  vietnamese?: boolean;
}) {
  return (
    <NewsCardFrame
      image={article.image}
      className={className}
    >
      <div className="news-card-copy">
        <ArticleMeta article={article} />
        <h3>
          <Link href={`/tin-tuc/${article.slug}`}>{article.title}</Link>
        </h3>
        <p>{article.description}</p>
        <NewsButton href={`/tin-tuc/${article.slug}`}>
          {vietnamese ? "Đọc tiếp" : "Read More"}
        </NewsButton>
      </div>
    </NewsCardFrame>
  );
}

export function NewsSection({
  title = "Tin mới từ DPAuto",
  items,
  more = true,
  vietnamese = true,
}: {
  title?: string;
  items?: Article[];
  more?: boolean;
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
                className={
                  !items && index === 3 ? "news-card--tablet-only" : undefined
                }
              />
            ),
          )}
        </div>
        {more && (
          <div className="section-bottom">
            <NewsButton href="/tin-tuc" light>
              {vietnamese ? "Xem thêm" : "View More"}
            </NewsButton>
          </div>
        )}
      </div>
    </section>
  );
}

export function FeaturedArticle({
  article = articles[5],
}: {
  article?: Article;
}) {
  return (
    <FeaturedArticleFrame
      image={article.image}
      heading={
        <>
          <span className="eyebrow">NỔI BẬT</span>
          <h2>Từ xưởng của chúng tôi</h2>
        </>
      }
    >
      <ArticleMeta article={article} />
      <h3>
        <Link href={`/tin-tuc/${article.slug}`}>{article.title}</Link>
      </h3>
      <p>{article.description}</p>
      <Button href={`/tin-tuc/${article.slug}`}>Đọc tiếp</Button>
    </FeaturedArticleFrame>
  );
}
