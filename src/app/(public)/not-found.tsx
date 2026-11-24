import { Photo } from "@/components/ui/photo";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { publicFeed } from "@/lib/public-cms";
import { siteSettings } from "@/lib/site-content";

export default async function NotFound() {
  // Address from Cài đặt website, like the footer.
  const settings = siteSettings(await publicFeed());
  return (
    <section className="not-found">
      <Photo
        src="/images/W7P9NeMMaW0raSzYV5sntMR8ZXs.webp"
        alt="Kỹ thuật viên đánh bóng xe trong xưởng chăm sóc xe chuyên nghiệp"
        priority
        sizes="100vw"
      />
      <div className="not-found-shade" />
      <div className="container">
        <p className="not-found-address">
          <Icon name="pin" />
          {[settings.address, settings.city].filter(Boolean).join(", ")}
        </p>
        <div className="not-found-number" aria-hidden="true">
          404
        </div>
        <h1>Không tìm thấy trang</h1>
        <p>
          Trang bạn tìm có thể đã được di chuyển, xóa hoặc không còn tồn
          tại.
        </p>
        <div className="button-row">
          <Button href="/" variant="secondary">
            Về trang chủ
          </Button>
          <Button href="/dich-vu">Xem dịch vụ</Button>
        </div>
      </div>
    </section>
  );
}
