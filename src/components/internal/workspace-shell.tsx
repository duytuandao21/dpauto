"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { AdminIcon } from "@/components/admin/admin-icon";
import styles from "./workspace-shell.module.css";

// A shell for future workspaces, independent of the advisor's mock booking data.
// Workspace URLs are not authentication or authorization boundaries.
export function WorkspaceShell({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    document.documentElement.lang = "vi";
    try {
      const saved = localStorage.getItem("dpauto.admin.theme");
      if (saved === "dark" || saved === "light") setTheme(saved);
    } catch {}
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem("dpauto.admin.theme", next);
    } catch {}
  }

  return (
    <div className={`adm-app ${styles.shell}`} data-theme={theme} lang="vi">
      <a href="#workspace-main" className="adm-skip">
        Chuyển đến nội dung
      </a>
      <header className="adm-header">
        <Link href="/" className={`adm-header-brand ${styles.brand}`}>
          <Image
            src="/images/logo-dpauto.png"
            alt="Trạm dịch vụ Toàn Trung"
            width={1448}
            height={1086}
            sizes="80px"
          />
          <strong>
            Trạm dịch vụ <span>Toàn Trung</span>
          </strong>
        </Link>
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
          >
            <AdminIcon name={theme === "dark" ? "sun" : "moon"} />
          </button>
        </div>
      </header>
      <main id="workspace-main" className="adm-main" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
