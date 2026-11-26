"use client";
import { DateInput } from "@/components/advisor/date-input";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { request, command, collection } from "@/lib/api/client";
import { useApiPage } from "@/lib/api/use-page";
import { useSession } from "@/components/admin/auth-gate";
import {
  AdminLoading,
  EmptyState,
  PageHeading,
} from "@/components/admin/primitives";
import { ManagerEmpty, ManagerPanel, ManagerTable } from "./manager-ui";
import { ManagerModal } from "./manager-modal";
import { PageButtons } from "./live-stock";
import { workflowTime, vnd } from "@/lib/api/workflow";
import { AdminIcon } from "@/components/admin/admin-icon";
import { formatDate, shiftDate } from "@/lib/booking/logic";
import { useManager } from "./manager-provider";
import { BookingTrend, BookingDistribution } from "./manager-charts";
import {
  stationToday,
  operationStages,
  rateText,
  subjectHref,
  type OperationsSummary,
  type OperationAlert,
  type StaffShift,
  type InboxNotice,
  type NotificationJob,
} from "@/lib/api/operations";

/** 1169 → "19 giờ 29 phút"; short spans stay in minutes. */
export function durationText(minutes: number) {
  const m = Math.round(minutes),
    h = Math.floor(m / 60);
  return h ? `${h} giờ${m % 60 ? ` ${m % 60} phút` : ""}` : `${m} phút`;
}
export function LiveOperations({ report = false }: { report?: boolean }) {
  const manager = useManager();
  const today = stationToday(),
    session = useSession(),
    [from, setFrom] = useState(today),
    [to, setTo] = useState(today),
    [data, setData] = useState<OperationsSummary | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [reload, setReload] = useState(0);
  useEffect(() => {
    if (report)
      manager.setRange?.(
        shiftDate(
          to,
          1 -
            Math.max(
              7,
              Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1,
            ),
        ),
        to,
      );
  }, [report, from, to, manager.setRange]);
  useEffect(() => {
    const a = new AbortController();
    setData(null);
    setError("");
    request<OperationsSummary>(
      `admin/operations/summary?from=${from}&to=${to}`,
      { signal: a.signal },
    )
      .then((r) => setData(r.data))
      .catch((e) => {
        if (!a.signal.aborted) setError(e.message);
      });
    return () => a.abort();
  }, [from, to, reload]);
  useEffect(() => {
    const refresh = () => setReload((n) => n + 1);
    window.addEventListener("dpauto-data-updated", refresh);
    return () => window.removeEventListener("dpauto-data-updated", refresh);
  }, []);
  async function download(type: string) {
    setBusy(true);
    setError("");
    try {
      const r = await request<{ csv: string; filename: string }>(
        `admin/operations/export?from=${from}&to=${to}&type=${type}`,
      );
      const url = URL.createObjectURL(
        new Blob(["\ufeff", r.data.csv], { type: "text/csv;charset=utf-8" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = r.data.filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể xuất báo cáo.");
    } finally {
      setBusy(false);
    }
  }
  const days = Math.max(
    7,
    Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1,
  );
  return (
    <section className="adv-stack">
      <PageHeading title="Báo cáo">
        {session?.permissions.includes("reports.export") && (
          <div className="adv-actions">
            <button
              className="adm-btn"
              disabled={busy || !data}
              onClick={() => void download("VISITS")}
            >
              Xuất phiếu dịch vụ
            </button>
            {session.permissions.includes("finance.read") && (
              <button
                className="adm-btn"
                disabled={busy || !data}
                onClick={() => void download("CASH")}
              >
                Xuất sổ tiền
              </button>
            )}
          </div>
        )}
      </PageHeading>
      <div className="mgr-report-bar">
        <div className="adm-quick-filters" aria-label="Khoảng thời gian">
          {[1, 7, 30].map((n) => {
            const on = from === shiftDate(today, 1 - n) && to === today;
            return (
              <button
                key={n}
                aria-pressed={on}
                className={on ? "is-active" : ""}
                onClick={() => {
                  setFrom(shiftDate(today, 1 - n));
                  setTo(today);
                }}
              >
                {n === 1 ? "Hôm nay" : `${n} ngày`}
              </button>
            );
          })}
        </div>
        <div className="mgr-form-columns mgr-audit-dates">
          <label className="adm-field">
            Từ ngày
            <DateInput value={from} onValueChange={(v) => setFrom(v || today)} />
          </label>
          <label className="adm-field">
            Đến ngày
            <DateInput
              value={to}
              min={from}
              onValueChange={(v) => setTo(v || today)}
            />
          </label>
        </div>
      </div>
      <ManagerPanel
        title={
          from === to
            ? `Ngày ${formatDate(from)}`
            : `${formatDate(from)} – ${formatDate(to)}`
        }
        description={data ? `Cập nhật ${workflowTime(data.asOf)}` : undefined}
        action={
          <button className="adm-btn" onClick={() => setReload((n) => n + 1)}>
            Cập nhật
          </button>
        }
      >
        {error && (
          <p className="adm-error-text" role="alert">
            {error}
          </p>
        )}
        {!data && !error && <AdminLoading />}
        {data && (
          <>
            <div className="mgr-kpis mgr-kpis-4">
              {(
                [
                  ["Xe tiếp nhận", data.received, "Xe đến trạm trong kỳ", "blue", "car"],
                  ["Xe bàn giao", data.handovers, "Xe đã giao lại cho khách", "success", "check"],
                  [
                    "Tỉ lệ hoàn thành",
                    rateText(data.completionRate),
                    data.completionRate.denominator
                      ? `${data.completionRate.numerator}/${data.completionRate.denominator} xe đã bàn giao`
                      : "Chưa có xe tiếp nhận",
                    "brand",
                    "chart",
                  ],
                  [
                    "Tỉ lệ vắng hẹn",
                    rateText(data.noShowRate),
                    data.noShowRate.denominator
                      ? `${data.noShowRate.numerator}/${data.noShowRate.denominator} lịch khách không đến`
                      : "Chưa có lịch đến hạn",
                    "warning",
                    "alert",
                  ],
                ] as const
              ).map(([label, value, sub, tone, icon]) => (
                <div key={label} className="adm-panel mgr-kpi" data-tone={tone}>
                  <div>
                    <span>{label}</span>
                    <span className="mgr-kpi-icon">
                      <AdminIcon name={icon} />
                    </span>
                  </div>
                  <strong>{value}</strong>
                  <p>{sub}</p>
                </div>
              ))}
            </div>
            <p className="adm-muted mgr-report-note">
              Thời gian xử lý trung bình:{" "}
              <strong>
                {data.averageTurnaroundMinutes === null
                  ? "—"
                  : durationText(data.averageTurnaroundMinutes)}
              </strong>
            </p>
          </>
        )}
      </ManagerPanel>
      {data && (
        <>
          <ManagerPanel title="Phiếu theo giai đoạn">
            <div className="mgr-kpis mgr-kpis-operations">
              {data.stages.map((s) => (
                <Link
                  className="adm-panel mgr-kpi mgr-kpi-link"
                  data-tone={
                    s.stage === "HANDED_OVER" || s.stage === "READY"
                      ? "success"
                      : s.stage === "IN_PROGRESS"
                        ? "blue"
                        : s.stage === "ABORTED"
                          ? "danger"
                          : "brand"
                  }
                  href={`/dieu-hanh/phieu-dich-vu?stage=${s.stage}`}
                  key={s.stage}
                >
                  <div>{operationStages[s.stage]}</div>
                  <strong>{s.count}</strong>
                </Link>
              ))}
            </div>
          </ManagerPanel>
          <ManagerPanel title="Kỹ thuật viên">
            {data.technicians.length ? (
              <div className="mgr-table-scroll">
                <ManagerTable className="mgr-table">
                  <thead>
                    <tr>
                      <th>Kỹ thuật viên</th>
                      <th>Việc hoàn thành</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.technicians.map((t) => (
                      <tr key={t.id}>
                        <td>{t.name}</td>
                        <td>{t.completed}</td>
                      </tr>
                    ))}
                  </tbody>
                </ManagerTable>
              </div>
            ) : (
              <p className="adm-muted">Chưa có việc hoàn thành trong kỳ.</p>
            )}
          </ManagerPanel>
          {data.finance && (
            <ManagerPanel title="Dòng tiền">
              <dl className="adm-info-grid">
                {[
                  ["Thực thu", data.finance.cashIn],
                  ["Hoàn/đảo", data.finance.cashOut],
                  ["Dòng tiền thuần", data.finance.netCash],
                  ["Báo giá đã duyệt", data.finance.approvedQuotes],
                  ["Công nợ hiện tại", data.finance.outstanding],
                ].map(([l, v]) => (
                  <div key={l}>
                    <dt>{l}</dt>
                    <dd>{vnd(v)}</dd>
                  </div>
                ))}
              </dl>
            </ManagerPanel>
          )}
        </>
      )}
      <div className="mgr-chart-layout">
        <ManagerPanel title="Xu hướng lịch hẹn">
          <BookingTrend bookings={manager.data.bookings} today={to} days={days} />
        </ManagerPanel>
        <ManagerPanel title="Phân bố trạng thái">
          <BookingDistribution
            bookings={manager.data.bookings.filter(
              (b) => b.date >= from && b.date <= to,
            )}
          />
        </ManagerPanel>
      </div>
    </section>
  );
}
export function LiveAlerts({ limit }: { limit?: number }) {
  const [reload, setReload] = useState(0),
    p = useApiPage<OperationAlert>("admin/operations/alerts", reload);
  useEffect(() => {
    const refresh = () => setReload((n) => n + 1);
    window.addEventListener("dpauto-data-updated", refresh);
    return () => window.removeEventListener("dpauto-data-updated", refresh);
  }, []);
  return (
    <ManagerPanel
      title="Cảnh báo điều hành"
      action={
        <button className="adm-btn" onClick={() => setReload((n) => n + 1)}>
          Cập nhật
        </button>
      }
    >
      {p.error && (
        <p className="adm-error-text" role="alert">
          {p.error}
        </p>
      )}
      {p.loading ? (
        <AdminLoading />
      ) : (
        <div className="adv-stack">
          {p.data.slice(0, limit).map((a) => (
            <Link
              key={a.id}
              className="mgr-alert"
              data-tone={
                a.severity === "DANGER"
                  ? "danger"
                  : a.severity === "WARNING"
                    ? "warning"
                    : "blue"
              }
              href={subjectHref("/dieu-hanh", a.subjectType, a.subjectId)}
            >
              <div>
                <span
                  className={`mgr-pill mgr-pill-${a.severity === "DANGER" ? "danger" : a.severity === "WARNING" ? "warning" : "blue"}`}
                >
                  {a.severity === "DANGER"
                    ? "Khẩn cấp"
                    : a.severity === "WARNING"
                      ? "Cần xử lý"
                      : "Theo dõi"}
                </span>
                <strong>{a.title}</strong>
                <small>
                  {a.code} · {workflowTime(a.at)}
                </small>
              </div>
              <span className="mgr-alert-link">Xem chi tiết ↗</span>
            </Link>
          ))}
          {!p.data.length && !p.error && (
            <p className="adm-muted">Không có cảnh báo cần xử lý.</p>
          )}
        </div>
      )}
      {!limit && <PageButtons manager page={p} />}
    </ManagerPanel>
  );
}

const halfHours = Array.from(
  { length: 48 },
  (_, i) => `${String(i >> 1).padStart(2, "0")}:${i % 2 ? "30" : "00"}`,
);
export function LiveShifts() {
  const session = useSession(),
    today = stationToday(),
    [date, setDate] = useState(today),
    [reload, setReload] = useState(0),
    [staff, setStaff] = useState<
      { id: string; name: string; active: boolean }[]
    >([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [adding, setAdding] = useState(false),
    { theme } = useManager();
  const p = useApiPage<StaffShift>(
    `admin/staff-shifts?from=${date}&to=${date}`,
    reload,
  );
  const manage = !!session?.permissions.includes("staff.manage");
  useEffect(() => {
    const a = new AbortController();
    collection<(typeof staff)[number]>("admin/staff", a.signal)
      .then(setStaff)
      .catch((e) => {
        if (!a.signal.aborted) setError(e.message);
      });
    return () => a.abort();
  }, [reload]);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const f = e.currentTarget,
      d = new FormData(f);
    setBusy(true);
    setError("");
    try {
      await command("admin/staff-shifts", {
        staffId: d.get("staff"),
        kind: d.get("kind"),
        startsAt: `${date}T${d.get("start")}:00+07:00`,
        endsAt: `${date}T${d.get("end")}:00+07:00`,
        note: d.get("note"),
      });
      f.reset();
      setAdding(false);
      setReload((n) => n + 1);
      window.dispatchEvent(new Event("dpauto-data-updated"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể lưu ca.");
    } finally {
      setBusy(false);
    }
  }
  async function cancel(h: StaffShift) {
    const reason = window.prompt("Lý do hủy ca");
    if (!reason?.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      await command(`admin/staff-shifts/${h.id}/cancel`, {
        expectedVersion: h.version,
        reason,
      });
      setReload((n) => n + 1);
      window.dispatchEvent(new Event("dpauto-data-updated"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể hủy ca.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <ManagerPanel
      title="Ca làm việc & lịch nghỉ"
      action={
        manage && (
          <button
            className="adm-btn adm-primary"
            onClick={() => {
              setError("");
              setAdding(true);
            }}
          >
            <AdminIcon name="plus" />
            Thêm ca
          </button>
        )
      }
    >
      <div className="adm-date-controls">
        <button
          className="adm-btn adm-btn-sm"
          onClick={() => setDate(today)}
        >
          Hôm nay
        </button>
        <button
          className="adm-icon-btn adm-date-prev"
          aria-label="Ngày trước"
          onClick={() => setDate(shiftDate(date, -1))}
        >
          <span>‹</span>
        </button>
        <label className="adm-date-picker">
          <AdminIcon name="calendar" />
          <DateInput
            aria-label="Ngày xem ca"
            value={date}
            onValueChange={(v) => setDate(v || today)}
          />
        </label>
        <button
          className="adm-icon-btn"
          aria-label="Ngày sau"
          onClick={() => setDate(shiftDate(date, 1))}
        >
          <span>›</span>
        </button>
      </div>
      {adding && (
        <ManagerModal
          title="Thêm ca / lịch nghỉ"
          theme={theme}
          onClose={() => setAdding(false)}
        >
          <form className="mgr-form" onSubmit={save}>
            <p className="adm-muted">Ngày {formatDate(date)}</p>
            <div className="adm-form-grid">
              <label className="adm-field">
                Nhân viên
                <select name="staff" required disabled={busy}>
                  <option value="">Chọn nhân viên</option>
                  {staff
                    .filter((s) => s.active)
                    .map((s) => (
                      <option value={s.id} key={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="adm-field">
                Loại
                <select name="kind" disabled={busy}>
                  <option value="WORK">Làm việc</option>
                  <option value="LEAVE">Nghỉ</option>
                </select>
              </label>
              {/* Selects keep 24h times: <input type="time"> follows the OS locale (AM/PM). */}
              <label className="adm-field">
                Bắt đầu
                <select name="start" defaultValue="08:00" required disabled={busy}>
                  {halfHours.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="adm-field">
                Kết thúc
                <select name="end" defaultValue="18:00" required disabled={busy}>
                  {halfHours.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="adm-field">
              Ghi chú / lý do
              <input name="note" maxLength={400} required disabled={busy} />
            </label>
            {error && (
              <p className="adm-error-text" role="alert">
                {error}
              </p>
            )}
            <div className="adm-dialog-actions">
              <button
                type="button"
                className="adm-btn"
                onClick={() => setAdding(false)}
              >
                Hủy
              </button>
              <button className="adm-btn adm-primary" disabled={busy}>
                Lưu ca
              </button>
            </div>
          </form>
        </ManagerModal>
      )}
      {((!adding && error) || p.error) && (
        <p className="adm-error-text" role="alert">
          {error || p.error}
        </p>
      )}
      {p.loading ? (
        <AdminLoading />
      ) : (
        <div className="mgr-table-scroll">
          <ManagerTable className="mgr-table">
            <thead>
              <tr>
                <th>Nhân viên</th>
                <th>Ca</th>
                <th>Thời gian</th>
                <th>Ghi chú</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {p.data.map((h) => (
                <tr key={h.id}>
                  <td>{h.name}</td>
                  <td>{h.kind === "WORK" ? "Làm việc" : "Nghỉ"}</td>
                  <td>
                    {workflowTime(h.startsAt)} — {workflowTime(h.endsAt)}
                  </td>
                  <td>{h.note}</td>
                  <td>
                    {manage && new Date(h.endsAt) > new Date() && (
                      <button
                        className="adm-btn adm-danger"
                        disabled={busy}
                        onClick={() => void cancel(h)}
                      >
                        Hủy ca
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </ManagerTable>
          {!p.data.length && !p.error && (
            <ManagerEmpty message="Chưa có ca cho ngày này" />
          )}
        </div>
      )}
      <PageButtons manager page={p} />
    </ManagerPanel>
  );
}

export function DeliveryJobs() {
  const [reload, setReload] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    p = useApiPage<NotificationJob>("admin/notification-jobs", reload);
  async function retry(j: NotificationJob) {
    const reason = window.prompt("Lý do yêu cầu thử lại");
    if (!reason?.trim() || busy) return;
    setBusy(true);
    try {
      await command(`admin/notification-jobs/${j.id}/retry`, {
        expectedVersion: j.version,
        reason,
      });
      setReload((n) => n + 1);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể thử lại.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <ManagerPanel
      title="Lịch sử xử lý thông báo"
      description="Zalo OA chưa được cấu hình gửi. Thông báo nội bộ vẫn được xử lý độc lập."
    >
      <button className="adm-btn" onClick={() => setReload((n) => n + 1)}>
        Cập nhật trạng thái
      </button>
      {(error || p.error) && (
        <p role="alert" className="adm-error-text">
          {error || p.error}
        </p>
      )}
      {p.loading ? (
        <AdminLoading />
      ) : (
        <div className="mgr-table-scroll">
          <ManagerTable className="mgr-table">
            <thead>
              <tr>
                <th>Thời điểm</th>
                <th>Trạng thái</th>
                <th>Số lần</th>
                <th>Kênh xử lý</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {p.data.map((j) => (
                <tr key={j.id}>
                  <td>{workflowTime(j.createdAt)}</td>
                  <td>
                    {{
                      PENDING: "Đang chờ",
                      PROCESSING: "Đang xử lý",
                      PROCESSED: "Đã xử lý nội bộ",
                      SENT: "Đã gửi",
                      FAILED: "Lỗi xử lý",
                    }[j.status] || j.status}
                    {j.nextAttemptAt && (
                      <p>Thử lại: {workflowTime(j.nextAttemptAt)}</p>
                    )}
                  </td>
                  <td>{j.attempts}/5</td>
                  <td>
                    {j.deliveries.map((d) => (
                      <p key={`${d.attempt}-${d.channel}`}>
                        {d.channel} · lần {d.attempt}:{" "}
                        {d.status === "BLOCKED"
                          ? "Chưa được cấu hình"
                          : d.status === "PROCESSED"
                            ? "Đã xử lý"
                            : "Thất bại"}
                      </p>
                    ))}
                  </td>
                  <td>
                    {j.status === "FAILED" && j.attempts < 5 && (
                      <button
                        className="adm-btn"
                        disabled={busy}
                        onClick={() => void retry(j)}
                      >
                        Thử lại
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </ManagerTable>
        </div>
      )}
      <PageButtons manager page={p} />
    </ManagerPanel>
  );
}
