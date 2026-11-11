"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { navigation, services, site } from "@/lib/content";
import { homeNavigation, homeServices } from "@/lib/home-vi";
import { HeaderButton } from "./header-button";

export function Header() {
  const path = usePathname();
  const vietnamese = path === "/";
  const links = vietnamese ? homeNavigation : navigation;
  const menuServices = vietnamese ? homeServices : services;
  const [mobile, setMobile] = useState(false);
  const [dropdown, setDropdown] = useState(false);
  const root = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const close = () => {
    setMobile(false);
    setDropdown(false);
  };

  useEffect(() => {
    setMobile(false);
    setDropdown(false);
  }, [path]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        setDropdown(false);
        setMobile(false);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDropdown(false);
        setMobile(false);
      }
    };
    const breakpoint = matchMedia("(min-width: 1200px)");
    const reset = () => {
      setDropdown(false);
      setMobile(false);
    };
    breakpoint.addEventListener("change", reset);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      breakpoint.removeEventListener("change", reset);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  return (
    <header
      className={`site-header ${mobile ? "is-menu-open" : ""}`}
      lang={vietnamese ? "vi" : "en"}
      ref={root}
    >
      <div className="container header-inner">
        <Link
          href="/"
          className="brand"
          aria-label={vietnamese ? "Trang chủ DPAuto" : "DPAuto home"}
          onClick={close}
        >
          <Image
            src="/images/logo-dpauto.png"
            alt="DPAuto Logo"
            width={1448}
            height={1086}
            sizes="146px"
            priority
          />
        </Link>
        <nav
          className="desktop-nav"
          aria-label={vietnamese ? "Điều hướng chính" : "Main navigation"}
        >
          <div
            className="nav-services"
            onMouseEnter={() => setDropdown(true)}
            onMouseLeave={() => setDropdown(false)}
          >
            <Link
              href="/services"
              className="nav-link"
              aria-haspopup="true"
              aria-expanded={dropdown}
              aria-controls="services-menu"
              onFocus={() => setDropdown(true)}
              onClick={close}
            >
              {vietnamese ? "Dịch vụ" : "Services"}
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </Link>
            <AnimatePresence>
              {dropdown && (
                <motion.div
                  id="services-menu"
                  className="services-menu"
                  role="region"
                  aria-label={vietnamese ? "Dịch vụ" : "Services"}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={
                    reduced
                      ? { duration: 0 }
                      : { type: "spring", duration: 0.4, bounce: 0.2 }
                  }
                >
                  <div className="services-menu-grid">
                    {menuServices.map((service) => (
                      <Link
                        key={service.slug}
                        href={`/services/${service.slug}`}
                        onClick={close}
                      >
                        <Image
                          src={service.image.src}
                          alt=""
                          width={60}
                          height={54}
                        />
                        <span>{service.title}</span>
                      </Link>
                    ))}
                  </div>
                  <Link
                    className="services-menu-all"
                    href="/services"
                    onClick={close}
                  >
                    {vietnamese ? "Xem tất cả dịch vụ" : "View All Services"}
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {links.slice(1).map((item) => (
            <Link
              key={item.href}
              className="nav-link"
              href={item.href}
              onClick={close}
              aria-current={path === item.href ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <HeaderButton href={site.phoneHref} phone className="header-call">
            <span className="desktop-call">
              {vietnamese ? "Gọi" : "Call Us:"} {site.phone}
            </span>
            <span className="mobile-call">
              {vietnamese ? "Gọi ngay" : "Call Us"}
            </span>
          </HeaderButton>
          <HeaderButton
            href="/contact"
            className="header-contact"
            onClick={close}
          >
            {vietnamese ? "Liên hệ" : "Contact Us"}
          </HeaderButton>
          <button
            type="button"
            aria-label={
              vietnamese
                ? mobile
                  ? "Đóng menu"
                  : "Mở menu"
                : mobile
                  ? "Close menu"
                  : "Open menu"
            }
            aria-expanded={mobile}
            aria-controls="mobile-navigation"
            className="menu-toggle"
            onClick={() => {
              setMobile(!mobile);
              setDropdown(false);
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {mobile ? (
                <path d="m6 6 12 12M6 18 18 6" />
              ) : (
                <path d="M4 5h16M4 12h16M4 19h16" />
              )}
            </svg>
          </button>
        </div>
      </div>
      <AnimatePresence>
        {mobile && (
          <motion.div
            className="mobile-menu-panel"
            id="mobile-navigation"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={
              reduced
                ? { duration: 0 }
                : { type: "spring", duration: 0.4, bounce: 0.2 }
            }
          >
            <div className="mobile-menu-content">
              <nav
                className="mobile-nav"
                aria-label={
                  vietnamese
                    ? "Điều hướng trên điện thoại"
                    : "Mobile navigation"
                }
              >
                <Link href="/" className="nav-link" onClick={close}>
                  {vietnamese ? "Trang chủ" : "Home"}
                </Link>
                {links.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="nav-link"
                    onClick={close}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="mobile-menu-actions">
                <HeaderButton href={site.phoneHref} phone onClick={close}>
                  {vietnamese ? "Gọi" : "Call Us:"} {site.phone}
                </HeaderButton>
                <HeaderButton href="/contact" onClick={close}>
                  {vietnamese ? "Liên hệ" : "Contact Us"}
                </HeaderButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
