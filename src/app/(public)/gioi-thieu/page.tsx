import type { Metadata } from "next";
import { AboutContent } from "@/components/pages/about-content";
import { AboutBanner } from "@/components/pages/about-motion";
import { publicFeed, publicPage, publicMetadata } from "@/lib/public-cms";
import { pageDefaults } from "@/lib/page-defaults";
import { image, section, type Feed } from "@/lib/site-content";
import { notFound } from "next/navigation";

export const generateMetadata = (): Promise<Metadata> =>
  publicMetadata("/about", { title: "Giới thiệu DPAuto" });

type Img = { src: string; alt: string; assetId?: string } | null | undefined;
type Part = keyof typeof pageDefaults.about.parts;
/** One about block (saved under `parts` of the "about" document, else built-in), images resolved; null when hidden. */
function block(feed: Feed, key: Part) {
  const saved = section(feed, "about", pageDefaults.about) as {
    parts?: Record<string, Record<string, unknown>>;
  } | null;
  const p: Record<string, unknown> = {
    ...pageDefaults.about.parts[key],
    ...saved?.parts?.[key],
  };
  if (p.hidden) return null;
  const str = (k: string) => (p[k] ? String(p[k]) : undefined);
  return {
    subtitle: str("subtitle"),
    title: str("title"),
    description: str("description"),
    note: str("note"),
    image: image(p.image as Img, feed.assets),
    images: ((p.images || []) as Img[]).map((i) => image(i, feed.assets)),
    video: image(((p.videos || []) as Img[])[0], feed.assets)?.src,
    items: ((p.items || []) as { title?: string; text?: string }[])
      .filter((i) => i.title || i.text)
      .map((i) => ({ title: i.title || "", text: i.text || "" })),
  };
}

export default async function AboutPage() {
  const content = await publicPage("about");
  if (content?.withdrawn) notFound();
  const feed = await publicFeed();
  return (
    <div className="about-page">
      <AboutBanner />
      <AboutContent
        story={block(feed, "story")}
        approach={block(feed, "approach")}
        workshop={block(feed, "workshop")}
        team={block(feed, "team")}
      />
    </div>
  );
}
