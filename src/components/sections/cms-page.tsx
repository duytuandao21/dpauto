import { cmsImageSrc, type CmsPayload } from "@/lib/api/cms";
import { richToHtml, type Payload } from "@/lib/site-content";
import { CmsBlocks } from "./cms-blocks";
import { Photo } from "@/components/ui/photo";

/** Whether a page document carries its own body (otherwise the built-in layout stays). */
export const hasBody = (p?: Payload | null) => !!(p?.body || p?.blocks?.length);

export function CmsPage({ content }: { content: CmsPayload & Payload }) {
  const image = content.image?.src
    ? {
        src: content.image.src,
        alt: content.image.alt || content.title,
        media: content.image.webp ? content.image : undefined,
      }
    : content.imageId
      ? { src: cmsImageSrc(content), alt: content.title, media: content.image }
      : undefined;
  return (
    <section className="section">
      <div className="container">
        {(content.title || content.description) && (
          <header className="section-heading">
            {content.title && <h1>{content.title}</h1>}
            {content.description && <p>{content.description}</p>}
          </header>
        )}
        {image && (
          <div className="article-cover">
            <Photo {...image} sizes="100vw" />
          </div>
        )}
        {content.body ? (
          // HTML is generated from validated rich text with every value escaped.
          <div
            className="rich-content"
            dangerouslySetInnerHTML={{ __html: richToHtml(content.body) }}
          />
        ) : (
          <CmsBlocks blocks={content.blocks || []} />
        )}
      </div>
    </section>
  );
}
