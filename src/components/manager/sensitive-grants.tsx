"use client";
import { useEffect, useState } from "react";
import { collection, command } from "@/lib/api/client";
import { financePermissions } from "@/lib/api/stock-finance";
import { AdminLoading } from "@/components/admin/primitives";
type Staff = {
  id: string;
  version: number;
  account?: { role: string; permissions: string[] };
};
export function SensitiveGrants({ id }: { id: string }) {
  const [staff, setStaff] = useState<Staff | null>(null),
    [grants, setGrants] = useState<string[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [reload, setReload] = useState(0),
    [message, setMessage] = useState("");
  useEffect(() => {
    const a = new AbortController();
    collection<Staff>("admin/staff", a.signal)
      .then((list) => {
        const s = list.find((s) => s.id === id);
        setStaff(s || null);
        setGrants(s?.account?.permissions || []);
      })
      .catch((e) => {
        if (!a.signal.aborted) setError(e.message);
      });
    return () => a.abort();
  }, [id, reload]);
  if (!staff) return error ? <p role="alert">{error}</p> : <AdminLoading />;
  if (!["MANAGER", "CMS_ADMIN"].includes(staff.account?.role || ""))
    return null;
  return (
    <section className="adm-panel">
      <h3>Quyền theo công việc</h3>
      <fieldset className="adv-checks" disabled={busy}>
        <legend>Cấp riêng theo công việc được giao</legend>
        <div className="adv-check-grid">
          {Object.entries(financePermissions)
            .filter(
              ([k]) =>
                staff.account?.role !== "CMS_ADMIN" || k.startsWith("cms."),
            )
            .map(([k, l]) => (
              <label key={k}>
                <input
                  type="checkbox"
                  checked={
                    (staff.account?.role === "CMS_ADMIN" && k === "cms.read") ||
                    grants.includes(k)
                  }
                  disabled={
                    staff.account?.role === "CMS_ADMIN" && k === "cms.read"
                  }
                  onChange={(e) => {
                    setGrants(
                      e.target.checked
                        ? [...grants, k]
                        : grants.filter((g) => g !== k),
                    );
                    setMessage("");
                  }}
                />
                {l}
              </label>
            ))}
        </div>
        <button
          type="button"
          className="adm-btn"
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await command(
                `admin/staff/${id}`,
                {
                  expectedVersion: staff.version,
                  reason: "Cập nhật quyền theo phân công",
                  account: { permissions: grants },
                },
                "PATCH",
              );
              setMessage(
                "Đã cập nhật quyền. Tài khoản được đổi quyền cần đăng nhập lại.",
              );
              setReload((n) => n + 1);
              window.dispatchEvent(new Event("dpauto-data-updated"));
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Không thể cập nhật quyền.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          Lưu quyền
        </button>
      </fieldset>
      {error && (
        <p className="adm-error-text" role="alert">
          {error}{" "}
          <button
            type="button"
            className="adm-btn"
            onClick={() => {
              setError("");
              setReload((n) => n + 1);
            }}
          >
            Tải quyền mới
          </button>
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
