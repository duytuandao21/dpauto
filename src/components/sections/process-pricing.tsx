import Image from "next/image";
import Link from "next/link";
import { site } from "@/lib/content";
import { Button } from "@/components/ui/button";
import { HomeScrollFrame } from "./home-motion";
import { HomeSectionHeading as SectionHeading } from "./home-motion";

export { ProcessSection } from "./process-section";

const pricing = [
  {
    title: "LÀM SẠCH & PHỤC HỒI",
    rows: [
      ["Rửa xe chuyên sâu", "Từ $65", "detail-wash"],
      ["Vệ sinh nội thất", "Từ $180", "interior-detailing"],
      ["Hiệu chỉnh sơn", "Từ $450", "paint-correction"],
      ["Vệ sinh khoang máy", "Từ $95", "engine-bay-detailing"],
      ["Phục hồi đèn pha", "Từ $140", "headlight-restoration"],
    ],
  },
  {
    title: "BẢO VỆ & NÂNG CẤP",
    rows: [
      ["Phủ ceramic", "Từ $850", "ceramic-coating"],
      ["Dán phim PPF", "Liên hệ báo giá", "paint-protection-film-(ppf)"],
      ["Dán phim cách nhiệt", "Từ $280", "window-tint"],
      ["Tẩy ố kính", "Từ $120", "glass-water-spot-removal"],
      ["Phủ gầm bảo vệ", "Từ $380", "underbody-coating-protection"],
    ],
  },
];

export function PricingSection() {
  return (
    <section className="section pricing-section" id="pricing">
      <div className="container">
        <SectionHeading
          title="Dịch vụ & bảng giá"
          description="Giá tùy vào kích thước, tình trạng xe và hạng mục thực hiện. Liên hệ để nhận báo giá chính xác."
        />
        <HomeScrollFrame className="pricing-menu" from={{ scale: 1.06 }}>
          <div className="pricing-title">
            <Image
              src="/images/logo-dpauto.png"
              alt="DPAuto Logo"
              width={1448}
              height={1086}
              sizes="160px"
            />
            <h3>Bảng giá dịch vụ tham khảo</h3>
          </div>
          <div className="pricing-columns">
            {pricing.map((group) => (
              <div key={group.title}>
                <h4>{group.title}</h4>
                <dl>
                  {group.rows.map(([title, price, slug]) => (
                    <div className="price-row" key={title}>
                      <dt>
                        <span>•</span>
                        <Link href={`/services/${slug}`}>{title}</Link>
                      </dt>
                      <dd>{price}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
          <div className="pricing-bottom">
            <p>Liên hệ để được tư vấn và báo giá chi tiết.</p>
            <Button href={site.phoneHref} variant="secondary" icon="phone">
              Gọi tư vấn
            </Button>
          </div>
        </HomeScrollFrame>
      </div>
    </section>
  );
}
