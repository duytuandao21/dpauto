"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { signOut, useSession } from "@/components/admin/auth-gate";
import { request } from "@/lib/api/client";
import { CmsIcon, type CmsIconName } from "./icon";
import { Alert, Card, Menu, ToastProvider } from "./ui";
import {
  editPath,
  kindLabel,
  useApi,
  type DocSummary,
  type Kind,
  type Overview,
} from "./data";

type NavItem = {
  href: string;
  label: string;
  icon: CmsIconName;
  kinds?: Kind[];
};
export const nav: { title: string; items: NavItem[] }[] = [
  {
    title: "Tổng quan",
    items: [{ href: "/admin", label: "Tổng quan", icon: "dashboard" }],
  },
  {
    title: "Nội dung",
    items: [
      { href: "/admin/trang-chu", label: "Trang chủ", icon: "home" },
      {
        href: "/admin/dich-vu",
        label: "Dịch vụ",
        icon: "wrench",
        kinds: ["SERVICE"],
      },
      {
        href: "/admin/phu-kien",
        label: "Phụ kiện",
        icon: "package",
        kinds: ["ACCESSORY"],
      },
      {
        href: "/admin/thuong-hieu-danh-muc",
        label: "Thương hiệu & danh mục",
        icon: "layers",
        kinds: ["CATALOG"],
      },
      {
        href: "/admin/hang-xe",
        label: "Hãng & dòng xe",
        icon: "layers",
      },
      {
        href: "/admin/thanh-qua",
        label: "Thành quả",
        icon: "award",
        kinds: ["PROJECT"],
      },
      {
        href: "/admin/tin-tuc",
        label: "Tin tức",
        icon: "newspaper",
        kinds: ["NEWS"],
      },
      { href: "/admin/trang", label: "Các trang", icon: "file" },
    ],
  },
  {
    title: "Quản lý",
    items: [
      { href: "/admin/thu-vien-anh", label: "Thư viện ảnh", icon: "image" },
      { href: "/admin/seo", label: "SEO", icon: "globe", kinds: ["SEO"] },
      {
        href: "/admin/cai-dat",
        label: "Cài đặt website",
        icon: "settings",
        kinds: ["SETTINGS", "NAVIGATION"],
      },
    ],
  },
  {
    title: "Hệ thống",
    items: [
      { href: "/admin/lich-su", label: "Lịch sử", icon: "history" },
      { href: "/admin/tai-khoan", label: "Tài khoản", icon: "users" },
    ],
  },
];
const flat = nav.flatMap((g) => g.items);
const activeItem = (path: string) =>
  [...flat]
    .sort((a, b) => b.href.length - a.href.length)
    .find((i) =>
      i.href === "/admin" ? path === "/admin" : path.startsWith(i.href),
    );

