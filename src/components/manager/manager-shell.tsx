"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { AdminIcon } from "@/components/admin/admin-icon";
import { managerNavigation } from "@/lib/manager/mock";
import { ManagerProvider, useManager } from "./manager-provider";
import { ManagerModal } from "./manager-modal";
import {
  AuthGate,
  phase1ManagerPath,
  signOut,
  useSession,
} from "@/components/admin/auth-gate";
import { canOpenCms } from "@/lib/api/cms";
import { apiEnabled } from "@/lib/api/client";
import { NotificationBell } from "@/components/advisor/notifications";
import { AdminLoading } from "@/components/admin/primitives";
import { managerSectionActive } from "@/lib/api/manager-presentation";

// Menu entries hidden until the account holds the matching sensitive grant.
const requiredPermission: Record<string, string> = {
  "/tai-chinh": "finance.read",
  "/kho": "inventory.read",
  "/nhat-ky": "audit.read",
  "/nhan-su": "staff.read",
};
// Phone bottom bar: the daily screens; the full menu opens from the header.
const bottomNav = ["", "/lich-hen", "/phieu-dich-vu", "/dieu-phoi"];
const collapseKey = "dpauto.manager.collapsed";

// Same shell markup as /co-van (AdminShell), so advisor-redesign.css styles it.
function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { theme, toggleTheme, data, ready, error, refresh } = useManager();
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const session = useSession(),
    name = session?.staff.name || "Quản lý",
    initials =
      name
        .trim()
        .split(/\s+/)
        .slice(-2)
        .map((w) => w[0])
        .join("")
        .toUpperCase() || "QL";
  const current =
    managerNavigation
      .flatMap((group) => [...group.items])
      .sort((a, b) => b.path.length - a.path.length)
      .find((item) => managerSectionActive(pathname, item.path)) ??
    (pathname.startsWith("/dieu-hanh/tiep-nhan/")
      ? { path: "/phieu-dich-vu", label: "Tiếp nhận xe", icon: "car" as const }
      : managerNavigation[0].items[0]);
  const pending = data.bookings.filter(
    (booking) => booking.status === "pending",
  ).length;
  const groups = managerNavigation
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          !apiEnabled ||
          (phase1ManagerPath(item.path) &&
            (!requiredPermission[item.path] ||
              !!session?.permissions.includes(requiredPermission[item.path]))),
      ),
    }))
    .filter((group) => group.items.length);
  useEffect(() => {
    setMobile(false);
  }, [pathname]);
  useEffect(() => {
    document.documentElement.lang = "vi";
    try {
      setCollapsed(localStorage.getItem(collapseKey) === "1");
    } catch {}
  }, []);
  const toggleNav = () => {
    setCollapsed(!collapsed);
    try {
      localStorage.setItem(collapseKey, collapsed ? "0" : "1");
    } catch {}
  };
  const footerLinks = (linkClass: string, label?: string) => (
    <>
      {session && canOpenCms(session) && (
        <Link
          href="/admin"
          className={linkClass}
          title="Quản trị website"
          aria-label="Quản trị website"
        >
          <AdminIcon name="globe" />
          <span className={label}>Quản trị website</span>
        </Link>
      )}
      <Link
        href="/"
        className={linkClass}
        title="Xem website"
        aria-label="Xem website"
      >
        <AdminIcon name="website" />
        <span className={label}>Xem website</span>
      </Link>
      {apiEnabled && (
        <button
          type="button"
          className={linkClass}
          title="Đăng xuất"
          aria-label="Đăng xuất"
          onClick={() => void signOut()}
        >
          <AdminIcon name="logout" />
          <span className={label}>Đăng xuất</span>
        </button>
      )}
    </>
  );
  const brandLogo = (sizes: string) => (
    <Image
      className="adm-sidebar-logo"
      src="/images/logo-dpauto.png"
      alt=""
      width={1448}
      height={1086}
      sizes={sizes}
    />
  );
  return (
    <div
      // mgr-desktop-scale sizes the page content on desktop (manager.css); its shell rules target retired classes.
      className={`adm-app adv-ui mgr-app mgr-desktop-scale ${collapsed ? "adm-collapsed" : ""}`}
      data-theme={theme}
      lang="vi"
    >
      <a href="#manager-main" className="adm-skip">
        Chuyển đến nội dung
      </a>
      <aside
        id="manager-navigation"
        className="adm-sidebar"
        aria-label="Điều hướng quản lý cửa hàng"
      >
        <Link href="/dieu-hanh" className="adm-sidebar-brand">
          {brandLogo("64px")}
          <span className="adm-sidebar-label">
            <strong>DPAuto</strong>
            <small>Điều hành cửa hàng</small>
          </span>
        </Link>
        <nav className="adv-nav">
          {groups.map((group) => (
            <Fragment key={group.title}>
              <span className="adm-nav-group">{group.title}</span>
              {group.items.map((item) => (
                <Link
                  key={item.path}
                  href={`/dieu-hanh${item.path}`}
                  className={`adm-nav-link ${current.path === item.path ? "is-active" : ""}`}
                  aria-current={current.path === item.path ? "page" : undefined}
                  aria-label={item.label}
                  title={item.label}
                >
                  <AdminIcon name={item.icon} />
                  <span className="adm-sidebar-label">{item.label}</span>
                  {item.path === "/lich-hen" && pending > 0 && (
                    <span className="adm-nav-count">{pending}</span>
                  )}
                </Link>
              ))}
            </Fragment>
          ))}
        </nav>
        <div className="adm-sidebar-bottom">{footerLinks("adm-nav-link", "adm-sidebar-label")}</div>
      </aside>
      <div className="adm-body">
        <header className="adm-header">
          <Link href="/dieu-hanh" className="adm-header-brand">
            {brandLogo("80px")}
            <span>
              <strong>
                Trạm dịch vụ <span>Toàn Trung</span>
              </strong>
            </span>
          </Link>
          <button
            type="button"
            className="adm-icon-btn adm-collapse adv-sidebar-toggle"
            onClick={toggleNav}
            aria-label={
              collapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"
            }
            title={
              collapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"
            }
            aria-expanded={!collapsed}
            aria-controls="manager-navigation"
          >
            <AdminIcon name="collapse" />
          </button>
          <nav className="adm-header-breadcrumb" aria-label="Vị trí">
            <Link href="/dieu-hanh">Điều hành</Link>
            {current !== managerNavigation[0].items[0] && (
              <>
                <span aria-hidden="true">/</span>
                <strong>{current.label}</strong>
              </>
            )}
          </nav>
          <div className="adm-header-actions">
            <button
              type="button"
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
            {apiEnabled ? (
              <NotificationBell base="/dieu-hanh" />
            ) : (
              <Link
                className="adm-icon-btn adm-notification"
                aria-label="Thông báo"
                href="/dieu-hanh/thong-bao"
              >
                <AdminIcon name="bell" />
              </Link>
            )}
            <span className="adv-user" title={name}>
              <span className="adm-avatar" aria-hidden="true">
                {initials}
              </span>
              <span className="adv-user-name">
                <strong>{name}</strong>
                <small>Quản lý cửa hàng</small>
              </span>
            </span>
            <button
              type="button"
              className="adm-icon-btn mgr-mobile-toggle"
              aria-label="Mở điều hướng"
              onClick={() => setMobile(true)}
            >
              <AdminIcon name="more" />
            </button>
          </div>
        </header>
        <main id="manager-main" className="adm-main" tabIndex={-1}>
          {error ? (
            <section className="adm-panel" role="alert">
              <h1>Không tải được dữ liệu điều hành</h1>
              <p>{error}</p>
              <button
                className="adm-btn"
                onClick={() => void refresh?.().catch(() => {})}
              >
                Tải lại
              </button>
            </section>
          ) : ready === false ? (
            <AdminLoading />
          ) : (
            children
          )}
        </main>
      </div>
      <nav className="adm-bottom-nav" aria-label="Điều hướng trên điện thoại">
        {groups
          .flatMap((group) => group.items)
          .filter((item) => bottomNav.includes(item.path))
          .map((item) => (
            <Link
              key={item.path}
              href={`/dieu-hanh${item.path}`}
              className={current.path === item.path ? "is-active" : ""}
              aria-current={current.path === item.path ? "page" : undefined}
            >
              <AdminIcon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          ))}
      </nav>
      {mobile && (
        <ManagerModal
          title="Điều hướng"
          theme={theme}
          onClose={() => setMobile(false)}
          drawer
        >
          {/* The drawer keeps its own light-menu markup (manager-operations.css). */}
          <div
            className="mgr-mobile-menu"
            onClick={(event) => {
              if ((event.target as Element).closest("a")) setMobile(false);
            }}
          >
            <Link href="/dieu-hanh" className="mgr-brand">
              {brandLogo("64px")}
              <span>
                <strong>DPAuto</strong>
                <small>Điều hành cửa hàng</small>
              </span>
            </Link>
            <nav aria-label="Điều hướng quản lý cửa hàng">
              {groups.map((group) => (
                <div className="mgr-nav-group" key={group.title}>
                  <p className="mgr-group-title">{group.title}</p>
                  {group.items.map((item) => (
                    <Link
                      key={item.path}
                      href={`/dieu-hanh${item.path}`}
                      className={`mgr-nav-link ${current.path === item.path ? "is-active" : ""}`}
                      aria-current={
                        current.path === item.path ? "page" : undefined
                      }
                    >
                      <AdminIcon name={item.icon} />
                      <span>{item.label}</span>
                      {item.path === "/lich-hen" && pending > 0 && (
                        <small>{pending}</small>
                      )}
                    </Link>
                  ))}
                </div>
              ))}
            </nav>
            <div className="mgr-sidebar-footer">
              {footerLinks("mgr-nav-link")}
            </div>
          </div>
        </ManagerModal>
      )}
    </div>
  );
}
export function ManagerShell({ children }: { children: ReactNode }) {
  return (
    <AuthGate manager>
      <ManagerProvider>
        <Shell>{children}</Shell>
      </ManagerProvider>
    </AuthGate>
  );
}
