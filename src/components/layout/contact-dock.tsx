"use client";
import { Icon } from "@/components/ui/icon";
import { useSite } from "@/components/site/site-content";
import { BookingLauncher } from "@/components/public-booking/booking-dialog";
import { site as staticSite } from "@/lib/content";

/**
 * Quick contact: round directions, Zalo and call buttons above "back to top" on larger screens,
 * a fixed bottom bar (book, call, Zalo, directions) on phones. Call and Zalo share the shop number.
 */
export function ContactDock() {
  const { settings } = useSite();
  const phone = settings.custom ? settings.phone : staticSite.phone;
  const phoneHref = settings.custom ? settings.phoneHref : staticSite.phoneHref;
  const zalo = `https://zalo.me/${phone.replace(/\D/g, "")}`;
  const directions = settings.directions || staticSite.directions;
  return (
    <>
      {/* Desktop: each button shows its name on the left while hovered or focused. */}
      <div className="contact-float">
        <a
          href={directions}
          target="_blank"
          rel="noopener noreferrer"
          className="contact-float-map"
          aria-label="Chỉ đường đến cửa hàng trên Google Maps"
        >
          <Icon name="pin" />
          <span className="contact-float-label" aria-hidden="true">
            Chỉ đường
          </span>
        </a>
        <a
          href={zalo}
          target="_blank"
          rel="noopener noreferrer"
          className="contact-float-zalo"
          aria-label={`Nhắn Zalo ${phone}`}
        >
          <Icon name="zalo" />
          <span className="contact-float-label" aria-hidden="true">
            Liên hệ Zalo
          </span>
        </a>
        <a
          href={phoneHref}
          className="contact-float-call"
          aria-label={`Gọi ${phone}`}
        >
          <Icon name="phone" />
          <span className="contact-float-label" aria-hidden="true">
            Liên hệ
          </span>
        </a>
      </div>
      <nav className="mobile-dock" aria-label="Liên hệ nhanh">
        <BookingLauncher label="Đặt lịch" className="mobile-dock-book" />
        <a href={phoneHref}>
          <Icon name="phone" />
          Gọi
        </a>
        <a href={zalo} target="_blank" rel="noopener noreferrer">
          <Icon name="zalo" />
          Zalo
        </a>
        <a href={directions} target="_blank" rel="noopener noreferrer">
          <Icon name="pin" />
          Chỉ đường
        </a>
      </nav>
    </>
  );
}
