"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { apiEnabled, request, command, ApiFailure } from "@/lib/api/client";
import type { AuthSession } from "@/lib/api/types";
import { canOpenCms } from "@/lib/api/cms";
import { AdminLoading } from "./primitives";

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
    [busy, setBusy] = useState(false);
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
  if (!ready)
    return (
      <div className="adm-app" data-theme="light">
        <AdminLoading />
      </div>
    );
  if (!session || session.mustChangePassword)
    return (
      <div className="adm-app" data-theme="light">
        <main className="adm-main">
          <section className="adm-panel adm-form-page">
            <h1>{session ? "Đổi mật khẩu" : "Đăng nhập"}</h1>
            <p>Trạm dịch vụ Toàn Trung</p>
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
                  type="password"
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
                      type="password"
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
                      type="password"
                      autoComplete="new-password"
                      required
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                    />
                  </label>
                  <p className="adm-field-help">Từ 15 đến 128 ký tự.</p>
                </>
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
  if (
    (manager && !session.roles.includes("MANAGER")) ||
    (cms && !canOpenCms(session)) ||
    (!manager && !cms && session.roles.includes("CMS_ADMIN"))
  )
    return (
      <div className="adm-panel">
        <h1>Bạn không có quyền truy cập khu vực này.</h1>
        <Link
          className="adm-btn"
          href={session.roles.includes("CMS_ADMIN") ? "/admin" : "/co-van"}
        >
          Mở khu vực được cấp quyền
        </Link>
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
