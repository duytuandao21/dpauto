import { ComparisonCarousel } from "@/components/media/comparison-carousel";
import {
  AboutGalleryImage as GalleryImage,
  AboutVideo as GalleryVideo,
} from "@/components/pages/about-motion";
import { Button } from "@/components/ui/button";
import { HomeSectionHeading as SectionHeading } from "./home-motion";
import { HomeSocialLink } from "./home-motion";

const galleryImages = [
  {
    src: "/images/mGs8Snpdilvf4Tj97QjW0FdaAy0.webp",
    alt: "Xe sau khi hoàn tất chăm sóc tại HyperAuto Care",
  },
  {
    src: "/images/gv0F2vE8CnjY1WUos05p1ycEuDQ.webp",
    alt: "Chăm sóc xe tại xưởng HyperAuto Care",
  },
  {
    src: "/images/IPz1ZOzMs2KRfySU3adLI7XJnvE.webp",
    alt: "Rửa xe và chăm sóc ngoại thất tại HyperAuto Care",
  },
  {
    src: "/images/o2dUjNf8zaSm1OA9O9k0HFYVSIU.webp",
    alt: "Hoàn thiện bề mặt xe tại HyperAuto Care",
  },
];

export function WorkSection() {
  return (
    <section className="section light home-work">
      <div className="container">
        <SectionHeading
          title="Khác biệt từ từng chi tiết"
          description="Kết quả thực tế sau khi làm sạch, hiệu chỉnh và phục hồi xe."
        />
      </div>
      <div className="container work-results">
        <ComparisonCarousel />
        <div className="section-bottom">
          <Button href="/our-work" variant="secondary">
            Xem thêm thành quả
          </Button>
        </div>
      </div>
    </section>
  );
}

export function SocialGallery() {
  return (
    <section className="light social-gallery">
      <div className="container">
        <div className="social-gallery-heading">
          <h3>Theo dõi những hình ảnh và công việc mới nhất tại xưởng.</h3>
        </div>
      </div>
      <div className="social-mosaic">
        <GalleryImage image={galleryImages[0]} />
        <GalleryVideo src="/videos/3N4aS6LLHk8XXKgD51R21mRi8Q.webm" />
        <GalleryImage image={galleryImages[1]} />
        <GalleryVideo src="/videos/xReQmqj0OIZCmYSNJTLGTz63324.webm" />
        <GalleryImage image={galleryImages[2]} />
        <GalleryImage image={galleryImages[3]} />
      </div>
      <div className="social-gallery-actions button-row">
        <HomeSocialLink href="https://www.facebook.com/" icon="facebook">
          Theo dõi Facebook
        </HomeSocialLink>
        <HomeSocialLink href="https://www.instagram.com/" icon="instagram">
          Theo dõi Instagram
        </HomeSocialLink>
      </div>
    </section>
  );
}
