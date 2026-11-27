import Link from "next/link";
import { site } from "@/lib/content";
import type { SiteService } from "@/lib/site-content";
import { Photo } from "@/components/ui/photo";
import { Button } from "@/components/ui/button";
import { BookingLauncher } from "@/components/public-booking/booking-dialog";
import { BookingPreset } from "@/components/public-booking/booking-preset";
import { FAQ } from "@/components/sections/faq";
import { WorkFinalCTA } from "@/components/sections/our-work-motion";
import { ServiceHero } from "./service-detail-motion";

/** Service page: compact banner, the article body (text, tables, photos, videos) and FAQ, with a slim sidebar. */
export function ServiceDetail({
  service,
  others,
  phone = { text: site.phone, href: site.phoneHref },
}: {
  service: SiteService;
  others: SiteService[];
  phone?: { text: string; href: string };
}) {
  const bodyHtml = service.overviewHtml.replace(/<img\b[^>]*>/g, (tag) => {
    const width = tag.match(/\bwidth="(\d+)"/)?.[1];
    return width ? tag.replace("<img", `<img style="width:${width}px"`) : tag;
  });

  return (
    <div className="detail-page service-detail-page">
      <BookingPreset serviceKeys={[service.key]} />
      <ServiceHero service={service} />
      <div className="container service-body">
        <div className="service-main">
          {/* Same content and typography as a news article. */}
          <div className="article-body service-article">
            <div
              className="rich-content"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
          </div>
          <FAQ
            items={service.faq}
            description={service.faqIntroduction}
            compact
          />
        </div>
        <aside className="service-sidebar">
          <div className="service-contact-card">
            <div className="service-contact-copy">
              <h3>Sẵn sàng chăm sóc xe của bạn?</h3>
              <p>
                Đặt lịch trước để DPAuto chuẩn bị sẵn sàng, bạn đến là được phục
                vụ ngay.
              </p>
            </div>
            <div className="service-contact-actions">
              <BookingLauncher label="Đặt lịch ngay" />
              <Button href={phone.href} variant="secondary" icon="phone">
                Gọi {phone.text}
              </Button>
            </div>
          </div>
          <div className="other-services">
            <h3>Dịch vụ khác</h3>
            <div className="other-services-list">
              {others.map((item) => (
                <Link href={"/dich-vu/" + item.slug} key={item.slug}>
                  <Photo {...item.image} />
                  <span>{item.title}</span>
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </div>
      <WorkFinalCTA />
    </div>
  );
}
