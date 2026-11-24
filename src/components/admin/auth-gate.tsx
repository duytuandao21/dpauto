"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { apiEnabled, request, command, ApiFailure } from "@/lib/api/client";
import type { AuthSession } from "@/lib/api/types";
import { canOpenCms } from "@/lib/api/cms";
import { AdminLoading } from "./primitives";
import {
  Alert,
  Button,
  Field,
  Input,
  Loading,
  Switch,
} from "@/components/cms/ui";

const SessionContext = createContext<AuthSession | null>(null);
export const useSession = () => useContext(SessionContext);
export async function signOut() {
  await command("admin/auth/logout");
  window.dispatchEvent(new Event("dpauto-session-expired"));
}
const managerPages = [
  "",
  "/lich-hen",
  "/nang-luc",
  "/dich-vu",
  "/nhan-su",
  "/khach-hang",
  "/doi-tac",
  "/cau-hinh",
  "/nhat-ky",
  "/phieu-dich-vu",
  "/dieu-phoi",
  "/bao-gia",
  "/kho",
  "/tai-chinh",
  "/tiep-nhan/truc-tiep",
  "/bao-cao",
  "/canh-bao",
  "/thong-bao",
];
export function phase1ManagerPath(path: string) {
  return (
    managerPages.includes(path) ||
    /^\/tai-chinh\/[a-f\d-]{36}$/.test(path) ||
    /^\/(phieu-dich-vu|tiep-nhan)\/[a-f\d-]{36}$/.test(path) ||
    /^\/phieu-dich-vu\/[a-f\d-]{36}\/in-(bao-gia|nghiem-thu)$/.test(path)
  );
}
export function AuthGate({
  children,
  manager = false,
  cms = false,
}: {
  children: ReactNode;
  manager?: boolean;
  cms?: boolean;
}) {
  const path = usePathname();
  const [session, setSession] = useState<AuthSession | null>(null),
    [ready, setReady] = useState(false),
    [error, setError] = useState("");
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [next, setNext] = useState(""),
    [confirm, setConfirm] = useState(""),
    [busy, setBusy] = useState(false),
    [reveal, setReveal] = useState(false);
  // Advisor and manager share the redesigned login; /admin (cms) has its own below.
  const advisor = !cms,
    secret = advisor && reveal ? "text" : "password";
  const [cmsTheme, setCmsTheme] = useState("light");
  useEffect(() => {
    try {
      if (cms && localStorage.getItem("dpauto.cms.theme") === "dark")
        setCmsTheme("dark");
    } catch {}
  }, [cms]);
  useEffect(() => {
    if (!apiEnabled) return;
    let active = true;
    const load = () =>
      request<AuthSession>("admin/auth/me")
        .then((r) => {
          if (active) {
            setSession(r.data);
            setError("");
          }
        })
        .catch((e) => {
          if (active) {
            setSession(null);
            if (!(e instanceof ApiFailure && e.status === 401))
              setError(e.message);
          }
        })
        .finally(() => {
          if (active) setReady(true);
        });
    const expired = () => {
      setSession(null);
      setPassword("");
    };
    void load();
    window.addEventListener("dpauto-session-expired", expired);
    window.addEventListener("focus", load);
    return () => {
      active = false;
      window.removeEventListener("dpauto-session-expired", expired);
      window.removeEventListener("focus", load);
    };
  }, []);
  if (!apiEnabled) return children;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (session?.mustChangePassword) {
        if (next !== confirm)
          throw new Error("Hai mật khẩu mới chưa trùng khớp.");
        const r = await command<AuthSession>("admin/auth/change-password", {
          currentPassword: password,
          newPassword: next,
        });
        setSession(r.data);
        setNext("");
        setConfirm("");
      } else {
        await request("admin/auth/csrf");
        const r = await command<AuthSession>("admin/auth/login", {
          email: email.trim(),
          password,
        });
        setSession(r.data);
      }
      setPassword("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể đăng nhập.");
    } finally {
      setBusy(false);
    }
  }
  if (cms && (!ready || !session || session.mustChangePassword))
    return (
      <div className="cms-app cms-login" data-theme={cmsTheme}>
        <main className="cms-card cms-login-card">
          <div className="cms-login-brand">
            <Image
              // The logo uploaded in "Cài đặt website", or the built-in one.
              src="/site-logo/current"
              alt=""
              width={1448}
              height={1086}
              unoptimized
              priority
            />
            <span>
              DPAuto
              <small>Trạm dịch vụ Toàn Trung</small>
            </span>
          </div>
          {!ready ? (
            <Loading rows={3} />
          ) : (
            <>
              <h1>{session ? "Đổi mật khẩu" : "Đăng nhập quản trị website"}</h1>
              <p className="cms-help">
                {session
                  ? "Đặt mật khẩu mới trước khi tiếp tục."
                  : "Dùng tài khoản được cấp quyền quản trị nội dung."}
              </p>
              <form onSubmit={submit} className="cms-stack">
                {!session && (
                  <Field label="Email">
                    <Input
                      type="email"
                      autoComplete="username"
                      required
                      autoFocus
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </Field>
                )}
                <Field label={session ? "Mật khẩu hiện tại" : "Mật khẩu"}>
                  <Input
                    type={reveal ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </Field>
                {session && (
                  <>
                    <Field label="Mật khẩu mới" help="Từ 15 đến 128 ký tự.">
                      <Input
                        type={reveal ? "text" : "password"}
                        autoComplete="new-password"
                        minLength={15}
                        maxLength={128}
                        required
                        value={next}
                        onChange={(e) => setNext(e.target.value)}
                      />
                    </Field>
                    <Field label="Nhập lại mật khẩu mới">
                      <Input
                        type={reveal ? "text" : "password"}
                        autoComplete="new-password"
                        required
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                      />
                    </Field>
                  </>
                )}
                <Switch
                  label="Hiện mật khẩu"
                  checked={reveal}
                  onChange={setReveal}
                />
                {error && <Alert tone="danger">{error}</Alert>}
                <Button
                  variant="primary"
                  type="submit"
                  disabled={busy}
                  className="cms-login-submit"
                >
                  {busy
                    ? "Đang xử lý…"
                    : session
                      ? "Lưu mật khẩu"
                      : "Đăng nhập"}
                </Button>
              </form>
            </>
          )}
        </main>
        <a className="cms-link cms-login-back" href="/">
          ← Về website
        </a>
      </div>
    );
  if (!ready)
    return (
      <div className="adm-app" data-theme="light">
        <AdminLoading />
      </div>
    );
  if (!session || session.mustChangePassword)
    return (
      <div
        className={`adm-app${advisor ? " adv-ui adv-login" : ""}`}
        data-theme="light"
      >
        <main className="adm-main">
          <section className="adm-panel adm-form-page">
            {advisor && (
              <Image
                className="adv-login-logo"
                src="/images/logo-dpauto.png"
                alt="Trạm dịch vụ Toàn Trung"
                width={1448}
                height={1086}
                sizes="120px"
                priority
              />
            )}
            <h1>{session ? "Đổi mật khẩu" : "Đăng nhập"}</h1>
            <p>
              {advisor
                ? `${manager ? "Quản lý cửa hàng" : "Cố vấn dịch vụ"} · Trạm dịch vụ Toàn Trung`
                : "Trạm dịch vụ Toàn Trung"}
            </p>
            <form onSubmit={submit} className="adm-booking-form">
              {!session && (
                <label className="adm-field">
                  Email
                  <input
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
              )}
              <label className="adm-field">
                {session ? "Mật khẩu hiện tại" : "Mật khẩu"}
                <input
                  type={secret}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              {session && (
                <>
                  <label className="adm-field">
                    Mật khẩu mới
                    <input
                      type={secret}
                      autoComplete="new-password"
                      minLength={15}
                      maxLength={128}
                      required
                      value={next}
                      onChange={(e) => setNext(e.target.value)}
                    />
                  </label>
                  <label className="adm-field">
                    Nhập lại mật khẩu mới
                    <input
                      type={secret}
                      autoComplete="new-password"
                      required
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                    />
                  </label>
                  <p className="adm-field-help">Từ 15 đến 128 ký tự.</p>
                </>
              )}
              {advisor && (
                <label className="adv-login-reveal">
                  <input
                    type="checkbox"
                    checked={reveal}
                    onChange={(e) => setReveal(e.target.checked)}
                  />
                  Hiện mật khẩu
                </label>
              )}
              {error && (
                <p className="adm-error-text" role="alert">
                  {error}
                </p>
              )}
              <button className="adm-btn adm-primary" disabled={busy}>
                {busy ? "Đang xử lý…" : session ? "Lưu mật khẩu" : "Đăng nhập"}
              </button>
            </form>
          </section>
        </main>
      </div>
    );
  if (cms && !canOpenCms(session))
    return (
      <div className="cms-app cms-login" data-theme={cmsTheme}>
        <main className="cms-card cms-login-card">
          <h1>Bạn không có quyền truy cập khu vực này</h1>
          <p className="cms-help">
            Tài khoản {session.staff.name} chưa được cấp quyền quản trị website.
          </p>
          <div className="cms-actions">
            <a className="cms-btn cms-btn-primary" href="/co-van">
              Mở khu vực được cấp quyền
            </a>
            <Button onClick={() => void signOut()}>Đăng xuất</Button>
          </div>
        </main>
      </div>
    );
  if (
    (manager && !session.roles.includes("MANAGER")) ||
    (cms && !canOpenCms(session)) ||
    (!manager && !cms && session.roles.includes("CMS_ADMIN"))
  )
    return (
      <div className="adm-app adv-ui adv-login" data-theme="light">
        <main className="adm-main">
          <section className="adm-panel adm-form-page">
            <h1>Không có quyền truy cập</h1>
            <p>
              Tài khoản {session.staff.name} chưa được cấp quyền vào khu vực
              này.
            </p>
            <div className="adv-actions">
              <Link
                className="adm-btn adm-primary"
                href={
                  session.roles.includes("CMS_ADMIN")
                    ? "/admin"
                    : session.roles.includes("MANAGER")
                      ? "/dieu-hanh"
                      : "/co-van"
                }
              >
                Mở khu vực được cấp quyền
              </Link>
              <button className="adm-btn" onClick={() => void signOut()}>
                Đăng xuất
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  const allowed = cms
    ? true
    : manager
      ? phase1ManagerPath(path.replace(/^\/dieu-hanh/, ""))
      : !/^\/co-van\/website(\/|$)/.test(path);
  return (
    <SessionContext.Provider value={session}>
      {allowed ? (
        children
      ) : (
        <div className="adm-panel">
          <h1>Chức năng chưa khả dụng</h1>
          <Link href={manager ? "/dieu-hanh" : "/co-van"} className="adm-btn">
            Quay lại tổng quan
          </Link>
        </div>
      )}
    </SessionContext.Provider>
  );
}
