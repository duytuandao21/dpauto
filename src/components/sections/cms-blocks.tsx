import type { CmsBlock } from "@/lib/api/cms";
export function CmsBlocks({ blocks }: { blocks: CmsBlock[] }) {
  return (
    <div className="rich-content">
      {blocks.map((b, i) =>
        b.tag === "li" ? (
          <ul key={i}>
            <li>{b.text}</li>
          </ul>
        ) : b.tag === "h2" ? (
          <h2 key={i}>{b.text}</h2>
        ) : b.tag === "h3" ? (
          <h3 key={i}>{b.text}</h3>
        ) : b.tag === "blockquote" ? (
          <blockquote key={i}>{b.text}</blockquote>
        ) : (
          <p key={i}>{b.text}</p>
        ),
      )}
    </div>
  );
}
