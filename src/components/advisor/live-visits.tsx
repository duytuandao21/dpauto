"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  apiEnabled,
  request,
  command,
  collection,
  ApiFailure,
} from "@/lib/api/client";
import { stationTime, type ApiStaff } from "@/lib/api/types";
import {
  intakePayload,
  visitStages,
  type Intake,
  type Visit,
  type VisitDetail,
  type VisitEvent,
} from "@/lib/api/visits";
import { AdminLoading, PageHeading } from "@/components/admin/primitives";
import { VisitIntakeFields } from "./visit-intake-fields";
import { LiveWorkflow } from "./live-workflow";
import { AdminIcon } from "@/components/admin/admin-icon";
import { EmptyState } from "@/components/admin/primitives";
import { VisitStageBadge } from "./order-common";
import { formatDate } from "@/lib/booking/logic";

const at = (s: string) =>
  `${formatDate(stationTime(s))} · ${stationTime(s).slice(11, 16)}`;
function VisitCard({
  visit,
  root,
  compact = false,
}: {
  visit: Visit;
  root: string;
  compact?: boolean;
}) {
  if (compact)
    return (
      <Link href={`${root}/phieu-dich-vu/${visit.id}`}>
        <div>
          <strong>
            {visit.code} · {visit.vehicle.plate || visit.vehicle.model}
          </strong>
          <small>{at(visit.receivedAt)}</small>
        </div>
        <VisitStageBadge stage={visit.stage} />
      </Link>
    );
  return (
    <Link
      href={`${root}/phieu-dich-vu/${visit.id}`}
      className="adm-booking-card adv-order-card"
    >
      <span className="adm-card-top">
        <strong>{visit.code}</strong>
        {root === "/co-van" ? (
          <VisitStageBadge stage={visit.stage} />
        ) : (
          <span
            className={`adm-badge ${visit.stage === "ABORTED" ? "adm-status-cancelled" : visit.stage === "HANDED_OVER" ? "adm-status-completed" : visit.stage === "RECEIVED" ? "adm-status-confirmed" : "adm-status-arrived"}`}
          >
            {visitStages[visit.stage]}
          </span>
        )}
      </span>
      <strong className="adv-order-name">
        {visit.vehicle.plate || "Chưa có biển số"} · {visit.vehicle.model}
      </strong>
      <span>
        {visit.customer.name} · {visit.customer.phone}
      </span>
      <span>{visit.services.map((s) => s.name).join(", ")}</span>
      <span className="adm-muted">
        Tiếp nhận {at(visit.receivedAt)} · {visit.assignedAdvisor.name}
      </span>
      {visit.work && (
        <span>
          Công việc: {visit.work.done}/{visit.work.total} ·{" "}
          {visit.work.technicians.join(", ") || "Chưa phân công kỹ thuật viên"}
          {visit.work.dueAt && (
            <span
              className={
                new Date(visit.work.dueAt) < new Date() &&
                !["FINISHED", "ABORTED"].includes(visit.work.status)
                  ? "adm-error-text"
                  : ""
              }
            >
              {" "}
              · Hẹn xong {at(visit.work.dueAt)}
            </span>
          )}
        </span>
      )}
      <span>
        {visit.origin === "WALK_IN" ? "Khách đến trực tiếp" : "Từ lịch hẹn"}
      </span>
      {root === "/co-van" && (
        <span className="adm-text-link">
          Xem phiếu <AdminIcon name="arrow" />
        </span>
      )}
    </Link>
  );
}
export function LiveVisits({
  manager = false,
  activeOnly = false,
  customerId,
  vehicleId,
}: {
  manager?: boolean;
  activeOnly?: boolean;
  customerId?: string;
  vehicleId?: string;
}) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <VisitsContent
        manager={manager}
        activeOnly={activeOnly}
        customerId={customerId}
        vehicleId={vehicleId}
      />
    </Suspense>
  );
}
function VisitsContent({
  manager = false,
  activeOnly = false,
  customerId,
  vehicleId,
}: {
  manager?: boolean;
  activeOnly?: boolean;
  customerId?: string;
  vehicleId?: string;
}) {
  const root = manager ? "/dieu-hanh" : "/co-van",
    params = useSearchParams();
  const [query, setQuery] = useState(""),
    [stage, setStage] = useState(params.get("stage") || ""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const [advisor, setAdvisor] = useState(""),
    [staff, setStaff] = useState<ApiStaff[]>([]);
  const [cursor, setCursor] = useState(""),
    [previous, setPrevious] = useState<string[]>([]),
    [next, setNext] = useState<string | null>(null);
  const [values, setValues] = useState<Visit[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0);
  const contact = customerId || params.get("customerId"),
    vehicle = vehicleId || params.get("vehicleId");
  useEffect(() => {
    if (!manager) return;
    const a = new AbortController();
    collection<ApiStaff>("admin/staff?jobRole=ADVISOR", a.signal)
      .then(setStaff)
      .catch((e) => {
        if (!a.signal.aborted) setError(e.message);
      });
    return () => a.abort();
  }, [manager]);
  useEffect(() => {
    const a = new AbortController();
    setLoading(true);
    setValues([]);
    setError("");
    const q = new URLSearchParams({ limit: "20" });
    if (activeOnly) q.set("activeOnly", "true");
    if (cursor) q.set("cursor", cursor);
    if (query) q.set("q", query);
    if (stage) q.set("stage", stage);
    if (advisor) q.set("advisorId", advisor);
    if (contact) q.set("customerId", contact);
    if (vehicle) q.set("vehicleId", vehicle);
    if (from || to) {
      q.set("from", from || to);
      q.set("to", to || from);
    }
    const timer = setTimeout(() => {
      request<Visit[]>("admin/service-visits?" + q, { signal: a.signal })
        .then((r) => {
          if (!a.signal.aborted) {
            setValues(r.data);
            setNext(r.page?.nextCursor || null);
          }
        })
        .catch((e) => {
          if (!a.signal.aborted) setError(e.message);
        })
        .finally(() => {
          if (!a.signal.aborted) setLoading(false);
        });
    }, 200);
    return () => {
      a.abort();
      clearTimeout(timer);
    };
  }, [
    query,
    stage,
    from,
    to,
    advisor,
    cursor,
    contact,
    vehicle,
    reload,
    activeOnly,
  ]);
  useEffect(() => {
    const update = () => setReload((n) => n + 1);
    window.addEventListener("focus", update);
    return () => window.removeEventListener("focus", update);
  }, []);
  function reset() {
    setCursor("");
    setPrevious([]);
  }
  const embedded = !!customerId || !!vehicleId;
  return (
    <div
      className={
        !manager && embedded
          ? "adm-detail-section"
          : manager
            ? "adv-page adv-stack"
            : "adv-page"
      }
    >
      {!embedded && (
        <PageHeading
          eyebrow={manager ? "ĐIỀU HÀNH" : "CỐ VẤN / XE DỊCH VỤ"}
          title={
            activeOnly
              ? "Điều phối xưởng"
              : manager
                ? "Phiếu dịch vụ"
                : "Xe dịch vụ"
          }
          description={
            activeOnly
              ? "Theo dõi các xe đang ở trạm và tiến độ công việc."
              : "Tiếp nhận, báo giá, thi công và bàn giao xe."
          }
        >
          <div className="adv-actions">
            {!manager && (
              <Link href="/co-van/lich-hen" className="adm-btn">
                Mở lịch hẹn
              </Link>
            )}
            <Link
              href={`${root}/tiep-nhan/truc-tiep`}
              className="adm-btn adm-primary"
            >
              Tiếp nhận xe trực tiếp
            </Link>
          </div>
        </PageHeading>
      )}
      <section className={!manager && embedded ? undefined : "adm-panel"}>
        {embedded ? (
          <h3>Lịch sử dịch vụ</h3>
        ) : (
          manager && <h2>Tra cứu phiếu</h2>
        )}
        {!embedded && (
          <>
            <div className="adm-search-row">
              <label className="adm-search">
                <AdminIcon name="search" />
                <input
                  aria-label="Tìm phiếu dịch vụ"
                  placeholder="Biển số, khách, SĐT, mã phiếu…"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    reset();
                  }}
                />
                {query && (
                  <button
                    type="button"
                    aria-label="Xóa tìm kiếm"
                    onClick={() => {
                      setQuery("");
                      reset();
                    }}
                  >
                    ×
                  </button>
                )}
              </label>
            </div>
            {!manager && (
              <div className="adm-quick-filters" aria-label="Lọc tiến độ">
                {[
                  "",
                  "RECEIVED",
                  "INSPECTED",
                  "IN_PROGRESS",
                  "QUALITY_CHECK",
                  "READY",
                  "HANDED_OVER",
                ].map((value) => (
                  <button
                    key={value}
                    className={stage === value ? "is-active" : ""}
                    aria-pressed={stage === value}
                    onClick={() => {
                      setStage(value);
                      reset();
                    }}
                  >
                    {value ? visitStages[value as Visit["stage"]] : "Tất cả"}
                  </button>
                ))}
              </div>
            )}
            <details
              className={manager ? undefined : "adv-advanced"}
              open={manager || undefined}
            >
              <summary className="adm-btn" hidden={manager}>
                Bộ lọc nâng cao
              </summary>
              <div
                className={manager ? "adm-filters" : "adm-filters adv-filters"}
              >
                <label>
                  Trạng thái
                  <select
                    value={stage}
                    onChange={(e) => {
                      setStage(e.target.value);
                      reset();
                    }}
                  >
                    <option value="">Tất cả</option>
                    {Object.entries(visitStages)
                      .filter(
                        ([key]) =>
                          !activeOnly ||
                          !["HANDED_OVER", "ABORTED"].includes(key),
                      )
                      .map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                  </select>
                </label>
                {manager && (
                  <label>
                    Cố vấn
                    <select
                      value={advisor}
                      onChange={(e) => {
                        setAdvisor(e.target.value);
                        reset();
                      }}
                    >
                      <option value="">Tất cả</option>
                      {staff.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  Từ ngày
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => {
                      setFrom(e.target.value);
                      reset();
                    }}
                  />
                </label>
                <label>
                  Đến ngày
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => {
                      setTo(e.target.value);
                      reset();
                    }}
                  />
                </label>
              </div>
            </details>
          </>
        )}
        {error ? (
          <p role="alert" className="adm-error-text">
            {error}{" "}
            <button className="adm-btn" onClick={() => setReload((n) => n + 1)}>
              Tải lại
            </button>
          </p>
        ) : loading ? (
          <AdminLoading />
        ) : values.length ? (
          <div
            className={
              !manager && embedded ? "adm-related-bookings" : "adv-order-list"
            }
          >
            {values.map((v) => (
              <VisitCard
                key={v.id}
                visit={v}
                root={root}
                compact={!manager && embedded}
              />
            ))}
          </div>
        ) : embedded ? (
          <p className="adm-muted">Chưa có phiếu dịch vụ.</p>
        ) : (
          <EmptyState
            title="Không có phiếu phù hợp"
            description="Thử đổi bộ lọc hoặc tiếp nhận một lịch hẹn đã xác nhận."
            create={false}
          />
        )}
        {(previous.length > 0 || next) && (
          <div className="adv-actions">
            <button
              className="adm-btn"
              disabled={loading || !previous.length}
              onClick={() => {
                setCursor(previous.at(-1) || "");
                setPrevious(previous.slice(0, -1));
              }}
            >
              Trang trước
            </button>
            <button
              className="adm-btn"
              disabled={loading || !!error || !next}
              onClick={() => {
                setPrevious([...previous, cursor]);
                setCursor(next || "");
              }}
            >
              Trang sau
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
function PrivatePhoto({ id, name }: { id: string; name: string }) {
  const [url, setUrl] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    const a = new AbortController();
    setUrl("");
    request<{ dataUrl: string }>("admin/visit-media/" + id, {
      signal: a.signal,
    })
      .then((r) => {
        if (!a.signal.aborted) setUrl(r.data.dataUrl);
      })
      .catch((e) => {
        if (!a.signal.aborted) setError(e.message);
      });
    return () => a.abort();
  }, [id]);
  return url ? (
    <img src={url} alt={name} />
  ) : (
    <p role="status">{error || "Đang tải ảnh…"}</p>
  );
}
const eventNames: Record<string, string> = {
  VISIT_RECEIVED: "Tiếp nhận xe",
  VISIT_INTAKE: "Cập nhật tiếp nhận",
  VISIT_INSPECT: "Hoàn tất kiểm tra ban đầu",
  VISIT_CONTACT: "Liên hệ khách hàng",
  VISIT_TRANSFER: "Chuyển cố vấn",
  INTAKE_PHOTO_REMOVED: "Gỡ ảnh tiếp nhận",
  QUOTE_CREATED: "Lập bản báo giá",
  QUOTE_DRAFT_SAVED: "Lưu báo giá",
  QUOTE_SUBMITTED: "Gửi báo giá",
  QUOTE_APPROVED: "Khách đồng ý báo giá",
  QUOTE_REJECTED: "Khách từ chối báo giá",
  WORK_EXEMPTION_APPROVED: "Duyệt công việc miễn phí",
  WORK_ITEM_CREATED: "Thêm công việc",
  WORK_ITEM_UPDATED: "Cập nhật công việc",
  WORK_ITEM_IN_PROGRESS: "Bắt đầu công việc",
  WORK_ITEM_DONE: "Hoàn tất công việc",
  WORK_ITEM_SKIPPED: "Bỏ qua công việc",
  WORK_START: "Bắt đầu thi công",
  WORK_PAUSE: "Tạm dừng thi công",
  WORK_RESUME: "Tiếp tục thi công",
  WORK_FINISH: "Hoàn tất thi công",
  WORK_LOG: "Nhật ký thi công",
  ACCEPTANCE_PASSED: "Nghiệm thu đạt",
  ACCEPTANCE_NEEDS_WORK: "Nghiệm thu cần sửa lại",
  RESOURCE_EXTENDED: "Gia hạn tài nguyên",
  RESOURCE_RELEASED: "Trả khu vực thi công",
  VISIT_READY: "Xe sẵn sàng bàn giao",
  VISIT_HANDED_OVER: "Bàn giao xe",
  VISIT_ABORTED: "Dừng phiếu dịch vụ",
  STOCK_REQUESTED: "Lập yêu cầu phụ tùng",
  STOCK_RESERVED: "Điều chỉnh giữ phụ tùng",
  STOCK_POSTED: "Ghi sổ phụ tùng",
  CASH_COLLECT: "Thu tiền thực tế",
  CASH_DEPOSIT: "Thu cọc thực tế",
  CASH_REFUND: "Hoàn tiền",
  CASH_REVERSAL: "Đảo khoản thu",
  DEPOSIT_ALLOCATED: "Phân bổ cọc đã thu",
  OBLIGATION_CREDITED: "Điều chỉnh giảm nghĩa vụ",
};
export function LiveVisitDetail({
  id,
  manager = false,
}: {
  id: string;
  manager?: boolean;
}) {
  return apiEnabled ? (
    <Suspense fallback={<AdminLoading />}>
      <RemoteVisitDetail key={id} id={id} manager={manager} />
    </Suspense>
  ) : (
    <section className="adm-panel">
      <h1>Chưa kết nối dịch vụ tiếp nhận</h1>
    </section>
  );
}
function RemoteVisitDetail({
  id,
  manager = false,
}: {
  id: string;
  manager?: boolean;
}) {
  const root = manager ? "/dieu-hanh" : "/co-van";
  const params = useSearchParams();
  const overview = !["bao-gia", "thi-cong", "nghiem-thu", "doi-soat"].includes(
    params.get("tab") || "",
  );
  const [workflowDirty, setWorkflowDirty] = useState(false);
  const [visit, setVisit] = useState<VisitDetail | null>(null),
    [events, setEvents] = useState<VisitEvent[]>([]),
    [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [reload, setReload] = useState(0);
  const [editing, setEditing] = useState(false),
    [draft, setDraft] = useState<Intake | null>(null),
    [reason, setReason] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [staff, setStaff] = useState<ApiStaff[]>([]),
    [advisor, setAdvisor] = useState("");
  const [channel, setChannel] = useState("PHONE"),
    [outcome, setOutcome] = useState("UNREACHED"),
    [note, setNote] = useState("");
  useEffect(() => {
    const a = new AbortController();
    setLoading(true);
    setVisit(null);
    setEvents([]);
    setError("");
    const load = async () => {
      const r = await request<VisitDetail>("admin/service-visits/" + id, {
        signal: a.signal,
      });
      const e = await request<VisitEvent[]>(
        `admin/service-visits/${id}/events?limit=20`,
        { signal: a.signal },
      );
      if (!a.signal.aborted) {
        setVisit(r.data);
        setEvents(e.data);
        setNext(e.page?.nextCursor || null);
      }
      if (manager) {
        const s = await collection<ApiStaff>(
          "admin/staff?jobRole=ADVISOR&active=true",
          a.signal,
        );
        if (!a.signal.aborted) setStaff(s);
      }
    };
    load()
      .catch((e) => {
        if (!a.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!a.signal.aborted) setLoading(false);
      });
    return () => a.abort();
  }, [id, manager, reload]);
  useEffect(() => {
    const onFocus = () => {
      setEditing(false);
      setDraft(null);
      setReload((n) => n + 1);
    };
    // Keep an unsaved intake in memory while the user corrects a version conflict.
    if (!editing && !workflowDirty) window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [editing, workflowDirty]);
  useEffect(() => {
    if (!editing) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [editing]);
  async function run(path: string, body: unknown, method = "POST") {
    if (busy || photoBusy) return;
    setBusy(true);
    setError("");
    try {
      await command(path, body, method);
      setEditing(false);
      setDraft(null);
      setReason("");
      setNote("");
      setAdvisor("");
      setReload((n) => n + 1);
      window.dispatchEvent(new Event("dpauto-data-updated"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể lưu.");
      if (e instanceof ApiFailure && [401, 403, 404].includes(e.status)) {
        setVisit(null);
        setDraft(null);
        setEditing(false);
      }
    } finally {
      setBusy(false);
    }
  }
  async function moreEvents() {
    if (!next || busy) return;
    setBusy(true);
    try {
      const r = await request<VisitEvent[]>(
        `admin/service-visits/${id}/events?limit=20&cursor=${encodeURIComponent(next)}`,
      );
      setEvents((v) => [...v, ...r.data]);
      setNext(r.page?.nextCursor || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được lịch sử.");
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <AdminLoading />;
  if (!visit)
    return (
      <section className="adm-panel">
        <h1>Không thể mở phiếu dịch vụ</h1>
        <p role="alert">{error}</p>
        <Link className="adm-btn" href={`${root}/phieu-dich-vu`}>
          Về danh sách
        </Link>
        <button className="adm-btn" onClick={() => setReload((n) => n + 1)}>
          Tải lại
        </button>
      </section>
    );
  return (
    <div className="adv-page adv-stack adv-order-detail">
      {!manager && (
        <Link
          href={`${root}/phieu-dich-vu`}
          className="adm-mobile-back adm-text-link"
        >
          <AdminIcon name="back" />
          Xe dịch vụ
        </Link>
      )}
      <PageHeading
        eyebrow={
          manager ? "ĐIỀU HÀNH / PHIẾU DỊCH VỤ" : "CỐ VẤN / PHIẾU DỊCH VỤ"
        }
        title={visit.code}
        description={`${visit.vehicle.plate || visit.vehicle.model} · Tiếp nhận ${at(visit.receivedAt)}`}
      >
        <VisitStageBadge stage={visit.stage} />
        <Link className="adm-btn" href={`${root}/phieu-dich-vu`}>
          Danh sách phiếu
        </Link>
        {["HANDED_OVER", "ABORTED"].includes(visit.stage) && (
          <Link
            className="adm-btn adm-primary"
            href={`${root}/tiep-nhan/truc-tiep?followUp=${id}`}
          >
            Tiếp nhận xe quay lại
          </Link>
        )}
      </PageHeading>
      {error && (
        <p className="adm-error-text" role="alert">
          {error}{" "}
          <button
            className="adm-btn"
            onClick={() => {
              if (
                (!editing && !workflowDirty) ||
                window.confirm("Tải lại dữ liệu và bỏ các thay đổi chưa lưu?")
              ) {
                setEditing(false);
                setWorkflowDirty(false);
                setDraft(null);
                setReload((n) => n + 1);
              }
            }}
          >
            Tải lại dữ liệu
          </button>
        </p>
      )}
      <LiveWorkflow
        visit={visit}
        root={root}
        onCommitted={() => {
          setWorkflowDirty(false);
          setReload((n) => n + 1);
        }}
        onDirty={setWorkflowDirty}
      />
      {overview && (
        <>
          {manager && (
            <section className="adm-panel">
              <h2>Khách hàng và xe</h2>
              <dl className="adm-info-grid">
                <div>
                  <dt>Khách hàng</dt>
                  <dd>{visit.customer.name}</dd>
                </div>
                <div>
                  <dt>Số điện thoại</dt>
                  <dd>
                    <a href={`tel:${visit.customer.phone}`}>
                      {visit.customer.phone}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt>Xe</dt>
                  <dd>
                    {visit.vehicle.model} ·{" "}
                    {visit.vehicle.plate || "Chưa có biển số"}
                  </dd>
                </div>
                <div>
                  <dt>Cố vấn</dt>
                  <dd>{visit.assignedAdvisor.name}</dd>
                </div>
                <div>
                  <dt>Nguồn tiếp nhận</dt>
                  <dd>
                    {visit.origin === "WALK_IN"
                      ? "Khách đến trực tiếp"
                      : "Lịch hẹn"}
                  </dd>
                </div>
                <div>
                  <dt>Dịch vụ</dt>
                  <dd>{visit.services.map((s) => s.name).join(", ")}</dd>
                </div>
              </dl>
              {visit.bookingId && (
                <Link
                  className="adm-text-link"
                  href={`${root}/lich-hen${manager ? "?selected=" : "/"}${visit.bookingId}`}
                >
                  Xem lịch hẹn
                </Link>
              )}
              {visit.followUpOfVisitId && (
                <Link
                  className="adm-text-link"
                  href={`${root}/phieu-dich-vu/${visit.followUpOfVisitId}`}
                >
                  Phiếu của lần trước
                </Link>
              )}
            </section>
          )}
          <section className="adm-panel">
            <h2>Thông tin tiếp nhận</h2>
            <dl className="adm-info-grid">
              <div>
                <dt>Yêu cầu</dt>
                <dd>{visit.intake.request}</dd>
              </div>
              <div>
                <dt>ODO</dt>
                <dd>
                  {visit.intake.odometer !== null
                    ? `${visit.intake.odometer} km`
                    : visit.intake.odometerMissingReason}
                </dd>
              </div>
              {Object.entries(visit.intake.conditions).map(([k, v]) => (
                <div key={k}>
                  <dt>
                    {
                      {
                        exterior: "Ngoại thất",
                        interior: "Nội thất",
                        engine: "Động cơ",
                        dashboard: "Đèn taplo",
                        tires: "Lốp xe",
                        operation: "Vận hành",
                      }[k]
                    }
                  </dt>
                  <dd>
                    {Array.isArray(v)
                      ? v.join(", ") || "Chưa ghi"
                      : v || "Chưa ghi"}
                  </dd>
                </div>
              ))}
              <div>
                <dt>Ghi chú</dt>
                <dd>{visit.intake.receptionNote || "Chưa ghi"}</dd>
              </div>
              {visit.intake.plateMissingReason && (
                <div>
                  <dt>Lý do chưa có biển số</dt>
                  <dd>{visit.intake.plateMissingReason}</dd>
                </div>
              )}
            </dl>
            <div className="adv-photo-grid">
              {visit.media.map((p) => (
                <figure key={p.id}>
                  <PrivatePhoto id={p.id} name={p.name} />
                  {!editing && visit.allowedActions.includes("edit_intake") && (
                    <button
                      className="adm-btn adm-btn-sm"
                      disabled={busy}
                      onClick={() => {
                        const why = window.prompt("Lý do gỡ ảnh?");
                        if (why?.trim())
                          void run(
                            "admin/visit-media/" + p.id,
                            {
                              expectedVersion: visit.version,
                              reason: why.trim(),
                            },
                            "DELETE",
                          );
                      }}
                    >
                      Gỡ ảnh
                    </button>
                  )}
                </figure>
              ))}
            </div>
            {visit.allowedActions.includes("edit_intake") && !editing && (
              <button
                className="adm-btn"
                onClick={() => {
                  setDraft({ ...visit.intake, photos: [] });
                  setEditing(true);
                }}
              >
                Cập nhật tiếp nhận
              </button>
            )}
          </section>
          {editing && draft && (
            <form
              className="adm-booking-form"
              onSubmit={(e) => {
                e.preventDefault();
                void run(
                  `admin/service-visits/${id}/intake`,
                  {
                    expectedVersion: visit.version,
                    reason,
                    intake: intakePayload(draft),
                  },
                  "PATCH",
                );
              }}
            >
              <VisitIntakeFields
                value={draft}
                onChange={setDraft}
                onProcessing={setPhotoBusy}
                existingPhotos={visit.media.length}
                disabled={busy}
              />
              <label className="adm-field">
                Lý do cập nhật *
                <input
                  required
                  maxLength={400}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <div className="adm-action-row">
                <button
                  type="button"
                  className="adm-btn"
                  disabled={busy}
                  onClick={() => {
                    setEditing(false);
                    setDraft(null);
                  }}
                >
                  Bỏ thay đổi
                </button>
                <button
                  className="adm-btn adm-primary"
                  disabled={busy || photoBusy}
                >
                  Lưu thông tin
                </button>
              </div>
            </form>
          )}
          {visit.allowedActions.includes("inspect") && !editing && (
            <section className="adm-panel">
              <h2>Kiểm tra ban đầu</h2>
              <button
                className="adm-btn adm-primary"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      "Xác nhận đã hoàn tất kiểm tra ban đầu của xe?",
                    )
                  )
                    void run(`admin/service-visits/${id}/inspection`, {
                      expectedVersion: visit.version,
                      reason: "Đã kiểm tra tình trạng xe thực tế",
                    });
                }}
              >
                Hoàn tất kiểm tra ban đầu
              </button>
            </section>
          )}
          {visit.allowedActions.includes("contact") && !editing && (
            <section className="adm-panel">
              <h2>Ghi nhận liên hệ</h2>
              <form
                className="adm-booking-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(`admin/service-visits/${id}/contact-events`, {
                    expectedVersion: visit.version,
                    channel,
                    outcome,
                    note,
                  });
                }}
              >
                <div className="adm-form-grid">
                  <label className="adm-field">
                    Kênh liên hệ
                    <select
                      value={channel}
                      onChange={(e) => setChannel(e.target.value)}
                    >
                      {[
                        ["PHONE", "Điện thoại"],
                        ["ZALO", "Zalo"],
                        ["IN_PERSON", "Trực tiếp"],
                        ["OTHER", "Khác"],
                      ].map(([v, l]) => (
                        <option value={v} key={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="adm-field">
                    Kết quả
                    <select
                      value={outcome}
                      onChange={(e) => setOutcome(e.target.value)}
                    >
                      {[
                        ["UNREACHED", "Chưa liên hệ được"],
                        ["AGREED", "Đã thống nhất"],
                        ["DECLINED", "Khách từ chối"],
                        ["OTHER", "Khác"],
                      ].map(([v, l]) => (
                        <option value={v} key={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="adm-field adm-span-full">
                    Nội dung
                    <textarea
                      rows={2}
                      maxLength={1000}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </label>
                </div>
                <button className="adm-btn" disabled={busy}>
                  Lưu liên hệ
                </button>
              </form>
            </section>
          )}
          {manager && visit.allowedActions.includes("transfer") && !editing && (
            <section className="adm-panel">
              <h2>Chuyển cố vấn</h2>
              <form
                className="adm-booking-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(`admin/service-visits/${id}/transfer`, {
                    expectedVersion: visit.version,
                    toAdvisorId: advisor,
                    reason,
                  });
                }}
              >
                <label className="adm-field">
                  Cố vấn nhận *
                  <select
                    required
                    value={advisor}
                    onChange={(e) => setAdvisor(e.target.value)}
                  >
                    <option value="">Chọn cố vấn</option>
                    {staff
                      .filter(
                        (s) =>
                          s.id !== visit.assignedAdvisor.id && s.accountEnabled,
                      )
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="adm-field">
                  Lý do chuyển *
                  <input
                    required
                    maxLength={400}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <button className="adm-btn adm-primary" disabled={busy}>
                  Chuyển cố vấn
                </button>
              </form>
            </section>
          )}
          <section className="adm-panel">
            <h2>Lịch sử phiếu</h2>
            <ol className="adm-timeline adv-timeline">
              {events.map((e) => (
                <li key={e.id}>
                  <i />
                  <div>
                    <strong>{eventNames[e.type] || e.type}</strong>
                    <time>{at(e.occurredAt)}</time>
                    {e.reason && <p>{e.reason}</p>}
                    {e.type === "VISIT_CONTACT" && (
                      <p>
                        {
                          (
                            {
                              PHONE: "Điện thoại",
                              ZALO: "Zalo",
                              IN_PERSON: "Trực tiếp",
                              OTHER: "Khác",
                            } as Record<string, string>
                          )[String(e.data.channel)]
                        }{" "}
                        ·{" "}
                        {
                          (
                            {
                              UNREACHED: "Chưa liên hệ được",
                              AGREED: "Đã thống nhất",
                              DECLINED: "Khách từ chối",
                              OTHER: "Khác",
                            } as Record<string, string>
                          )[String(e.data.outcome)]
                        }{" "}
                        · {String(e.data.note || "")}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            {next && (
              <button
                className="adm-btn"
                disabled={busy}
                onClick={() => void moreEvents()}
              >
                Xem thêm lịch sử
              </button>
            )}
          </section>
        </>
      )}
    </div>
  );
}
