"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { command, request } from "@/lib/api/client";
import { useApiPage } from "@/lib/api/use-page";
import type { InboxNotice } from "@/lib/api/operations";
import { workflowTime } from "@/lib/api/workflow";
import { visitStages, visitStageTone, type VisitStage } from "@/lib/api/visits";
import type { BookingStatus } from "@/lib/booking/types";
import { formatPlate } from "@/lib/advisor/formats";
import { eventLabel } from "@/lib/event-labels";
import { AdminIcon } from "@/components/admin/admin-icon";
import {
  AdminLoading,
  EmptyState,
  PageHeading,
  StatusBadge,
} from "@/components/admin/primitives";
import { PageButtons } from "@/components/manager/live-stock";

/** Where a notice leads; `base` is "/co-van" or "/dieu-hanh". */
const href = (base: string, n: InboxNotice) =>
  n.subjectType === "visit"
    ? `${base}/phieu-dich-vu/${n.subjectId}`
    : base === "/co-van"
      ? `${base}/lich-hen/${n.subjectId}`
      : `${base}/lich-hen?selected=${encodeURIComponent(n.subjectId)}`;
const heading = (n: InboxNotice) =>
  n.eventType ? eventLabel(n.eventType) : n.title;
/** "Lịch hẹn DP-DV… · Nguyễn Văn A · 51A-123.45" */
const subjectLine = (n: InboxNotice) =>
  [
    `${n.subjectType === "visit" ? "Phiếu dịch vụ" : "Lịch hẹn"} ${n.subject?.code || ""}`.trim(),
    n.subject?.customerName,
    formatPlate(n.subject?.plate) || n.subject?.model,
  ]
    .filter(Boolean)
    .join(" · ");
const markRead = (n: InboxNotice) =>
  n.readAt
    ? Promise.resolve()
    : command(`admin/notifications/${n.id}/read`, {
        expectedVersion: n.version,
      }).then(() => undefined);

/** Header bell: small popup with the latest notices; the full list lives on {base}/thong-bao. */
export function NotificationBell({ base = "/co-van" }: { base?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false),
    [items, setItems] = useState<InboxNotice[]>([]),
    [unread, setUnread] = useState(0),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const load = useCallback(async () => {
    try {
      const r = await request<InboxNotice[]>("admin/notifications?limit=6");
      setItems(r.data);
      setUnread(Number(r.meta.unread || 0));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được thông báo.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const update = () => void load();
    update();
    const timer = setInterval(update, 60000);
    window.addEventListener("focus", update);
    window.addEventListener("dpauto-data-updated", update);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", update);
      window.removeEventListener("dpauto-data-updated", update);
    };
  }, [load]);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div className="adv-notify" ref={box}>
      <button
        type="button"
        className="adm-icon-btn adm-notification"
        aria-label={`Thông báo${unread ? `, ${unread} chưa đọc` : ""}`}
        aria-expanded={open}
        aria-controls="adv-notify-panel"
        onClick={() => {
          if (!open) {
            setLoading(!items.length);
            void load();
          }
          setOpen(!open);
        }}
      >
        <AdminIcon name="bell" />
        {unread > 0 && <i />}
      </button>
      {open && (
        <div
          className="adv-notify-panel"
          id="adv-notify-panel"
          role="dialog"
          aria-label="Thông báo"
        >
          <div className="adv-notify-head">
            <strong>Thông báo</strong>
            <span className="adm-muted">{unread} chưa đọc</span>
          </div>
          {loading ? (
            <p className="adm-muted adv-notify-empty">Đang tải…</p>
          ) : error ? (
            <p className="adm-error-text adv-notify-empty" role="alert">
              {error}
            </p>
          ) : items.length ? (
            <ul className="adv-notify-list">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={n.readAt ? "" : "is-unread"}
                    onClick={async () => {
                      setOpen(false);
                      await markRead(n).catch(() => undefined);
                      void load();
                      router.push(href(base, n));
                    }}
                  >
                    <strong>{heading(n)}</strong>
                    <span>{subjectLine(n)}</span>
                    <time dateTime={n.occurredAt || n.createdAt}>
                      {workflowTime(n.occurredAt || n.createdAt)}
                    </time>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="adm-muted adv-notify-empty">Chưa có thông báo.</p>
          )}
          <Link
            className="adm-text-link adv-notify-all"
            href={`${base}/thong-bao`}
            onClick={() => setOpen(false)}
          >
            Xem tất cả thông báo
          </Link>
        </div>
      )}
    </div>
  );
}

