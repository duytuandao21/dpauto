"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import {
  apiEnabled,
  command,
  request,
  collection,
  ApiFailure,
} from "@/lib/api/client";
import type { ApiBooking, ApiService, ApiStaff } from "@/lib/api/types";
import type { ApiCustomer, ApiVehicle } from "@/lib/api/booking-adapter";
import {
  emptyIntake,
  intakePayload,
  type Intake,
  type Visit,
  type VisitReceipt,
  type VisitDetail,
} from "@/lib/api/visits";
import { useSession } from "@/components/admin/auth-gate";
import { AdminLoading, PageHeading } from "@/components/admin/primitives";
import { VisitIntakeFields } from "./visit-intake-fields";
import { AdminIcon } from "@/components/admin/admin-icon";

type Meta = {
  catalogVersion: number;
  policyVersion: number;
  privacyNoticeVersion: string;
};
export function LiveReception({
  id,
  manager = false,
}: {
  id?: string;
  manager?: boolean;
}) {
  return apiEnabled ? (
    <Suspense fallback={<AdminLoading />}>
      <RemoteReception key={id || "walk-in"} id={id} manager={manager} />
    </Suspense>
  ) : (
    <section className="adm-panel">
      <h1>Chưa kết nối dịch vụ tiếp nhận</h1>
    </section>
  );
}
function RemoteReception({
  id,
  manager = false,
}: {
  id?: string;
  manager?: boolean;
}) {
  const router = useRouter(),
    session = useSession()!;
  const followUp = useSearchParams().get("followUp");
  const [followUpReason, setFollowUpReason] = useState("");
  const root = manager ? "/dieu-hanh" : "/co-van";
  const [booking, setBooking] = useState<ApiBooking | null>(null),
    [existing, setExisting] = useState<Visit | null>(null);
  const [catalog, setCatalog] = useState<ApiService[]>([]),
    [staff, setStaff] = useState<ApiStaff[]>([]),
    [meta, setMeta] = useState<Meta | null>(null);
  const [customers, setCustomers] = useState<ApiCustomer[]>([]),
    [vehicles, setVehicles] = useState<ApiVehicle[]>([]);
  const [customerId, setCustomerId] = useState(""),
    [vehicleId, setVehicleId] = useState(""),
    [name, setName] = useState(""),
    [phone, setPhone] = useState("");
  const [model, setModel] = useState(""),
    [plate, setPlate] = useState(""),
    [changeReason, setChangeReason] = useState("");
  const [advisor, setAdvisor] = useState(""),
    [services, setServices] = useState<string[]>([]);
  const [draft, setDraft] = useState<Intake>(emptyIntake),
    [verified, setVerified] = useState(false),
    [notice, setNotice] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false),
    [dirty, setDirty] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [reload, setReload] = useState(0),
    submitted = useRef(false),
    initialized = useRef(false);
  useEffect(() => {
    const abort = new AbortController();
    setReady(false);
    setError("");
    const load = async () => {
      const response = await request<ApiService[]>("admin/services?limit=100", {
        signal: abort.signal,
      });
      setCatalog(
        response.page?.hasMore
          ? await collection<ApiService>("admin/services", abort.signal)
          : response.data,
      );
      setMeta({
        catalogVersion: Number(response.meta.catalogVersion),
        policyVersion: Number(response.meta.policyVersion),
        privacyNoticeVersion: String(response.meta.privacyNoticeVersion),
      });
      setStaff(
        await collection<ApiStaff>(
          "admin/staff?active=true&jobRole=ADVISOR",
          abort.signal,
        ),
      );
      if (id) {
        const b = (
          await request<ApiBooking>("admin/bookings/" + id, {
            signal: abort.signal,
          })
        ).data;
        setBooking(b);
        if (!initialized.current) {
          setVehicleId(b.vehicle?.id || "");
          initialized.current = true;
        }
        setVehicles(
          await collection<ApiVehicle>(
            "admin/vehicles?customerId=" + b.customerId,
            abort.signal,
          ),
        );
        setDraft((v) =>
          v.request
            ? v
            : {
                ...v,
                request:
                  b.customerNote || b.services.map((s) => s.name).join(", "),
              },
        );
        const visits = await request<Visit[]>(
          "admin/service-visits?bookingId=" + id,
          { signal: abort.signal },
        );
        setExisting(visits.data[0] || null);
      } else {
        setCustomers(
          await collection<ApiCustomer>("admin/customers", abort.signal),
        );
        setVehicles(
          await collection<ApiVehicle>("admin/vehicles", abort.signal),
        );
        if (followUp && !initialized.current) {
          const previous = (
            await request<VisitDetail>("admin/service-visits/" + followUp, {
              signal: abort.signal,
            })
          ).data;
          if (!["HANDED_OVER", "ABORTED"].includes(previous.stage))
            throw new Error(
              "Phiếu trước chưa đóng. Hãy tiếp tục xử lý trên phiếu hiện hành.",
            );
          setCustomerId(previous.customerId);
          setVehicleId(previous.vehicleId);
          setAdvisor(previous.assignedAdvisor.id);
          initialized.current = true;
        }
      }
    };
    load()
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setReady(true);
      });
    return () => abort.abort();
  }, [id, reload, followUp]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      if (!submitted.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const selectedVehicle = vehicleId
    ? vehicles.find((v) => v.id === vehicleId)
    : null;
  const vehiclePlate =
    selectedVehicle?.plate ||
    (vehicleId === booking?.vehicle?.id ? booking?.vehicle?.plate : null) ||
    plate;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || photoBusy || !meta) return;
    setBusy(true);
    setError("");
    try {
      const vehicle = vehicleId
        ? { id: vehicleId }
        : {
            model: model.trim() || undefined,
            plate: plate.trim() || undefined,
          };
      const value = await command<VisitReceipt>(
        id ? `admin/bookings/${id}/receive` : "admin/service-visits",
        id
          ? {
              expectedVersion: booking!.version,
              vehicle,
              vehicleVerified: verified,
              vehicleChangeReason: changeReason.trim() || undefined,
              policyVersion: meta.policyVersion,
              intake: intakePayload(draft),
            }
          : {
              customer: customerId
                ? { id: customerId }
                : { name: name.trim(), phone: phone.trim() },
              vehicle,
              vehicleVerified: verified,
              advisorId: advisor || session.staff.id,
              serviceIds: services,
              catalogVersion: meta.catalogVersion,
              policyVersion: meta.policyVersion,
              notice: {
                privacyNoticeVersion: meta.privacyNoticeVersion,
                privacyNoticeAcknowledged: notice,
              },
              intake: intakePayload(draft),
              followUpOfVisitId: followUp || undefined,
              followUpReason: followUp ? followUpReason.trim() : undefined,
            },
      );
      submitted.current = true;
      setDirty(false);
      window.dispatchEvent(new Event("dpauto-data-updated"));
      router.push(`${root}/phieu-dich-vu/${value.data.visitId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tiếp nhận được xe.");
      if (
        e instanceof ApiFailure &&
        [
          "POLICY_VERSION_CONFLICT",
          "CATALOG_VERSION_CONFLICT",
          "VERSION_CONFLICT",
        ].includes(e.code)
      )
        setReload((v) => v + 1);
    } finally {
      setBusy(false);
    }
  }
  if (!ready) return <AdminLoading />;
  if (existing)
    return (
      <section className="adm-panel">
        <PageHeading title="Xe đã tiếp nhận" />
        <Link
          className="adm-btn adm-primary"
          href={`${root}/phieu-dich-vu/${existing.id}`}
        >
          Mở phiếu dịch vụ
        </Link>
      </section>
    );
  if (!meta || (id && !booking))
    return (
      <section className="adm-panel">
        <p role="alert">{error || "Không tìm thấy lịch hẹn."}</p>
        <button className="adm-btn" onClick={() => setReload((n) => n + 1)}>
          Tải lại
        </button>
      </section>
    );
  if (booking && booking.status !== "CONFIRMED")
    return (
      <section className="adm-panel">
        <PageHeading
          title="Chưa thể tiếp nhận"
          description="Xác nhận lịch hẹn trước khi tiếp nhận xe."
        />
      </section>
    );
  return (
    <div className="adm-form-page adv-page">
      {!manager && (
        <Link
          className="adm-mobile-back adm-text-link"
          href={id ? `${root}/lich-hen/${id}` : `${root}/phieu-dich-vu`}
        >
          <AdminIcon name="back" />
          {id ? "Chi tiết lịch hẹn" : "Xe dịch vụ"}
        </Link>
      )}
      <PageHeading
        eyebrow={manager ? "ĐIỀU HÀNH / TIẾP NHẬN" : "CỐ VẤN / TIẾP NHẬN XE"}
        title={id ? "Tiếp nhận xe" : "Tiếp nhận xe trực tiếp"}
        description={
          booking
            ? `${booking.customer.name} · ${booking.customer.phone}`
            : undefined
        }
      />
      <form
        className="adm-booking-form"
        onSubmit={submit}
        onChange={() => setDirty(true)}
      >
        {!id && followUp && (
          <section className="adm-panel">
            <h2>Tiếp nhận xe quay lại</h2>
            <label className="adm-field">
              Lý do quay lại *
              <textarea
                required
                maxLength={400}
                rows={2}
                value={followUpReason}
                onChange={(e) => setFollowUpReason(e.target.value)}
              />
            </label>
          </section>
        )}
        <fieldset
          disabled={busy}
          className="adv-stack adv-checks"
          aria-label="Khách hàng và xe"
        >
          <section className="adm-panel">
            {manager ? (
              <h2>Khách hàng và xe</h2>
            ) : (
              <div className="adm-form-section-title">
                <span>1</span>
                <div>
                  <h2>Khách hàng và xe</h2>
                  <p>
                    {id
                      ? "Thông tin lấy từ lịch đã xác nhận."
                      : "Đối chiếu thông tin khách hàng và xe thực tế."}
                  </p>
                </div>
              </div>
            )}
            <div className="adm-form-grid">
              {!id && (
                <>
                  <label className="adm-field">
                    Khách hàng
                    <select
                      value={customerId}
                      onChange={(e) => {
                        setCustomerId(e.target.value);
                        setVehicleId("");
                        setVerified(false);
                      }}
                    >
                      <option value="">Tạo khách hàng mới</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} · {c.phone}
                        </option>
                      ))}
                    </select>
                  </label>
                  {!customerId && (
                    <>
                      <label className="adm-field">
                        Họ tên *
                        <input
                          required
                          maxLength={100}
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                        />
                      </label>
                      <label className="adm-field">
                        Số điện thoại *
                        <input
                          required
                          type="tel"
                          maxLength={30}
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                        />
                      </label>
                    </>
                  )}
                  {customerId && (
                    <label className="adm-field">
                      Xe của khách
                      <select
                        value={vehicleId}
                        onChange={(e) => {
                          setVehicleId(e.target.value);
                          setVerified(false);
                        }}
                      >
                        <option value="">Thêm xe mới</option>
                        {vehicles
                          .filter((v) =>
                            v.customerContacts.some(
                              (c) => c.customerId === customerId,
                            ),
                          )
                          .map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.plate || v.model}
                            </option>
                          ))}
                      </select>
                    </label>
                  )}
                </>
              )}
              {id && booking && (
                <label className="adm-field">
                  Xe tiếp nhận
                  <select
                    value={vehicleId}
                    onChange={(e) => {
                      setVehicleId(e.target.value);
                      if (!e.target.value) {
                        setModel("");
                        setPlate("");
                      }
                      setVerified(false);
                    }}
                  >
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.plate || v.model}
                        {v.id === booking.vehicle?.id ? " · Xe trong lịch" : ""}
                      </option>
                    ))}
                    <option value="">Bổ sung xe mới</option>
                  </select>
                </label>
              )}
              {!vehicleId && (
                <>
                  <label className="adm-field">
                    Dòng xe *
                    <input
                      required
                      maxLength={100}
                      value={model}
                      onChange={(e) => {
                        setModel(e.target.value);
                        setVerified(false);
                      }}
                    />
                  </label>
                  <label className="adm-field">
                    Biển số
                    <input
                      maxLength={20}
                      value={plate}
                      onChange={(e) => {
                        setPlate(e.target.value);
                        setVerified(false);
                      }}
                    />
                  </label>
                </>
              )}
              {id && vehicleId !== booking?.vehicle?.id && (
                <label className="adm-field">
                  Lý do bổ sung/đổi xe *
                  <input
                    required
                    maxLength={400}
                    value={changeReason}
                    onChange={(e) => setChangeReason(e.target.value)}
                  />
                </label>
              )}
              {!vehiclePlate && (
                <label className="adm-field">
                  Lý do chưa có biển số *
                  <input
                    required
                    maxLength={400}
                    value={draft.plateMissingReason || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, plateMissingReason: e.target.value })
                    }
                  />
                </label>
              )}
              {!id && session.roles.includes("MANAGER") && (
                <label className="adm-field">
                  Cố vấn phụ trách *
                  <select
                    required
                    value={advisor}
                    onChange={(e) => setAdvisor(e.target.value)}
                  >
                    <option value="">Chọn cố vấn</option>
                    {staff
                      .filter((s) => s.accountEnabled)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </label>
              )}
            </div>
            <label className="adv-checks">
              <input
                type="checkbox"
                required
                checked={verified}
                onChange={(e) => setVerified(e.target.checked)}
              />{" "}
              Đã đối chiếu xe thực tế với khách hàng
            </label>
          </section>
          {!id && (
            <section className="adm-panel">
              <h2>Dịch vụ cần tiếp nhận</h2>
              {!catalog.some((s) => s.active && s.bookable) && (
                <p className="adm-muted">Chưa có dịch vụ đang mở tiếp nhận.</p>
              )}
              <div className="adv-check-grid">
                {catalog
                  .filter((s) => s.active && s.bookable)
                  .map((s) => (
                    <label key={s.id}>
                      <input
                        type="checkbox"
                        checked={services.includes(s.id)}
                        onChange={(e) =>
                          setServices(
                            e.target.checked
                              ? [...services, s.id]
                              : services.filter((x) => x !== s.id),
                          )
                        }
                      />
                      {s.name}
                    </label>
                  ))}
              </div>
            </section>
          )}
        </fieldset>
        <VisitIntakeFields
          numbered={!manager}
          value={draft}
          disabled={busy}
          onProcessing={setPhotoBusy}
          onChange={(v) => {
            setDraft(v);
            setDirty(true);
          }}
        />
        {!id && (
          <label className="adv-checks">
            <input
              type="checkbox"
              required
              checked={notice}
              onChange={(e) => setNotice(e.target.checked)}
            />{" "}
            Khách đã được thông báo về việc sử dụng thông tin để tiếp nhận và
            liên hệ dịch vụ.{" "}
            <Link href="/chinh-sach-dat-lich" target="_blank">
              Xem chính sách
            </Link>
          </label>
        )}
        {error && (
          <p className="adm-error-text" role="alert">
            {error}
          </p>
        )}
        <div className="adm-form-footer">
          <Link
            className="adm-btn"
            href={`${root}/${id ? "lich-hen" : "phieu-dich-vu"}`}
            onClick={(e) => {
              if (dirty && !window.confirm("Rời form và bỏ thay đổi chưa lưu?"))
                e.preventDefault();
            }}
          >
            Quay lại
          </Link>
          <button
            className="adm-btn adm-primary"
            disabled={busy || photoBusy || (!id && !services.length)}
          >
            {busy ? "Đang tiếp nhận…" : "Hoàn tất tiếp nhận"}
          </button>
        </div>
      </form>
    </div>
  );
}
