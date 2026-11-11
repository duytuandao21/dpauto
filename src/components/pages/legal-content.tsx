import type { ContentBlock } from "@/lib/content";
import { RichContent } from "@/components/sections/shared";

export function LegalContent({ blocks }: { blocks: ContentBlock[] }) {
  const firstSection = blocks.findIndex((block) => block.tag === "h3");
  const header = blocks.slice(0, firstSection);
  const sections: { heading: ContentBlock; content: ContentBlock[] }[] = [];
  for (const block of blocks.slice(firstSection)) {
    if (block.tag === "h3") sections.push({ heading: block, content: [] });
    else sections[sections.length - 1].content.push(block);
  }
  const contact = sections[sections.length - 1].content.slice(1);

  return (
    <div className="legal-reading">
      <header className="legal-header">
        <RichContent blocks={header.slice(0, 2)} className="legal-heading" />
        <RichContent
          blocks={header.slice(2, -1)}
          className="legal-introduction"
        />
        <p
          className="legal-updated"
          dangerouslySetInnerHTML={{ __html: header[header.length - 1].html }}
        />
      </header>
      {sections.map((section, index) => (
        <section className="legal-section" key={section.heading.html}>
          <h3 dangerouslySetInnerHTML={{ __html: section.heading.html }} />
          <RichContent
            blocks={
              index === sections.length - 1
                ? section.content.slice(0, 1)
                : section.content
            }
            className="legal-prose"
          />
        </section>
      ))}
      <aside className="legal-contact-card">
        <RichContent
          blocks={contact.slice(0, 2)}
          className="legal-contact-copy"
        />
        {[2, 4].map((index) => (
          <div className="legal-contact-row" key={index}>
            <p dangerouslySetInnerHTML={{ __html: contact[index].html }} />
            <p dangerouslySetInnerHTML={{ __html: contact[index + 1].html }} />
          </div>
        ))}
      </aside>
    </div>
  );
}