/** {base}/thong-bao: every notice with its full detail; `children` adds page-specific sections. */
export function AdvisorNotifications({
  base = "/co-van",
  children,
}: {
  base?: string;
  children?: ReactNode;
}) {
  const router = useRouter();
  const [reload, setReload] = useState(0),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [unread, setUnread] = useState(0);
  const p = useApiPage<InboxNotice>("admin/notifications", reload);
  useEffect(() => {
    const a = new AbortController();
    request<InboxNotice[]>("admin/notifications?limit=1", { signal: a.signal })
      .then((r) => setUnread(Number(r.meta.unread || 0)))
      .catch((e) => {
        if (!a.signal.aborted) setError(e.message);
      });
    return () => a.abort();
  }, [reload]);
  async function open(n: InboxNotice, go: boolean) {
    if (busy) return;
    setBusy(n.id);
    setError("");
    try {
      await markRead(n);
      window.dispatchEvent(new Event("dpauto-data-updated"));
      if (go) router.push(href(base, n));
      else setReload((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể cập nhật.");
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="adv-stack">
      <PageHeading
        title="Thông báo"
        description={`${unread} thông báo chưa đọc`}
      >
        <button className="adm-btn" onClick={() => setReload((n) => n + 1)}>
          Cập nhật
        </button>
      </PageHeading>
      {(error || p.error) && (
        <p className="adm-error-text" role="alert">
          {error || p.error}
        </p>
      )}
      {p.loading ? (
        <AdminLoading />
      ) : p.data.length ? (
        <section className="adm-panel adv-notice-list">
          {p.data.map((n) => {
            const s = n.subject,
              stage = s?.status as VisitStage | undefined;
            return (
              <article
                key={n.id}
                className={`adv-notice${n.readAt ? "" : " is-unread"}`}
              >
                <div className="adv-notice-head">
                  <h2>{heading(n)}</h2>
                  <time dateTime={n.occurredAt || n.createdAt}>
                    {workflowTime(n.occurredAt || n.createdAt)}
                  </time>
                </div>
                <p className="adv-notice-subject">{subjectLine(n)}</p>
                <dl className="adv-notice-meta">
                  {s?.startAt && (
                    <div>
                      <dt>Giờ hẹn</dt>
                      <dd>{workflowTime(s.startAt)}</dd>
                    </div>
                  )}
                  {s?.status && (
                    <div>
                      <dt>Trạng thái</dt>
                      <dd>
                        {n.subjectType === "booking" ? (
                          <StatusBadge
                            status={s.status.toLowerCase() as BookingStatus}
                          />
                        ) : (
                          <span
                            className={`adm-badge adm-status-${visitStageTone[stage!] || "pending"}`}
                          >
                            {visitStages[stage!] || s.status}
                          </span>
                        )}
                      </dd>
                    </div>
                  )}
                  {n.actorName && (
                    <div>
                      <dt>Người thực hiện</dt>
                      <dd>{n.actorName}</dd>
                    </div>
                  )}
                  {n.reason && (
                    <div className="adv-notice-reason">
                      <dt>Nội dung</dt>
                      <dd>{n.reason}</dd>
                    </div>
                  )}
                </dl>
                <div className="adv-notice-actions">
                  <button
                    type="button"
                    className="adm-btn adm-primary"
                    disabled={!!busy}
                    onClick={() => void open(n, true)}
                  >
                    {n.subjectType === "visit"
                      ? "Mở phiếu dịch vụ"
                      : "Mở lịch hẹn"}
                  </button>
                  {n.readAt ? (
                    <span className="adm-muted">Đã đọc</span>
                  ) : (
                    <button
                      type="button"
                      className="adm-btn"
                      disabled={!!busy}
                      onClick={() => void open(n, false)}
                    >
                      {busy === n.id ? "Đang lưu…" : "Đánh dấu đã đọc"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        !p.error && (
          <section className="adm-panel">
            <EmptyState
              title="Bạn chưa có thông báo"
              description="Thông báo mới sẽ xuất hiện tại đây."
              create={false}
            />
          </section>
        )
      )}
      <PageButtons page={p} />
      {children}
    </div>
  );
}
