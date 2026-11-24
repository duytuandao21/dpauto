"use client";
import { SiteLogo } from "@/components/layout/site-logo";
import Link from "next/link";
import { site } from "@/lib/content";
import { homeDefaults } from "@/lib/home-defaults";
import { useSection, useSite } from "@/components/site/site-content";
import { Button } from "@/components/ui/button";
import { HomeScrollFrame } from "./home-motion";
import { HomeSectionHeading as SectionHeading } from "./home-motion";

export { ProcessSection } from "./process-section";

export function PricingSection({
  title,
  description,
}: {
  title?: string;
  description?: string;
}) {
  const section = useSection("home.pricing", homeDefaults["home.pricing"]);
  const { settings } = useSite();
  if (!section) return null;
  title = section.title || title || homeDefaults["home.pricing"].title;
  description =
    section.description ??
    description ??
    homeDefaults["home.pricing"].description;
  // Rows are grouped by their "meta" (column heading), keeping their order.
  const groups: { title: string; rows: [string, string, string][] }[] = [];
  for (const r of section.items as {
    meta?: string;
    title?: string;
    price?: string;
    href?: string;
  }[]) {
    const g =
      groups.find((x) => x.title === (r.meta || "")) ||
      (groups.push({ title: r.meta || "", rows: [] }),
      groups[groups.length - 1]);
    g.rows.push([r.title || "", r.price || "", r.href || ""]);
  }
  const phoneHref = settings.custom ? settings.phoneHref : site.phoneHref;
  return (
    <section className="section pricing-section" id="pricing">
      <div className="container">
        <SectionHeading title={title} description={description} />
        <HomeScrollFrame className="pricing-menu" from={{ scale: 1.06 }}>
          <div className="pricing-title">
            <SiteLogo sizes="160px" />
            <h3>{section.subtitle}</h3>
          </div>
          <div className="pricing-columns">
            {groups.map((group) => (
              <div key={group.title}>
                <h4>{group.title}</h4>
                <dl>
                  {group.rows.map(([title, price, href]) => (
                    <div className="price-row" key={title}>
                      <dt>
                        <span>•</span>
                        {href ? <Link href={href}>{title}</Link> : title}
                      </dt>
                      <dd>{price}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
          <div className="pricing-bottom">
            <p>{section.note}</p>
            <Button
              href={section.cta?.href || phoneHref}
              variant="secondary"
              icon="phone"
            >
              {section.cta?.label || "Gọi tư vấn"}
            </Button>
          </div>
        </HomeScrollFrame>
      </div>
    </section>
  );
}
