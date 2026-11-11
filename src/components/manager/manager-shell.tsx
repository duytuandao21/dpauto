"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AdminIcon } from "@/components/admin/admin-icon";
import { managerNavigation } from "@/lib/manager/mock";
import { ManagerProvider, useManager } from "./manager-provider";
import { ManagerModal } from "./manager-modal";

function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { theme, toggleTheme, data } = useManager();
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [account, setAccount] = useState(false);
  const [groups, setGroups] = useState<Record<string, boolean>>({});
  const current =
    managerNavigation
      .flatMap((group) => [...group.items])
      .find((item) => `/dieu-hanh${item.path}` === pathname) ??
    managerNavigation[0].items[0];
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
            alt="Trạm dịch vụ Toàn Trung"
            width={1448}
            height={1086}
            sizes="110px"
          />
          <span>
            <strong>TOÀN TRUNG</strong>
            <small>Điều hành cửa hàng</small>
          </span>
        </Link>
        <div className="mgr-station">
          <span className="adm-feature-icon">
            <AdminIcon name="car" />
          </span>
          <div>
            <strong>Trạm dịch vụ Toàn Trung</strong>
            <small>Không gian quản lý</small>
          </div>
        </div>
        <nav aria-label="Điều hướng quản lý cửa hàng">
          {managerNavigation.map((group) => (
            <div className="mgr-nav-group" key={group.title}>
              <button
                className="mgr-group-toggle"
                title={group.title}
                aria-expanded={!groups[group.title]}
                onClick={() =>
                  setGroups((value) => ({
                    ...value,
                    [group.title]: !value[group.title],
                  }))
                }
              >
                <span>{group.title}</span>
                <span aria-hidden="true">
                  {groups[group.title] ? "+" : "−"}
                </span>
              </button>
              {!groups[group.title] &&
                group.items.map((item) => (
                  <Link
                    key={item.path}
                    href={`/dieu-hanh${item.path}`}
                    title={item.label}
                    className={`mgr-nav-link ${pathname === `/dieu-hanh${item.path}` ? "is-active" : ""}`}
                    aria-label={item.label}
                    aria-current={
                      pathname === `/dieu-hanh${item.path}` ? "page" : undefined
                    }
                  >
                    <AdminIcon name={item.icon} />
                    <span>{item.label}</span>
                    {item.path === "/lich-hen" && <small>{pending}</small>}
                  </Link>
                ))}
            </div>
          ))}
        </nav>
        <div className="mgr-sidebar-footer">
          <span className="adm-avatar">QL</span>
          <div>
            <strong>Quản lý cửa hàng</strong>
          </div>
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
            <Link
              className="adm-icon-btn mgr-notification"
              aria-label="Thông báo"
              href="/dieu-hanh/canh-bao"
            >
              <AdminIcon name="bell" />
              <i />
            </Link>
            <div className="mgr-account-wrap">
              <button
                className="mgr-account"
                aria-label="Menu tài khoản quản lý"
                aria-expanded={account}
                onClick={() => setAccount(!account)}
              >
                <span className="adm-avatar">QL</span>
                <span>
                  <strong>Quản lý</strong>
                  <small>Quản lý cửa hàng</small>
                </span>
              </button>
              {account && (
                <div className="mgr-account-menu">
                  <strong>Quản lý cửa hàng</strong>
                  <Link
                    href="/dieu-hanh/cau-hinh"
                    onClick={() => setAccount(false)}
                  >
                    Cấu hình vận hành
                  </Link>
                  <Link href="/">Xem website</Link>
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
          <div className="mgr-session-notice" role="note">
            Dữ liệu mô phỏng · Thay đổi được giữ trong phiên hiện tại, chưa gửi
            đến hệ thống.
          </div>
          {children}
        </main>
        <footer className="mgr-footer">
          <strong>DPAuto · Toàn Trung</strong>
          <span>Không gian điều hành cửa hàng</span>
        </footer>
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
    <ManagerProvider>
      <Shell>{children}</Shell>
    </ManagerProvider>
  );
}
