"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminIcon, type AdminIconName } from "./admin-icon";
import { BookingProvider, useBookings } from "./booking-provider";
import { AdvisorProvider } from "@/components/advisor/advisor-provider";

const nav: { href: string; label: string; icon: AdminIconName }[] = [
  { href: "/co-van", label: "Tổng quan", icon: "overview" },
  { href: "/co-van/lich-hen", label: "Lịch hẹn", icon: "calendar" },
  { href: "/co-van/phieu-dich-vu", label: "Xe dịch vụ", icon: "car" },
  { href: "/co-van/khach-hang", label: "Khách hàng", icon: "customers" },
  { href: "/co-van/tai-khoan", label: "Tài khoản", icon: "user" },
];
function ShellContent({ children }: { children: React.ReactNode }) {
  const path = usePathname(),
    { data, ask, theme, toggleTheme } = useBookings();
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    document.documentElement.lang = "vi";
  }, []);
  const active = (href: string) =>
    href === "/co-van" ? path === href : path.startsWith(href);
  const pending = data.bookings.filter((b) => b.status === "pending").length;
  const current = active("/co-van/tiep-nhan")
    ? { label: "Tiếp nhận xe", icon: "car" as const }
    : active("/co-van/xe")
      ? { label: "Hồ sơ xe", icon: "car" as const }
      : active("/co-van/tuy-chon")
        ? { label: "Tùy chọn cá nhân", icon: "settings" as const }
        : [...nav].reverse().find((item) => active(item.href)) || nav[0];
  const selectedNav = (href: string) =>
    active(href) ||
    (href === "/co-van/lich-hen" && active("/co-van/tiep-nhan")) ||
    (href === "/co-van/khach-hang" && active("/co-van/xe")) ||
    (href === "/co-van/tai-khoan" && active("/co-van/tuy-chon"));
  return (
    <div
      className={`adm-app ${collapsed ? "adm-collapsed" : ""}`}
      data-theme={theme}
      lang="vi"
    >
      <a href="#admin-main" className="adm-skip">
        Chuyển đến nội dung quản lý
      </a>
      <aside className="adm-sidebar" aria-label="Điều hướng quản lý">
        <Link href="/co-van" className="adm-sidebar-brand">
          <Image
            className="adm-sidebar-logo"
            src="/images/logo-dpauto.png"
            alt="Trạm dịch vụ Toàn Trung"
            width={1448}
            height={1086}
            sizes="64px"
          />
          <span className="adm-sidebar-label">
            <strong>Trạm dịch vụ Toàn Trung</strong>
            <small>Cố vấn dịch vụ</small>
          </span>
        </Link>
        <Link
          href="/co-van/lich-hen/tao-moi"
          className="adm-btn adm-primary adm-sidebar-create"
          aria-label="Tạo lịch hẹn mới"
        >
          <AdminIcon name="plus" />
          <span className="adm-sidebar-label">Tạo lịch hẹn</span>
        </Link>
        <span className="adm-nav-group">Vận hành</span>
        <nav>
          {nav.map((item, i) => (
            <div key={item.href}>
              {i === 4 && <span className="adm-nav-group">Cá nhân</span>}
              <Link
                href={item.href}
                className={`adm-nav-link ${selectedNav(item.href) ? "is-active" : ""}`}
                aria-current={selectedNav(item.href) ? "page" : undefined}
                aria-label={item.label}
                title={item.label}
              >
                <AdminIcon name={item.icon} />
                <span className="adm-sidebar-label">{item.label}</span>
                {item.icon === "calendar" && pending > 0 && (
                  <span className="adm-nav-count">{pending}</span>
                )}
              </Link>
            </div>
          ))}
        </nav>
        <div className="adm-sidebar-bottom">
          <Link
            href="/"
            className="adm-nav-link"
            title="Xem website"
            aria-label="Xem website"
          >
            <AdminIcon name="logout" />
            <span className="adm-sidebar-label">Xem website</span>
          </Link>
          <button
            className="adm-nav-link adm-collapse"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
            aria-label={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
          >
            <AdminIcon name="collapse" />
            <span className="adm-sidebar-label">Thu gọn</span>
          </button>
          <div className="adm-advisor">
            <span className="adm-avatar">CV</span>
            <span className="adm-sidebar-label">
              <strong>Cố vấn dịch vụ</strong>
              <small>Không gian làm việc</small>
            </span>
          </div>
        </div>
      </aside>
      <div className="adm-body">
        <header className="adm-header">
          <Link href="/co-van" className="adm-header-brand">
            <Image
              src="/images/logo-dpauto.png"
              alt="Trạm dịch vụ Toàn Trung"
              width={1448}
              height={1086}
              sizes="80px"
            />
            <span>
              <strong>
                Trạm dịch vụ <span>Toàn Trung</span>
              </strong>
            </span>
          </Link>
          <div className="adm-header-breadcrumb">
            <AdminIcon name={current.icon} />
            <span>Không gian quản lý</span>
            <span className="adm-crumb-divider">/</span>
            <strong>{current.label}</strong>
          </div>
          <div className="adm-header-actions">
            <button
              className="adm-icon-btn"
              onClick={toggleTheme}
              aria-label={
                theme === "dark"
                  ? "Chuyển sang chế độ sáng"
                  : "Chuyển sang chế độ tối"
              }
              title={theme === "dark" ? "Chế độ sáng" : "Chế độ tối"}
            >
              <AdminIcon name={theme === "dark" ? "sun" : "moon"} />
            </button>
            <button
              className="adm-icon-btn adm-notification"
              aria-label="Thông báo"
              onClick={() =>
                ask({
                  title: "Thông báo lịch hẹn",
                  message: `Có ${pending} lịch đang chờ xác nhận. Bạn có thể xem và xử lý tại mục Lịch hẹn.`,
                  label: "Đã hiểu",
                  onConfirm: () => {},
                })
              }
            >
              <AdminIcon name="bell" />
              {pending > 0 && <i />}
            </button>
            <Link
              href="/co-van/tai-khoan"
              className="adm-avatar"
              aria-label="Tài khoản cố vấn"
            >
              CV
            </Link>
          </div>
        </header>
        <main id="admin-main" className="adm-main" tabIndex={-1}>
          {children}
        </main>
      </div>
      <nav className="adm-bottom-nav" aria-label="Điều hướng trên điện thoại">
        {nav
          .filter((item) => item.href !== "/co-van/tai-khoan")
          .map((item) => {
            const selected = selectedNav(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={selected ? "is-active" : ""}
                aria-current={selected ? "page" : undefined}
              >
                <AdminIcon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            );
          })}
      </nav>
    </div>
  );
}
export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <BookingProvider>
      <AdvisorProvider>
        <ShellContent>{children}</ShellContent>
      </AdvisorProvider>
    </BookingProvider>
  );
}
