import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { accessories as builtIn } from "@/lib/accessories";
import { site } from "@/lib/content";
import { AccessoryDetail } from "@/components/pages/accessory-detail";
import { WorkFinalCTA as FinalCTA } from "@/components/sections/our-work-motion";
import { publicFeed, publicMetadata } from "@/lib/public-cms";
import { siteAccessories, siteSettings } from "@/lib/site-content";

// Products added in the CMS have no built-in page, so unknown slugs are resolved per request.
export function generateStaticParams() {
  return builtIn.map((a) => ({ slug: a.id }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = siteAccessories(await publicFeed()).find((a) => a.id === slug);
  return publicMetadata("/phu-kien/" + slug, {
    title: product?.name,
    description: product?.description,
  });
}
export default async function AccessoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const feed = await publicFeed(),
    all = siteAccessories(feed),
    product = all.find((a) => a.id === slug);
  if (!product) notFound();
  const settings = siteSettings(feed),
    others = all.filter((a) => a.id !== slug);
  // Same category first, then same brand, up to four cards.
  const related = [
    ...others.filter((a) => a.category && a.category === product.category),
    ...others.filter(
      (a) =>
        a.brand && a.brand === product.brand && a.category !== product.category,
    ),
  ].slice(0, 4);
  return (
    <div className="home-page accessories-page accessory-detail-page" lang="vi">
      <AccessoryDetail
        product={product}
        related={related}
        phone={
          settings.custom
            ? { text: settings.phone, href: settings.phoneHref }
            : { text: site.phone, href: site.phoneHref }
        }
      />
      <FinalCTA vietnamese />
    </div>
  );
}
