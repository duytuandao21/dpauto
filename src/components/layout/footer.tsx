"use client";

import Link from "next/link";
import { headerLinks } from "./header";
import { SiteLogo } from "./site-logo";
import { site } from "@/lib/content";
import { useSite } from "@/components/site/site-content";
import { Icon } from "@/components/ui/icon";
import { FooterShader } from "@/components/media/footer-shader";

export function Hours({
  compact = false,
  vietnamese = true,
}: {
  compact?: boolean;
  vietnamese?: boolean;
}) {
  const { settings } = useSite();
  if (settings.custom)
    return (
      <dl className={`hours ${compact ? "hours--compact" : ""}`}>
        {settings.hours.map((h) => (
          <div key={h.label}>
            <dt>{compact ? `${h.label}:` : h.label}</dt>
            <dd
              className={/^nghỉ$/i.test(h.value.trim()) ? "muted" : undefined}
            >
              {h.value}
            </dd>
          </div>
        ))}
      </dl>
    );
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
  const vietnamese = true;
  const { settings, navigation: menu } = useSite();
  // Footer shows only Facebook and TikTok, each with its own name, on one row.
  const socials = (
    [
      ["facebook", "Facebook"],
      ["tiktok", "TikTok"],
    ] as const
  )
    .map(([k, label]) => ({ k, label, href: settings.socials?.[k] }))
    .filter((x): x is typeof x & { href: string } => !!x.href);
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
              <SiteLogo sizes="180px" />
            </Link>
            <p>
              {settings.custom
                ? settings.footerText || settings.tagline
                : vietnamese
                  ? "Chăm sóc ô tô, vệ sinh chuyên sâu và bảo vệ sơn chuyên nghiệp tại DPAuto - Trạm dịch vụ Toàn Trung."
                  : "Professional car care, detailing and paint protection at DPAuto."}
            </p>
            <div className="social-links">
              {socials.map((s) => (
                <a
                  key={s.k}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name={s.k} />
                  {s.label}
                </a>
              ))}
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
              {headerLinks(menu).map((n) => (
                <Link key={n.href + n.label} href={n.href}>
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <div>
            <h3 className="footer-heading">
              {vietnamese ? "Liên hệ" : "Contact"}
            </h3>
            <a href={settings.custom ? settings.phoneHref : site.phoneHref}>
              {settings.custom ? settings.phone : site.phone}
            </a>
            {(settings.custom ? settings.email : site.email) && (
              <a
                href={`mailto:${settings.custom ? settings.email : site.email}`}
                className="footer-email"
              >
                {settings.custom ? settings.email : site.email}
              </a>
            )}
            <address>
              {settings.custom ? settings.address : site.address}
              <br />
              {settings.custom ? settings.city : site.city}
              {!settings.custom && (
                <>
                  <br />
                  {vietnamese ? "Hoa Kỳ" : "USA"}
                </>
              )}
            </address>
          </div>
          <div>
            <h3 className="footer-heading">
              {vietnamese ? "Giờ mở cửa" : "Opening Hours"}
            </h3>
            <Hours vietnamese={vietnamese} />
          </div>
        </div>
        <div className="footer-bottom">
          <p>
            © {settings.name}
          </p>
          <div>
            <Link href="/chinh-sach-bao-mat">
              {vietnamese ? "Chính sách bảo mật" : "Privacy Policy"}
            </Link>
            <Link href="/dieu-khoan-dich-vu">
              {vietnamese ? "Điều khoản dịch vụ" : "Terms of Service"}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
