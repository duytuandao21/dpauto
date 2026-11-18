"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminIcon, type AdminIconName } from "./admin-icon";
import { BookingProvider, useBookings } from "./booking-provider";
import { AdvisorProvider } from "@/components/advisor/advisor-provider";
import { AuthGate, signOut, useSession } from "./auth-gate";
import { AdminLoading } from "./primitives";
import { apiEnabled } from "@/lib/api/client";

const nav: { href: string; label: string; icon: AdminIconName }[] = [
  { href: "/co-van", label: "Tổng quan", icon: "overview" },
  { href: "/co-van/lich-hen", label: "Lịch hẹn", icon: "calendar" },
  { href: "/co-van/phieu-dich-vu", label: "Phiếu dịch vụ", icon: "car" },
  { href: "/co-van/khach-hang", label: "Khách hàng", icon: "customers" },
  { href: "/co-van/thong-bao", label: "Thông báo", icon: "bell" },
  { href: "/co-van/tai-khoan", label: "Tài khoản", icon: "user" },
];
const mainNav = nav.filter(
  (item) => !["/co-van/tai-khoan", "/co-van/thong-bao"].includes(item.href),
);
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "CV";
function ShellContent({ children }: { children: React.ReactNode }) {
  const path = usePathname(),
    { data, theme, toggleTheme, ready, error, reset } = useBookings();
  const [collapsed, setCollapsed] = useState(true);
  const sessionName = useSession()?.staff.name,
    staffName = sessionName || "Cố vấn dịch vụ",
    avatar = sessionName ? initials(sessionName) : "CV";
  useEffect(() => {
    document.documentElement.lang = "vi";
    // Scopes the advisor redesign styles to this workspace only.
    document.body.dataset.workspace = "advisor";
    return () => {
      delete document.body.dataset.workspace;
    };
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
        : active("/co-van/lich-su")
          ? { label: "Lịch đã bàn giao", icon: "time" as const }
          : [...nav].reverse().find((item) => active(item.href)) || nav[0];
  const selectedNav = (href: string) =>
    active(href) ||
    (href === "/co-van/lich-hen" && active("/co-van/tiep-nhan")) ||
    (href === "/co-van/khach-hang" && active("/co-van/xe")) ||
    (href === "/co-van/tai-khoan" &&
      (active("/co-van/tuy-chon") || active("/co-van/lich-su")));
  return (
    <div
      className={`adm-app adv-ui ${collapsed ? "adm-collapsed" : ""}`}
      data-theme={theme}
      lang="vi"
    >
      <a href="#admin-main" className="adm-skip">
        Chuyển đến nội dung quản lý
      </a>
      <aside
        id="advisor-navigation"
        className="adm-sidebar"
        aria-label="Điều hướng quản lý"
      >
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
        <button
          type="button"
          className="adm-icon-btn adm-collapse adv-sidebar-toggle"
          onClick={() => setCollapsed(!collapsed)}
          title={
            collapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"
          }
          aria-label={
            collapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"
          }
          aria-expanded={!collapsed}
          aria-controls="advisor-navigation"
        >
          <AdminIcon name="collapse" />
        </button>
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
          {mainNav.map((item) => (
            <div key={item.href}>
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
            <AdminIcon name="website" />
            <span className="adm-sidebar-label">Xem website</span>
          </Link>
          {apiEnabled && (
            <button
              className="adm-nav-link"
              onClick={() => void signOut()}
              title="Đăng xuất"
              aria-label="Đăng xuất"
            >
              <AdminIcon name="logout" />
              <span className="adm-sidebar-label">Đăng xuất</span>
            </button>
          )}
          <div className="adm-advisor">
            <span className="adm-avatar" aria-hidden="true">
              {avatar}
            </span>
            <span className="adm-sidebar-label">
              <strong>{staffName}</strong>
              <small>Cố vấn dịch vụ</small>
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
            <Link
              className="adm-icon-btn adm-notification"
              aria-label="Thông báo"
              href="/co-van/thong-bao"
            >
              <AdminIcon name="bell" />
            </Link>
            <Link
              href="/co-van/tai-khoan"
              className="adm-avatar"
              aria-label={`Tài khoản: ${staffName}`}
              title={staffName}
            >
              {avatar}
            </Link>
          </div>
        </header>
        <main id="admin-main" className="adm-main" tabIndex={-1}>
          {!ready ? (
            <AdminLoading />
          ) : error ? (
            <section className="adm-panel" role="alert">
              <h1>Không tải được dữ liệu</h1>
              <p>{error}</p>
              <button className="adm-btn" onClick={reset}>
                Tải lại
              </button>
            </section>
          ) : (
            children
          )}
        </main>
      </div>
      <nav className="adm-bottom-nav" aria-label="Điều hướng trên điện thoại">
        {mainNav.map((item) => {
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
    <AuthGate>
      <BookingProvider>
        <AdvisorProvider>
          <ShellContent>{children}</ShellContent>
        </AdvisorProvider>
      </BookingProvider>
    </AuthGate>
  );
}
