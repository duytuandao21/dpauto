"use client";
import { Suspense, useState, type ReactNode, type FormEvent } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AdminLoading, PageHeading } from "@/components/admin/primitives";
import { AuthGate, signOut, useSession } from "@/components/admin/auth-gate";
import { apiEnabled, command } from "@/lib/api/client";
import { LiveCms } from "./live-cms";
import { ManagerPanel } from "./manager-ui";
import { canProvisionCmsAccounts } from "@/lib/api/cms";
export function CmsShell({ children }: { children: ReactNode }) {
  return <AuthGate cms>{children}</AuthGate>;
}
export function CmsWorkspace() {
  return (
    <Suspense fallback={<AdminLoading />}>
      <CmsContent />
    </Suspense>
  );
}
function CmsContent() {
  const session = useSession();
  const canRead = !apiEnabled || session?.permissions.includes("cms.read");
  const requested = useSearchParams().get("tab"),
    router = useRouter();
  const tab: "content" | "news" | "media" | "seo" =
    requested === "news" || requested === "media" || requested === "seo"
      ? requested
      : "content";
  return (
    <div className="adv-stack">
      <PageHeading title="Quản trị website" />
      <nav className="mgr-tabs" aria-label="Quản trị website">
        {canRead && (
          [
            ["content", "Nội dung"],
            ["news", "Bài viết"],
            ["media", "Hình ảnh"],
            ["seo", "SEO"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            aria-pressed={tab === k}
            onClick={() => router.push("/admin?tab=" + k)}
          >
            {label}
          </button>
        ))}
        {apiEnabled && (
          <button type="button" onClick={() => void signOut()}>
            Đăng xuất
          </button>
        )}
      </nav>
      {canRead && <LiveCms key={tab} kind={tab} />}
      <CmsAccountForm />
    </div>
  );
}
export function CmsAccountForm() {
  const session = useSession(),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  if (!canProvisionCmsAccounts(session))
    return null;
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const f = e.currentTarget,
      d = new FormData(f);
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await command("admin/staff", {
        name: d.get("name"),
        phone: d.get("phone"),
        email: d.get("email"),
        jobRole: "MANAGER",
        active: true,
        account: {
          email: d.get("email"),
          temporaryPassword: d.get("password"),
          role: "CMS_ADMIN",
          permissions: [
            "cms.read",
            ...(d.has("write") ? ["cms.write"] : []),
            ...(d.has("publish") ? ["cms.publish"] : []),
          ],
        },
      });
      f.reset();
      setMessage(
        "Đã tạo tài khoản quản trị nội dung. Nhân viên cần đổi mật khẩu khi đăng nhập.",
      );
      window.dispatchEvent(new Event("dpauto-data-updated"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tạo tài khoản.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <ManagerPanel title="Tạo tài khoản quản trị website">
      <form className="adm-booking-form" onSubmit={save}>
        <fieldset disabled={busy}>
          <legend>Tài khoản nội dung website</legend>
          <div className="adm-form-grid">
            <label className="adm-field">
              Họ tên
              <input name="name" required maxLength={100} />
            </label>
            <label className="adm-field">
              Số điện thoại
              <input name="phone" required type="tel" />
            </label>
            <label className="adm-field">
              Email đăng nhập
              <input name="email" required type="email" />
            </label>
            <label className="adm-field">
              Mật khẩu tạm
              <input
                name="password"
                required
                type="password"
                minLength={15}
                maxLength={128}
                autoComplete="new-password"
              />
            </label>
          </div>
          <div className="adv-check-grid">
            <label>
              <input type="checkbox" name="write" defaultChecked /> Biên tập và
              tải ảnh
            </label>
            <label>
              <input type="checkbox" name="publish" /> Xuất bản và gỡ nội dung
            </label>
          </div>
          <button className="adm-btn adm-primary">Tạo tài khoản CMS</button>
        </fieldset>
      </form>
      {error && (
        <p role="alert" className="adm-error-text">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </ManagerPanel>
  );
}
