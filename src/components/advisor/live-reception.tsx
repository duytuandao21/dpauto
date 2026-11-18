"use client";
import {
  formatOdometer,
  formatPhone,
  formatPlate,
} from "@/lib/advisor/formats";
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
import {
  VisitIntakeFields,
  VisitInspectionFields,
} from "./visit-intake-fields";
import { AdminIcon } from "@/components/admin/admin-icon";
import { formatDate, timeLabel } from "@/lib/booking/logic";

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
    [plate, setPlate] = useState("");
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
    initialized = useRef(false),
    submitting = useRef(false),
    invalidFocused = useRef(false),
    errorRef = useRef<HTMLParagraphElement>(null);
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
          setServices(b.services.map((s) => s.id));
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
                request: [
                  b.services.map((s) => s.name).join(", "),
                  b.customerNote,
                ]
                  .filter(Boolean)
                  .join("\n")
                  .slice(0, 2000),
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
          if (!["HANDED_OVER", "COMPLETED", "ABORTED"].includes(previous.stage))
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
  useEffect(() => {
    if (error && ready) errorRef.current?.focus();
  }, [error, ready]);
  const selectedVehicle = vehicleId
    ? vehicles.find((v) => v.id === vehicleId)
    : null;
  const vehiclePlate =
    selectedVehicle?.plate ||
    (vehicleId === booking?.vehicle?.id ? booking?.vehicle?.plate : null) ||
    plate;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || photoBusy || !meta || submitting.current || submitted.current)
      return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const vehicle = vehicleId
        ? { id: vehicleId }
        : {
            model: model.trim() || undefined,
            plate: formatPlate(plate) || undefined,
          };
      const value = await command<VisitReceipt>(
        id ? `admin/bookings/${id}/receive` : "admin/service-visits",
        id
          ? {
              expectedVersion: booking!.version,
              vehicle,
              vehicleVerified: verified,
              serviceIds: services,
              catalogVersion: meta.catalogVersion,
              policyVersion: meta.policyVersion,
              intake: intakePayload(draft),
            }
          : {
              customer: customerId
                ? { id: customerId }
                : { name: name.trim(), phone: formatPhone(phone) },
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
            },
      );
      submitted.current = true;
      setDirty(false);
      window.dispatchEvent(new Event("dpauto-data-updated"));
      router.push(`${root}/phieu-dich-vu/${value.data.visitId}`);
    } catch (e) {
      if (
        e instanceof ApiFailure &&
        e.code === "VALIDATION_FAILED" &&
        e.fields.length
      ) {
        const labels: Record<string, string> = {
          customer: "Thông tin khách hàng",
          vehicle: "Thông tin xe",
          vehicleVerified: "Xác nhận đối chiếu xe",
          advisorId: "Cố vấn phụ trách",
          serviceIds: "Dịch vụ đã chọn",
          catalogVersion: "Phiên bản danh mục dịch vụ",
          policyVersion: "Cấu hình tiếp nhận",
          expectedVersion: "Phiên bản lịch hẹn",
          notice: "Xác nhận thông báo cho khách",
          intake: "Thông tin tiếp nhận",
          "intake.request": "Yêu cầu của khách",
          "intake.odometer": "ODO (từ 0 đến 9.999.999 km)",
          "intake.receptionNote": "Ghi chú tiếp nhận (tối đa 1.000 ký tự)",
          "intake.conditions": "Kiểm tra tình trạng xe",
          "intake.photos": "Hình ảnh tiếp nhận",
        };
        setError(
          e.fields.some(
            (field) => field.path === "" && field.code === "unrecognized_keys",
          )
            ? "Form và API tiếp nhận không cùng phiên bản. Vui lòng cập nhật và khởi động lại API rồi thử lại."
            : "Vui lòng kiểm tra: " +
                [
                  ...new Set(
                    e.fields.map(
                      ({ path }) =>
                        labels[path.split(".").slice(0, 2).join(".")] ||
                        labels[path.split(".")[0]] ||
                        "Thông tin tiếp nhận",
                    ),
                  ),
                ].join(", ") +
                ".",
        );
      } else {
        setError(e instanceof Error ? e.message : "Không tiếp nhận được xe.");
      }
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
      submitting.current = false;
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
  const customer = booking?.customer ||
    customers.find((c) => c.id === customerId) || { name, phone };
  const vehicleModel =
    selectedVehicle?.model ||
    (vehicleId === booking?.vehicle?.id ? booking?.vehicle?.model : null) ||
    model;
  const appointment = booking
    ? booking.confirmedStartAt || booking.scheduledStartAt
    : null;
  const updateIntake = (value: Intake) => {
    setDraft(value);
    setDirty(true);
  };
  const availableServices = catalog.filter(
    (s) => (s.active && s.bookable) || services.includes(s.id),
  );
  const serviceOptions = [
    ...availableServices,
    ...(booking?.services || []).filter(
      (s) => !availableServices.some((option) => option.id === s.id),
    ),
  ];
  const servicePicker = (
    <div className="adv-check-grid adv-reception-services">
      {serviceOptions.map((s) => (
        <label key={s.id}>
          <input
            type="checkbox"
            checked={services.includes(s.id)}
            disabled={!services.includes(s.id) && services.length >= 10}
            onChange={(e) => {
              const next = e.target.checked
                ? [...services, s.id]
                : services.filter((v) => v !== s.id);
              if (booking) {
                const requestFor = (ids: string[]) =>
                  [
                    ids
                      .map(
                        (id) =>
                          booking.services.find((item) => item.id === id)
                            ?.name ||
                          serviceOptions.find((item) => item.id === id)?.name,
                      )
                      .filter(Boolean)
                      .join(", "),
                    booking.customerNote,
                  ]
                    .filter(Boolean)
                    .join("\n")
                    .slice(0, 2000);
                setDraft((value) =>
                  value.request === requestFor(services)
                    ? { ...value, request: requestFor(next) }
                    : value,
                );
              }
              setServices(next);
              setDirty(true);
            }}
          />
          {s.name}
        </label>
      ))}
      {!serviceOptions.length && (
        <p className="adm-muted">Chưa có dịch vụ đang mở tiếp nhận.</p>
      )}
      {serviceOptions.length > 0 && (
        <p className="adm-muted adm-span-full">
          Đã chọn {services.length}/10 dịch vụ (tối thiểu 1).
        </p>
      )}
    </div>
  );
  const checks = [
    [!!(customer.name.trim() && customer.phone.trim()), "Thông tin khách hàng"],
    [!!vehicleId || !!model.trim(), "Thông tin xe"],
    [verified, "Đã xác minh khách và xe"],
    [!!draft.request.trim(), "Yêu cầu khách hàng"],
  ] as const;
  return (
    <div className="adm-form-page adv-page adv-reception">
      {!manager && (
        <Link
          className="adm-mobile-back adm-text-link"
          href={id ? `${root}/lich-hen/${id}` : `${root}/phieu-dich-vu`}
        >
          <AdminIcon name="back" />
          {id ? "Chi tiết lịch hẹn" : "Phiếu dịch vụ"}
        </Link>
      )}
      <header className="adm-panel adv-reception-header">
        <div>
          <h1>Tiếp nhận xe</h1>
          <p>
            {booking
              ? `${booking.code} · ${customer.name}`
              : followUp
                ? "Tiếp nhận xe quay lại"
                : "Tiếp nhận trực tiếp"}
          </p>
        </div>
        <span className="adm-badge adm-status-pending">Đang tiếp nhận</span>
      </header>
      <form
        className="adm-booking-form"
        onSubmit={submit}
        onChange={() => setDirty(true)}
        onInvalidCapture={(e) => {
          if (invalidFocused.current) return;
          invalidFocused.current = true;
          const field = e.target as HTMLInputElement;
          field.closest("details")?.setAttribute("open", "");
          field.setAttribute("aria-invalid", "true");
          field.focus();
          field.scrollIntoView({ block: "center" });
          requestAnimationFrame(() => {
            invalidFocused.current = false;
          });
        }}
        onInput={(e) =>
          (e.target as HTMLElement).removeAttribute("aria-invalid")
        }
      >
        <fieldset disabled={busy || photoBusy} className="adv-reception-fields">
          <legend className="adv-sr-only">Thông tin tiếp nhận xe</legend>
          <div className="adv-reception-grid">
            <section className="adm-panel adv-stack adv-reception-customer">
              <h2>
                <AdminIcon name="user" />
                Khách hàng
              </h2>
              {!id && (
                <label className="adm-field">
                  Khách tiếp nhận
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
                        {c.name} · {formatPhone(c.phone)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {!id && !customerId ? (
                <>
                  <label className="adm-field">
                    Họ tên *
                    <input
                      required
                      maxLength={100}
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        setVerified(false);
                      }}
                    />
                  </label>
                  <label className="adm-field">
                    Số điện thoại *
                    <input
                      required
                      type="tel"
                      maxLength={30}
                      value={phone}
                      onBlur={() => setPhone(formatPhone(phone))}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        setVerified(false);
                      }}
                    />
                  </label>
                </>
              ) : (
                <div>
                  <strong>{customer.name}</strong>
                  <p>
                    <a href={`tel:${formatPhone(customer.phone)}`}>
                      {formatPhone(customer.phone)}
                    </a>
                  </p>
                </div>
              )}
              <label className="adv-reception-verify">
                <input
                  type="checkbox"
                  required
                  checked={verified}
                  onChange={(e) => setVerified(e.target.checked)}
                />
                Đã đối chiếu xe thực tế với khách hàng
              </label>
            </section>
            <div className="adv-reception-main">
              <section className="adm-panel adv-stack adv-reception-vehicle">
                <h2>
                  <AdminIcon name="car" />
                  01. Thông tin xe
                </h2>
                <div className="adm-form-grid">
                  {(booking || customerId) && (
                    <label className="adm-field adm-span-full">
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
                        {(booking
                          ? vehicles
                          : vehicles.filter((v) =>
                              v.customerContacts.some(
                                (c) => c.customerId === customerId,
                              ),
                            )
                        ).map((v) => (
                          <option key={v.id} value={v.id}>
                            {[v.model, formatPlate(v.plate)]
                              .filter(Boolean)
                              .join(" · ")}
                            {v.id === booking?.vehicle?.id
                              ? " · Xe trong lịch"
                              : ""}
                          </option>
                        ))}
                        <option value="">Bổ sung xe mới</option>
                      </select>
                    </label>
                  )}
                  <label className="adm-field adm-span-full">
                    Dòng xe
                    {vehicleId ? (
                      <input
                        readOnly
                        value={vehicleModel || "Chưa có thông tin"}
                      />
                    ) : (
                      <input
                        required
                        maxLength={100}
                        value={model}
                        onChange={(e) => {
                          setModel(e.target.value);
                          setVerified(false);
                        }}
                      />
                    )}
                  </label>
                  <label className="adm-field">
                    Biển số
                    {vehicleId ? (
                      <input
                        readOnly
                        value={vehiclePlate || "Chưa có biển số"}
                      />
                    ) : (
                      <input
                        maxLength={20}
                        placeholder="Xe chưa có biển số có thể để trống"
                        value={plate}
                        onBlur={() => setPlate(formatPlate(plate))}
                        onChange={(e) => {
                          setPlate(e.target.value);
                          setVerified(false);
                        }}
                      />
                    )}
                  </label>
                  <label className="adm-field">
                    Nguồn xe
                    <select disabled defaultValue="">
                      <option value="">Chưa hỗ trợ lưu nguồn xe</option>
                      <option value="CUSTOMER">Khách hàng thông thường</option>
                      <option value="TOAN_TRUNG">Xe Lướt Toàn Trung</option>
                    </select>
                  </label>
                  {!id && session.roles.includes("MANAGER") && (
                    <label className="adm-field adm-span-full">
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
              </section>
              <div className="adv-reception-intake">
                <VisitIntakeFields
                  reception
                  numbered
                  inspection={false}
                  value={draft}
                  disabled={busy}
                  onChange={updateIntake}
                  serviceSummary={servicePicker}
                />
              </div>
            </div>
            <aside
              className="adv-reception-context"
              aria-label="Khách hàng, lịch hẹn và kiểm tra xe"
            >
              <section className="adm-panel adv-stack adv-reception-appointment">
                <h2>
                  <AdminIcon name="calendar" />
                  Lịch hẹn
                </h2>
                {booking && appointment ? (
                  <dl className="adv-reception-facts">
                    <div>
                      <dt>Mã lịch</dt>
                      <dd>{booking.code}</dd>
                    </div>
                    <div>
                      <dt>Giờ hẹn</dt>
                      <dd>
                        {formatDate(appointment)} · {timeLabel(appointment)}
                      </dd>
                    </div>
                    <div>
                      <dt>Cố vấn</dt>
                      <dd>
                        {booking.assignedAdvisor?.name || "Chưa phân công"}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <p className="adm-muted">
                    Không có lịch hẹn · Tiếp nhận trực tiếp
                  </p>
                )}
              </section>
              <div className="adv-reception-inspection">
                <VisitInspectionFields
                  collapsible
                  value={draft}
                  disabled={busy}
                  onProcessing={setPhotoBusy}
                  onChange={updateIntake}
                />
              </div>
              <section className="adm-panel adv-stack adv-reception-checklist">
                <h2>
                  <AdminIcon name="check" />
                  Thông tin đã ghi nhận
                </h2>
                <ul>
                  {checks.map(([complete, label]) => (
                    <li key={label} className={complete ? "is-complete" : ""}>
                      <AdminIcon name={complete ? "check" : "time"} />
                      <span>{label}</span>
                      <span className="adv-sr-only">
                        {complete ? "Đã có" : "Chưa có"}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="adm-muted">
                  {draft.odometer === null
                    ? "Chưa ghi nhận ODO (không bắt buộc)"
                    : `ODO: ${formatOdometer(draft.odometer)} km`}
                </p>
              </section>
            </aside>
          </div>
          {!id && (
            <label className="adv-reception-notice">
              <input
                type="checkbox"
                required
                checked={notice}
                onChange={(e) => setNotice(e.target.checked)}
              />{" "}
              <span>
                Khách đã được thông báo về việc sử dụng thông tin để tiếp nhận
                và liên hệ dịch vụ.{" "}
                <Link href="/chinh-sach-dat-lich" target="_blank">
                  Xem chính sách
                </Link>
              </span>
            </label>
          )}
        </fieldset>
        {error && (
          <p
            id="reception-error"
            ref={errorRef}
            tabIndex={-1}
            className="adm-error-text"
            role="alert"
          >
            {error}
          </p>
        )}
        <div className="adm-form-footer adv-reception-footer">
          <Link
            className="adm-btn"
            href={`${root}/${id ? "lich-hen" : "phieu-dich-vu"}`}
            onClick={(e) => {
              if (
                busy ||
                photoBusy ||
                (dirty && !window.confirm("Rời form và bỏ thay đổi chưa lưu?"))
              )
                e.preventDefault();
            }}
          >
            Quay lại
          </Link>
          <button
            className="adm-btn adm-primary"
            disabled={busy || photoBusy || !services.length}
          >
            {busy ? "Đang tiếp nhận…" : "Hoàn tất tiếp nhận"}
          </button>
        </div>
      </form>
    </div>
  );
}
