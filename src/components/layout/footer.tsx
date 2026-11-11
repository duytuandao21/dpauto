"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { homeNavigation } from "@/lib/home-vi";
import Image from "next/image";
import { navigation, site } from "@/lib/content";
import { Icon } from "@/components/ui/icon";
import { FooterShader } from "@/components/media/footer-shader";

export function Hours({
  compact = false,
  vietnamese = false,
}: {
  compact?: boolean;
  vietnamese?: boolean;
}) {
  return (
    <dl className={`hours ${compact ? "hours--compact" : ""}`}>
      <div>
        <dt>
          {vietnamese
            ? compact
              ? "T2 – T6:"
              : "Thứ Hai – Thứ Sáu"
            : compact
              ? "Mon - Fri:"
              : "Monday - Friday"}
        </dt>
        <dd>{vietnamese ? "08:00 – 18:00" : "8:00 AM - 6:00 PM"}</dd>
      </div>
      <div>
        <dt>
          {vietnamese
            ? compact
              ? "Thứ Bảy:"
              : "Thứ Bảy"
            : compact
              ? "Saturday:"
              : "Saturday"}
        </dt>
        <dd>{vietnamese ? "08:00 – 12:00" : "8:00 AM - 12:00 PM"}</dd>
      </div>
      <div>
        <dt>
          {vietnamese
            ? compact
              ? "Chủ Nhật:"
              : "Chủ Nhật"
            : compact
              ? "Sunday:"
              : "Sunday"}
        </dt>
        <dd className="muted">{vietnamese ? "Nghỉ" : "Closed"}</dd>
      </div>
    </dl>
  );
}

export function Footer() {
  const vietnamese = usePathname() === "/";
  const links = vietnamese ? homeNavigation : navigation;
  return (
    <footer className="site-footer" lang={vietnamese ? "vi" : "en"}>
      <FooterShader kind="background" palette="red" />
      <div className="container footer-content">
        <div className="footer-columns">
          <div className="footer-brand">
            <Link
              href="/"
              aria-label={vietnamese ? "Trang chủ DPAuto" : "DPAuto home"}
            >
              <Image
                src="/images/logo-dpauto.png"
                alt="DPAuto Logo"
                width={1448}
                height={1086}
                sizes="180px"
              />
            </Link>
            <p>
              {vietnamese
                ? "Chăm sóc ô tô, vệ sinh chuyên sâu và bảo vệ sơn chuyên nghiệp tại Seattle."
                : "Professional car care, detailing, paint protection, and vehicle appearance services in Seattle."}
            </p>
            <div className="social-links">
              <a
                href="https://www.facebook.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon name="facebook" />
                HyperAuto Care
              </a>
              <a
                href="https://www.instagram.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon name="instagram" />
                HyperAuto Care
              </a>
            </div>
          </div>
          <div>
            <h3 className="footer-heading">
              {vietnamese ? "Khám phá" : "Navigation"}
            </h3>
            <nav
              className="footer-nav"
              aria-label={
                vietnamese ? "Điều hướng cuối trang" : "Footer navigation"
              }
            >
              <Link href="/">{vietnamese ? "Trang chủ" : "Home"}</Link>
              {links.slice(0, 1).map((n) => (
                <Link key={n.href} href={n.href}>
                  {n.label}
                </Link>
              ))}
              <Link href="/#Our%20Service%20Process">
                {vietnamese ? "Quy trình dịch vụ" : "Service Process"}
              </Link>
              {links.slice(1).map((n) => (
                <Link key={n.href} href={n.href}>
                  {n.label}
                </Link>
              ))}
              <Link href="/contact">{vietnamese ? "Liên hệ" : "Contact"}</Link>
            </nav>
          </div>
          <div>
            <h3 className="footer-heading">
              {vietnamese ? "Liên hệ" : "Contact"}
            </h3>
            <a href={site.phoneHref}>{site.phone}</a>
            <a href={`mailto:${site.email}`} className="footer-email">
              {site.email}
            </a>
            <address>
              {site.address}
              <br />
              {site.city}
              <br />
              {vietnamese ? "Hoa Kỳ" : "USA"}
            </address>
          </div>
          <div>
            <h3 className="footer-heading">
              {vietnamese ? "Giờ mở cửa" : "Opening Hours"}
            </h3>
            <Hours vietnamese={vietnamese} />
          </div>
        </div>
        <div className="footer-wordmark" aria-hidden="true">
          <FooterShader kind="logo" logoSrc="/images/logo-dpauto.png" />
        </div>
        <div className="footer-bottom">
          <p>
            © HyperAuto Care.{" "}
            {vietnamese ? "Bảo lưu mọi quyền." : "All rights reserved."}
          </p>
          <p>
            {vietnamese ? "Thiết kế bởi" : "Designed by"}{" "}
            <a
              href="https://redsignal.red/"
              target="_blank"
              rel="noopener noreferrer"
            >
              RedSignal.Red
            </a>
          </p>
          <div>
            <Link href="/privacy">
              {vietnamese ? "Chính sách bảo mật" : "Privacy Policy"}
            </Link>
            <Link href="/terms">
              {vietnamese ? "Điều khoản dịch vụ" : "Terms of Service"}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