function Search() {
  const [q, setQ] = useState(""),
    [results, setResults] = useState<DocSummary[]>([]),
    [open, setOpen] = useState(false),
    box = useRef<HTMLDivElement>(null),
    router = useRouter();
  useEffect(() => {
    if (q.trim().length < 2) return setResults([]);
    const a = new AbortController(),
      t = setTimeout(() => {
        request<DocSummary[]>(
          `admin/cms/documents?limit=8&search=${encodeURIComponent(q.trim())}`,
          { signal: a.signal },
        )
          .then((r) => setResults(r.data))
          .catch(() => {});
      }, 250);
    return () => {
      clearTimeout(t);
      a.abort();
    };
  }, [q]);
  useEffect(() => {
    const away = (e: MouseEvent) =>
      !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);
  const pages = flat.filter(
    (i) =>
      q.trim().length > 0 &&
      i.label.toLowerCase().includes(q.trim().toLowerCase()),
  );
  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };
  return (
    <div className="cms-header-search" ref={box} role="search">
      <CmsIcon name="search" />
      <input
        type="search"
        placeholder="Tìm nội dung, trang…"
        aria-label="Tìm nội dung"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
      />
      {open && (pages.length > 0 || results.length > 0) && (
        <div className="cms-search-results">
          {pages.map((p) => (
            <a
              key={p.href}
              href={p.href}
              onClick={(e) => (e.preventDefault(), go(p.href))}
            >
              <CmsIcon name={p.icon} />
              <span>{p.label}</span>
            </a>
          ))}
          {results.map((d) => (
            <a
              key={d.id}
              href={editPath(d.kind, d.key)}
              onClick={(e) => (e.preventDefault(), go(editPath(d.kind, d.key)))}
            >
              <CmsIcon name="file" />
              <span>
                {d.title}
                <small className="cms-help"> · {kindLabel[d.kind]}</small>
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export function CmsLayout({ children }: { children: ReactNode }) {
  const session = useSession(),
    path = usePathname(),
    [theme, setTheme] = useState<"light" | "dark">("light"),
    [collapsed, setCollapsed] = useState(false),
    [mobile, setMobile] = useState(false);
  const canRead = !!session?.permissions.includes("cms.read");
  const overview = useApi<Overview>(canRead ? "admin/cms/overview" : null);
  useEffect(() => {
    document.documentElement.lang = "vi";
    try {
      const t = localStorage.getItem("dpauto.cms.theme");
      if (t === "dark" || t === "light") setTheme(t);
      setCollapsed(localStorage.getItem("dpauto.cms.collapsed") === "1");
    } catch {}
  }, []);
  useEffect(() => setMobile(false), [path]);
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem("dpauto.cms.theme", next);
    } catch {}
  };
  const toggleMenu = () => {
    if (window.matchMedia("(max-width: 1023px)").matches)
      return setMobile(!mobile);
    setCollapsed(!collapsed);
    try {
      localStorage.setItem("dpauto.cms.collapsed", collapsed ? "0" : "1");
    } catch {}
  };
  const active = activeItem(path);
  const drafts = (kinds?: Kind[]) =>
    kinds?.reduce((n, k) => n + (overview.data?.kinds[k]?.drafts || 0), 0) || 0;
  const name = session?.staff.name || "Quản trị viên";
  const role = session?.roles.includes("CMS_ADMIN")
    ? "Quản trị nội dung"
    : "Quản lý";
  return (
    <div className="cms-app" data-theme={theme}>
      <ToastProvider>
        <a className="skip-link" href="#cms-main">
          Bỏ qua điều hướng
        </a>
        <div
          className="cms-layout"
          data-collapsed={collapsed}
          data-mobile-open={mobile}
        >
          <aside className="cms-sidebar" aria-label="Điều hướng quản trị">
            <Link className="cms-brand" href="/admin">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/site-logo/current" alt="" />
              <span>
                DPAuto
                <small>Trạm dịch vụ Toàn Trung</small>
              </span>
            </Link>
            <nav className="cms-nav">
              {nav.map((g) => (
                <div className="cms-nav-group" key={g.title}>
                  <p className="cms-nav-section">{g.title}</p>
                  {g.items.map((i) => (
                    <Link
                      key={i.href}
                      href={i.href}
                      className="cms-nav-item"
                      aria-current={
                        active?.href === i.href ? "page" : undefined
                      }
                    >
                      <CmsIcon name={i.icon} />
                      {i.label}
                      {drafts(i.kinds) > 0 && (
                        <span
                          className="cms-badge cms-badge-count"
                          title="Có thay đổi chưa áp dụng lên website"
                        >
                          {drafts(i.kinds)}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              ))}
            </nav>
            <div className="cms-nav-foot">
              <a
                className="cms-nav-item"
                href="/"
                target="_blank"
                rel="noreferrer"
              >
                <CmsIcon name="external" />
                Xem website
              </a>
              <Link
                className="cms-nav-item"
                href="/admin/tro-giup"
                aria-current={path === "/admin/tro-giup" ? "page" : undefined}
              >
                <CmsIcon name="help" />
                Trợ giúp
              </Link>
            </div>
          </aside>
          <div className="cms-scrim" onClick={() => setMobile(false)} />
          <div className="cms-main">
            <header className="cms-header">
              <button
                type="button"
                className="cms-btn cms-btn-ghost cms-btn-icon"
                aria-label="Thu gọn hoặc mở menu"
                onClick={toggleMenu}
              >
                <CmsIcon name="menu" size={18} />
              </button>
              <nav className="cms-breadcrumb" aria-label="Vị trí">
                <CmsIcon name="home" size={14} />
                <Link href="/admin">Quản trị</Link>
                {active && active.href !== "/admin" && (
                  <>
                    <span>/</span>
                    <strong>{active.label}</strong>
                  </>
                )}
              </nav>
              {canRead && <Search />}
              <div className="cms-header-actions">
                <button
                  type="button"
                  className="cms-btn cms-btn-ghost cms-btn-icon"
                  aria-label={
                    theme === "dark"
                      ? "Chuyển giao diện sáng"
                      : "Chuyển giao diện tối"
                  }
                  onClick={toggleTheme}
                >
                  <CmsIcon name={theme === "dark" ? "sun" : "moon"} size={18} />
                </button>
                <a
                  className="cms-btn cms-btn-ghost cms-btn-icon cms-hide-xs"
                  href="/"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Xem website"
                >
                  <CmsIcon name="external" size={18} />
                </a>
                <Menu
                  label="Tài khoản"
                  trigger={
                    <button
                      type="button"
                      className="cms-user"
                      aria-label="Mở menu tài khoản"
                    >
                      <span className="cms-avatar">
                        {name
                          .split(/\s+/)
                          .slice(-2)
                          .map((w) => w[0])
                          .join("")
                          .toUpperCase()}
                      </span>
                      <span>
                        <strong>{name}</strong>
                        <small>{role}</small>
                      </span>
                      <CmsIcon name="chevronDown" />
                    </button>
                  }
                >
                  {(close) => (
                    <>
                      <Link href="/admin/tai-khoan" onClick={close}>
                        <CmsIcon name="users" />
                        Tài khoản
                      </Link>
                      <div className="cms-menu-sep" />
                      <button type="button" onClick={() => void signOut()}>
                        <CmsIcon name="logout" />
                        Đăng xuất
                      </button>
                    </>
                  )}
                </Menu>
              </div>
            </header>
            <main className="cms-content" id="cms-main">
              {canRead || path === "/admin/tai-khoan" ? (
                children
              ) : (
                <Card title="Chưa có quyền quản trị nội dung">
                  <Alert tone="warn">
                    Tài khoản <strong>{name}</strong> chưa được cấp quyền{" "}
                    <code>cms.read</code>. Vào mục{" "}
                    <Link href="/admin/tai-khoan">Tài khoản</Link> để tạo tài
                    khoản quản trị nội dung, hoặc cấp quyền CMS cho tài khoản
                    này ở <code>/dieu-hanh/nhan-su</code>.
                  </Alert>
                </Card>
              )}
            </main>
          </div>
        </div>
      </ToastProvider>
    </div>
  );
}
