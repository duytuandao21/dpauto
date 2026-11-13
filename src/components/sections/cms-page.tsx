import type { CmsPayload } from "@/lib/api/cms";
import { CmsBlocks } from "./cms-blocks";
import { Photo } from "@/components/ui/photo";
export function CmsPage({ content }: { content: CmsPayload }) {
  return (
    <section className="section">
      <div className="container">
        <header className="section-heading">
          <h1>{content.title}</h1>
          <p>{content.description}</p>
        </header>
        {content.imageId && (
          <div className="article-cover">
            <Photo
              src={`/api/v1/public/cms/assets/${content.imageId}`}
              alt={content.title}
              unoptimized
              sizes="100vw"
            />
          </div>
        )}
        <CmsBlocks blocks={content.blocks} />
      </div>
    </section>
  );
}
