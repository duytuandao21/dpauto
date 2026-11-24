"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
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
function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { theme, toggleTheme, data, ready, error, refresh } = useManager();
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [account, setAccount] = useState(false);
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
  useEffect(() => {
    setMobile(false);
    setAccount(false);
  }, [pathname]);
  function menu() {
    return (
      <>
        <Link href="/dieu-hanh" className="mgr-brand">
          <Image
            src="/images/logo-dpauto.png"
            alt=""
            width={1448}
            height={1086}
            sizes="64px"
          />
          <span>
            <strong>DPAuto</strong>
            <small>Điều hành cửa hàng</small>
          </span>
        </Link>
        <nav aria-label="Điều hướng quản lý cửa hàng">
          {managerNavigation
            .map((group) => ({
              ...group,
              items: group.items.filter(
                (item) =>
                  !apiEnabled ||
                  (phase1ManagerPath(item.path) &&
                    (!requiredPermission[item.path] ||
                      !!session?.permissions.includes(
                        requiredPermission[item.path],
                      ))),
              ),
            }))
            .filter((group) => group.items.length)
            .map((group) => (
              <div className="mgr-nav-group" key={group.title}>
                <p className="mgr-group-title">{group.title}</p>
                {group.items.map((item) => (
                  <Link
                    key={item.path}
                    href={`/dieu-hanh${item.path}`}
                    title={item.label}
                    className={`mgr-nav-link ${current.path === item.path ? "is-active" : ""}`}
                    aria-label={item.label}
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
          {session && canOpenCms(session) && (
            <Link
              href="/admin"
              className="mgr-nav-link"
              title="Quản trị website"
            >
              <AdminIcon name="settings" />
              <span>Quản trị website</span>
            </Link>
          )}
          <Link href="/" className="mgr-nav-link" title="Xem website">
            <AdminIcon name="website" />
            <span>Xem website</span>
          </Link>
          {apiEnabled && (
            <button
              type="button"
              className="mgr-nav-link"
              title="Đăng xuất"
              onClick={() => void signOut()}
            >
              <AdminIcon name="logout" />
              <span>Đăng xuất</span>
            </button>
          )}
        </div>
      </>
    );
  }
  return (
    <div
      className={`adm-app mgr-app mgr-desktop-scale ${collapsed ? "mgr-collapsed" : ""}`}
      data-theme={theme}
      lang="vi"
    >
      <a href="#manager-main" className="adm-skip">
        Chuyển đến nội dung
      </a>
      <aside className="mgr-sidebar">{menu()}</aside>
      <div className="mgr-body">
        <header className="mgr-header">
          <button
            className="adm-icon-btn mgr-desktop-toggle"
            aria-label={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
            onClick={() => setCollapsed(!collapsed)}
          >
            <AdminIcon name="collapse" />
          </button>
          <button
            className="adm-icon-btn mgr-mobile-toggle"
            aria-label="Mở điều hướng"
            onClick={() => setMobile(true)}
          >
            <AdminIcon name="more" />
          </button>
          <div className="mgr-breadcrumb">
            <Link href="/dieu-hanh">Điều hành</Link>
            <span>/</span>
            <strong>{current.label}</strong>
          </div>
          <div className="mgr-header-actions">
            <button
              className="adm-icon-btn"
              onClick={toggleTheme}
              aria-label={
                theme === "light"
                  ? "Chuyển sang chế độ tối"
                  : "Chuyển sang chế độ sáng"
              }
            >
              <AdminIcon name={theme === "light" ? "moon" : "sun"} />
            </button>
            {apiEnabled ? (
              <NotificationBell base="/dieu-hanh" />
            ) : (
              <Link
                className="adm-icon-btn mgr-notification"
                aria-label="Thông báo"
                href="/dieu-hanh/thong-bao"
              >
                <AdminIcon name="bell" />
              </Link>
            )}
            <div className="mgr-account-wrap">
              <button
                className="mgr-account"
                aria-label="Menu tài khoản quản lý"
                aria-expanded={account}
                onClick={() => setAccount(!account)}
              >
                <span className="adm-avatar">{initials}</span>
                <span>
                  <strong>{name}</strong>
                  <small>Quản lý cửa hàng</small>
                </span>
              </button>
              {account && (
                <div className="mgr-account-menu">
                  <strong>{name}</strong>
                  <Link
                    href="/dieu-hanh/cau-hinh"
                    onClick={() => setAccount(false)}
                  >
                    Cấu hình vận hành
                  </Link>
                  <Link href="/">Xem website</Link>
                  {apiEnabled && (
                    <button
                      className="adm-text-link"
                      onClick={() => void signOut()}
                    >
                      Đăng xuất
                    </button>
                  )}
                  <button
                    className="adm-text-link"
                    onClick={() => setAccount(false)}
                  >
                    Đóng menu
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main id="manager-main" className="mgr-main" tabIndex={-1}>
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
      {mobile && (
        <ManagerModal
          title="Điều hướng"
          theme={theme}
          onClose={() => setMobile(false)}
          drawer
        >
          <div
            className="mgr-mobile-menu"
            onClick={(event) => {
              if ((event.target as Element).closest("a")) setMobile(false);
            }}
          >
            {menu()}
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
