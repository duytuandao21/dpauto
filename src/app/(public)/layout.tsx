import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ContactDock } from "@/components/layout/contact-dock";
import { BackToTop } from "@/components/layout/back-to-top";
import { SiteEffects } from "@/components/motion/site-effects";
import {
  SiteContentProvider,
  type SiteData,
} from "@/components/site/site-content";
import { publicFeed } from "@/lib/public-cms";
import {
  siteAccessories,
  siteCatalog,
  siteVehicles,
  siteNavigation,
  siteProjects,
  siteServices,
  siteSettings,
  type Feed,
} from "@/lib/site-content";

async function siteData(): Promise<SiteData> {
  let feed: Feed & { preview: boolean };
  try {
    feed = await publicFeed();
  } catch {
    // Without the CMS the website still renders its built-in content.
    feed = { items: [], assets: {}, preview: false };
  }
  return {
    settings: siteSettings(feed),
    navigation: siteNavigation(feed),
    pages: Object.fromEntries(
      feed.items
        .filter((d) => d.kind === "PAGE")
        .map((d) => [d.key, d.withdrawn ? null : d.payload]),
    ),
    services: siteServices(feed).map(
      ({ key, slug, title, description, image, price, icon, shortcutImage }) => ({
        key,
        slug,
        title,
        description,
        image,
        price,
        icon,
        shortcutImage,
      }),
    ),
    accessories: siteAccessories(feed),
    catalog: siteCatalog(feed),
    vehicles: siteVehicles(feed),
    projects: siteProjects(feed),
    assets: feed.assets,
    preview: feed.preview,
  };
}

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const data = await siteData();
  return (
    <SiteContentProvider value={data}>
      <SiteEffects>
        <Header />
        <main id="main-content">{children}</main>
        <Footer />
        <ContactDock />
        <BackToTop />
      </SiteEffects>
      {data.preview && (
        <a className="preview-bar" href="/api/preview/exit">
          Đang xem trước bản nháp · Thoát xem trước
        </a>
      )}
    </SiteContentProvider>
  );
}
