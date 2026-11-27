import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArticleMeta, NewsSection } from "@/components/sections/news";
import { richHtml } from "@/components/sections/shared";
import { ArticleToc } from "@/components/pages/article-toc";
import { withHeadingIds } from "@/lib/article-toc";
import { WorkFinalCTA } from "@/components/sections/our-work-motion";
import { Photo } from "@/components/ui/photo";
import {
  publicArticles,
  publicMetadata,
  publicContent,
} from "@/lib/public-cms";

// Articles come from the CMS on every request (revalidate: 0); a static shell
// with an empty param list fails at runtime with "static to dynamic".
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = (await publicArticles()).find((a) => a.slug === slug);
  const noindex = (await publicContent()).find(
    (d) => d.kind === "NEWS" && d.key === slug,
  )?.payload?.noindex;
  return publicMetadata("/news/" + slug, {
    title: article?.title,
    description: article?.description,
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  });
}
export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const articles = await publicArticles();
  const article = articles.find((a) => a.slug === slug);
  if (!article) notFound();
  const { html, toc } = withHeadingIds(richHtml(article.content));
  const hasToc = toc.length > 0;
  return (
    <div className="detail-page article-detail-page">
      <article className="article-page">
        {/* With headings: article on the left, a sticky table of contents on the right from the title down. */}
        <div className={hasToc ? "article-layout" : undefined}>
          <div className="article-main">
            <header className="article-heading">
              <ArticleMeta article={article} />
              <h1>{article.title}</h1>
              <p>{article.description}</p>
            </header>
            <div className="article-cover">
              <div className="article-cover-image">
                <Photo
                  {...article.image}
                  priority
                  sizes={hasToc ? "(min-width: 1200px) 760px, 100vw" : "1100px"}
                />
              </div>
            </div>
            <div className="article-body">
              {hasToc && <ArticleToc items={toc} variant="inline" />}
              <div
                className="rich-content"
                dangerouslySetInnerHTML={{ __html: html }}
              />
              <Link href="/tin-tuc" className="back-link">
                &lt; Quay lại Tin tức &amp; Ưu đãi
              </Link>
            </div>
          </div>
          {hasToc && <ArticleToc items={toc} variant="side" />}
        </div>
      </article>
      <NewsSection
        title="Tin khác từ DPAuto"
        items={articles.filter((a) => a.slug !== slug).slice(0, 3)}
        more={false}
      />
      <WorkFinalCTA />
    </div>
  );
}
