"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  bookingServices as seedServices,
  advisors as seedAdvisors,
} from "@/lib/booking/seed";
import { apiEnabled } from "@/lib/api/client";
import { useSession } from "./auth-gate";
import {
  bookingTime,
  localDate,
  sources,
  terminal,
  validateDraft,
} from "@/lib/booking/logic";
import type { Booking, BookingDraft } from "@/lib/booking/types";
import { useBookings } from "./booking-provider";
import { AdminIcon } from "./admin-icon";
import { AdminLoading, NotFoundState, PageHeading } from "./primitives";

function Field({
  label,
  name,
  error,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`adm-field ${error ? "has-error" : ""}`}>
      <label htmlFor={name}>{label}</label>
      {children}
      {error && (
        <span id={`${name}-error`} className="adm-error-text" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
export function BookingForm({ existing }: { existing?: Booking }) {
  const { ready } = useBookings();
  if (!ready) return <AdminLoading />;
  if (existing && terminal(existing.status)) return <NotFoundState />;
  return <FormContent key={existing?.id || "new"} existing={existing} />;
}
function FormContent({ existing }: { existing?: Booking }) {
  const { data, saveBooking, ask, notify } = useBookings(),
    router = useRouter(),
    params = useSearchParams();
  const bookingServices = data.services ?? seedServices,
    advisors = data.advisors ?? seedAdvisors;
  const session = useSession();
  const selectedCustomer = data.customers.find(
      (c) => c.id === (existing?.customerId || params.get("customer")),
    ),
    selectedVehicle =
      data.vehicles.find((v) => v.id === existing?.vehicleId) ||
      data.vehicles.find(
        (v) =>
          v.customerId === selectedCustomer?.id ||
          (!!selectedCustomer && v.customerIds?.includes(selectedCustomer.id)),
      );
  const initial: BookingDraft = {
    customerId: selectedCustomer?.id || "",
    name: existing?.customerSnapshot?.name || selectedCustomer?.name || "",
    phone: existing?.customerSnapshot?.phone || selectedCustomer?.phone || "",
    vehicleId: selectedVehicle?.id || "",
    model: existing?.vehicleSnapshot?.model || selectedVehicle?.model || "",
    plate: existing?.vehicleSnapshot?.plate || selectedVehicle?.plate || "",
    serviceIds: existing?.serviceIds || [],
    date: existing ? bookingTime(existing).slice(0, 10) : localDate(),
    time: existing ? bookingTime(existing).slice(11, 16) : "09:00",
    confirmedDate: existing?.confirmedAt?.slice(0, 10) || "",
    confirmedTime: existing?.confirmedAt?.slice(11, 16) || "",
    advisorId:
      existing?.advisorId ||
      (session?.roles.includes("ADVISOR")
        ? session.staff.id
        : advisors[0]?.id || ""),
    source: existing?.source || "Điện thoại",
    customerNote: existing?.customerNote || "",
    internalNote: existing?.internalNote || "",
  };
  const [draft, setDraft] = useState(initial),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [saving, setSaving] = useState(false);
  const [noticeAcknowledged, setNoticeAcknowledged] = useState(false);
  const baseline = useRef(JSON.stringify(initial)),
    form = useRef<HTMLFormElement>(null),
    saved = useRef(false),
    dirty = JSON.stringify(draft) !== baseline.current;
  useEffect(() => {
    function guard(e: BeforeUnloadEvent) {
      if (dirty && !saved.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  function set<K extends keyof BookingDraft>(key: K, value: BookingDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  }
  function customerChange(id: string) {
    const c = data.customers.find((c) => c.id === id),
      v = data.vehicles.find(
        (v) => v.customerId === id || v.customerIds?.includes(id),
      );
    setDraft((d) => ({
      ...d,
      customerId: id,
      name: c?.name || "",
      phone: c?.phone || "",
      vehicleId: v?.id || "",
      model: v?.model || "",
      plate: v?.plate || "",
    }));
    setErrors({});
  }
  async function save() {
    setSaving(true);
    try {
      const booking = await saveBooking(draft, existing?.id);
      saved.current = true;
      router.push(
        `/co-van/lich-hen/${booking.id}?date=${bookingTime(booking).slice(0, 10)}`,
      );
    } catch (e) {
      setSaving(false);
      notify(e instanceof Error ? e.message : "Chưa thể lưu lịch hẹn.");
    }
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (apiEnabled && !existing && !noticeAcknowledged) {
      notify("Vui lòng xác nhận đã cung cấp thông tin đặt lịch cho khách.");
      return;
    }
    const validation = validateDraft(draft, localDate(), existing);
    if (Object.keys(validation).length) {
      setErrors(validation);
      requestAnimationFrame(() =>
        form.current
          ?.querySelector<HTMLElement>('[aria-invalid="true"]')
          ?.focus(),
      );
      return;
    }
    const requested = `${draft.confirmedDate || draft.date}T${draft.confirmedTime || draft.time}:00`;
    const overlaps = data.bookings.filter(
      (b) =>
        b.id !== existing?.id &&
        !terminal(b.status) &&
        Math.abs(
          new Date(bookingTime(b)).getTime() - new Date(requested).getTime(),
        ) <
          data.capacity.slotMinutes * 60000,
    );
    const conflict =
      overlaps.some(
        (b) =>
          b.advisorId === draft.advisorId || b.vehicleId === draft.vehicleId,
      ) || overlaps.length >= data.capacity.carsPerSlot;
    if (conflict && !apiEnabled) {
      ask({
        title: "Khung giờ có thể bị trùng",
        message: `Có ${overlaps.length} lịch gần thời gian này, trùng cố vấn/xe hoặc có thể vượt giới hạn tiếp nhận. Bạn vẫn muốn lưu lịch?`,
        label: "Vẫn lưu lịch",
        onConfirm: save,
      });
      return;
    }
    save();
  }
  function cancel() {
    const go = () =>
      router.push(
        existing ? `/co-van/lich-hen/${existing.id}` : "/co-van/lich-hen",
      );
    if (dirty)
      ask({
        title: "Bỏ thay đổi chưa lưu?",
        message: "Thông tin bạn vừa nhập chưa được lưu.",
        label: "Bỏ thay đổi",
        danger: true,
        onConfirm: go,
      });
    else go();
  }
  const inputProps = (name: string) => ({
    id: name,
    "aria-invalid": !!errors[name],
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });
  return (
    <div className="adm-form-page">
      <button className="adm-text-link" onClick={cancel}>
        <AdminIcon name="back" />
        Quay lại lịch hẹn
      </button>
      <PageHeading
        eyebrow="CỐ VẤN DỊCH VỤ"
        title={existing ? "Chỉnh sửa lịch hẹn" : "Tạo lịch hẹn"}
        description="Nhập thông tin để cố vấn chuẩn bị tiếp nhận xe chu đáo."
      />
      <form
        ref={form}
        className="adm-booking-form"
        onSubmit={submit}
        noValidate
      >
        <section className="adm-panel">
          <div className="adm-form-section-title">
            <span>01</span>
            <div>
              <h2>Khách hàng & xe</h2>
              <p>Chọn hồ sơ có sẵn hoặc nhập khách mới.</p>
            </div>
          </div>
          <div className="adm-form-grid">
            <div className="adm-field adm-span-full">
              <label htmlFor="customerId">Hồ sơ khách hàng</label>
              <select
                id="customerId"
                value={draft.customerId}
                onChange={(e) => customerChange(e.target.value)}
              >
                <option value="">+ Khách hàng mới</option>
                {data.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.phone}
                  </option>
                ))}
              </select>
            </div>
            <Field label="Họ và tên *" name="name" error={errors.name}>
              <input
                {...inputProps("name")}
                autoComplete="name"
                value={draft.name}
                readOnly={apiEnabled && !existing && !!draft.customerId}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Nhập họ tên khách hàng"
              />
            </Field>
            <Field label="Số điện thoại *" name="phone" error={errors.phone}>
              <input
                {...inputProps("phone")}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={draft.phone}
                readOnly={apiEnabled && !existing && !!draft.customerId}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="09xx xxx xxx"
              />
            </Field>
            {draft.customerId && (
              <div className="adm-field adm-span-full">
                <label htmlFor="vehicleId">Xe của khách</label>
                <select
                  id="vehicleId"
                  value={draft.vehicleId}
                  onChange={(e) => {
                    const v = data.vehicles.find(
                      (v) => v.id === e.target.value,
                    );
                    setDraft((d) => ({
                      ...d,
                      vehicleId: e.target.value,
                      model: v?.model || "",
                      plate: v?.plate || "",
                    }));
                  }}
                >
                  <option value="">+ Thêm xe khác</option>
                  {data.vehicles
                    .filter(
                      (v) =>
                        v.customerId === draft.customerId ||
                        v.customerIds?.includes(draft.customerId),
                    )
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.model} · {v.plate || "Chưa có biển số"}
                      </option>
                    ))}
                </select>
              </div>
            )}
            <Field label="Dòng xe *" name="model" error={errors.model}>
              <input
                {...inputProps("model")}
                value={draft.model}
                readOnly={apiEnabled && !!draft.vehicleId}
                onChange={(e) => set("model", e.target.value)}
                placeholder="VD: Toyota Vios"
              />
            </Field>
            <Field label="Biển số (không bắt buộc)" name="plate">
              <input
                id="plate"
                value={draft.plate}
                readOnly={apiEnabled && !!draft.vehicleId}
                onChange={(e) => set("plate", e.target.value)}
                placeholder="VD: 51G-123.45"
              />
            </Field>
          </div>
        </section>
        <section className="adm-panel">
          <div className="adm-form-section-title">
            <span>02</span>
            <div>
              <h2>Dịch vụ & thời gian</h2>
              <p>Chọn các hạng mục cần thực hiện và khung giờ mong muốn.</p>
            </div>
          </div>
          <fieldset
            className="adm-service-options"
            aria-describedby={
              errors.serviceIds ? "serviceIds-error" : undefined
            }
          >
            <legend>Dịch vụ cần thực hiện *</legend>
            {bookingServices.map((s) => (
              <label
                key={s.id}
                className={draft.serviceIds.includes(s.id) ? "is-selected" : ""}
              >
                <input
                  type="checkbox"
                  checked={draft.serviceIds.includes(s.id)}
                  onChange={(e) =>
                    set(
                      "serviceIds",
                      e.target.checked
                        ? [...draft.serviceIds, s.id]
                        : draft.serviceIds.filter((id) => id !== s.id),
                    )
                  }
                />
                <span>
                  <strong>{s.name}</strong>
                  <small>Khoảng {s.duration} phút</small>
                </span>
              </label>
            ))}
          </fieldset>
          {errors.serviceIds && (
            <p id="serviceIds-error" className="adm-error-text" role="alert">
              {errors.serviceIds}
            </p>
          )}
          <div className="adm-form-grid">
            <Field label="Ngày mong muốn *" name="date" error={errors.date}>
              <input
                {...inputProps("date")}
                type="date"
                min={existing ? undefined : localDate()}
                value={draft.date}
                readOnly={apiEnabled && !!existing}
                onChange={(e) => set("date", e.target.value)}
              />
            </Field>
            <Field label="Giờ mong muốn *" name="time" error={errors.time}>
              <input
                {...inputProps("time")}
                type="time"
                value={draft.time}
                readOnly={apiEnabled && !!existing}
                onChange={(e) => set("time", e.target.value)}
              />
            </Field>
            {!apiEnabled && (
              <Field
                label="Ngày xác nhận (tùy chọn)"
                name="confirmedDate"
                error={errors.confirmedDate}
              >
                <input
                  {...inputProps("confirmedDate")}
                  type="date"
                  min={existing ? undefined : localDate()}
                  value={draft.confirmedDate}
                  onChange={(e) => set("confirmedDate", e.target.value)}
                />
              </Field>
            )}
            {!apiEnabled && (
              <Field
                label="Giờ xác nhận (tùy chọn)"
                name="confirmedTime"
                error={errors.confirmedTime}
              >
                <input
                  {...inputProps("confirmedTime")}
                  type="time"
                  value={draft.confirmedTime}
                  onChange={(e) => set("confirmedTime", e.target.value)}
                />
              </Field>
            )}
          </div>
          {!apiEnabled && (
            <p className="adm-field-help">
              Lịch mới có đủ ngày giờ xác nhận sẽ ở trạng thái “Đã xác nhận”. Bỏ
              trống để chờ xác nhận.
            </p>
          )}
        </section>
        <section className="adm-panel">
          <div className="adm-form-section-title">
            <span>03</span>
            <div>
              <h2>Phân công & ghi chú</h2>
              <p>Thông tin hỗ trợ cố vấn chuẩn bị trước khi xe đến.</p>
            </div>
          </div>
          <div className="adm-form-grid">
            <Field
              label="Cố vấn phụ trách *"
              name="advisorId"
              error={errors.advisorId}
            >
              <select
                {...inputProps("advisorId")}
                value={draft.advisorId}
                disabled={
                  apiEnabled &&
                  (session?.roles.includes("ADVISOR") || !!existing)
                }
                onChange={(e) => set("advisorId", e.target.value)}
              >
                {advisors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Nguồn đặt lịch" name="source">
              <select
                id="source"
                disabled={apiEnabled && !!existing}
                value={draft.source}
                onChange={(e) =>
                  set("source", e.target.value as BookingDraft["source"])
                }
              >
                {sources
                  .filter(
                    (s) =>
                      !apiEnabled ||
                      !!existing ||
                      !["Website", "QR"].includes(s),
                  )
                  .map((s) => (
                    <option key={s}>{s}</option>
                  ))}
              </select>
            </Field>
            <Field label="Ghi chú khách hàng" name="customerNote">
              <textarea
                id="customerNote"
                rows={3}
                value={draft.customerNote}
                onChange={(e) => set("customerNote", e.target.value)}
                placeholder="Yêu cầu riêng của khách…"
              />
            </Field>
            <Field label="Ghi chú nội bộ" name="internalNote">
              <textarea
                id="internalNote"
                rows={3}
                value={draft.internalNote}
                onChange={(e) => set("internalNote", e.target.value)}
                placeholder="Thông tin cho đội ngũ tại trạm…"
              />
            </Field>
          </div>
        </section>
        {apiEnabled && !existing && (
          <label className="adm-toggle-row">
            <span>
              Đã cung cấp{" "}
              <a
                href="/chinh-sach-dat-lich"
                target="_blank"
                rel="noopener noreferrer"
              >
                thông tin đặt lịch
              </a>{" "}
              và thông báo việc liên hệ xác nhận cho khách.
            </span>
            <input
              type="checkbox"
              checked={noticeAcknowledged}
              onChange={(e) => setNoticeAcknowledged(e.target.checked)}
            />
          </label>
        )}
        <div className="adm-form-footer">
          <span className="adm-muted">
            {dirty ? "Có thay đổi chưa lưu" : "* Thông tin bắt buộc"}
          </span>
          <div className="adm-action-row">
            <button type="button" className="adm-btn" onClick={cancel}>
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="adm-btn adm-primary"
            >
              <AdminIcon name="check" />
              {saving
                ? "Đang lưu…"
                : existing
                  ? "Lưu thay đổi"
                  : "Tạo lịch hẹn"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
