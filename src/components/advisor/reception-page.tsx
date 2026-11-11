"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useBookings } from "@/components/admin/booking-provider";
import { AdminIcon } from "@/components/admin/admin-icon";
import {
  AdminLoading,
  NotFoundState,
  PageHeading,
} from "@/components/admin/primitives";
import { bookingTime, formatDate, timeLabel } from "@/lib/booking/logic";
import { operationChecks } from "@/lib/advisor/seed";
import type { ReceptionDraft } from "@/lib/advisor/types";
import { useAdvisor } from "./advisor-provider";

const blank: ReceptionDraft = {
  odo: "",
  request: "",
  exterior: "",
  interior: "",
  engine: "",
  dashboard: "",
  tires: "",
  operation: [],
  receptionNote: "",
  photos: [],
};

async function preparePhoto(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 1200 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Không thể xử lý ảnh này.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return {
      id: crypto.randomUUID(),
      dataUrl: canvas.toDataURL("image/jpeg", 0.72),
      name: file.name,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function ReceptionPage({ id }: { id: string }) {
  const router = useRouter();
  const { data, ready: bookingsReady } = useBookings();
  const { orders, ready, receive } = useAdvisor();
  const booking = data.bookings.find((item) => item.id === id);
  const customer = data.customers.find(
    (item) => item.id === booking?.customerId,
  );
  const vehicle = data.vehicles.find((item) => item.id === booking?.vehicleId);
  const existing = orders.find((item) => item.bookingId === id);
  const [draft, setDraft] = useState<ReceptionDraft>(blank);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const draftKey = useMemo(() => `dpauto.reception-draft.${id}`, [id]);

  useEffect(() => {
    if (!booking) return;
    let next = { ...blank, request: booking.customerNote || "" };
    try {
      const saved = sessionStorage.getItem(draftKey);
      if (saved) {
        const stored = JSON.parse(saved) as Partial<ReceptionDraft>;
        next = {
          ...next,
          ...stored,
          photos: Array.isArray(stored.photos) ? stored.photos : [],
        };
      }
    } catch {}
    setDraft(next);
  }, [booking, draftKey]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    const warnLink = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest("a[href]");
      if (link && !window.confirm("Rời form khi thay đổi chưa được lưu?"))
        event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", warnLink, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", warnLink, true);
    };
  }, [dirty]);

  function change<K extends keyof ReceptionDraft>(
    key: K,
    value: ReceptionDraft[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setError("");
  }
  async function addPhotos(files: FileList | null) {
    const selected = Array.from(files || []).filter((file) =>
      file.type.startsWith("image/"),
    );
    try {
      const next = await Promise.all(
        selected
          .slice(0, Math.max(0, 6 - draft.photos.length))
          .map(preparePhoto),
      );
      if (JSON.stringify([...draft.photos, ...next]).length > 2_000_000)
        throw new Error("Vui lòng chọn ít ảnh hơn.");
      change("photos", [...draft.photos, ...next]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể đọc ảnh.");
    }
  }
  function saveDraft() {
    try {
      sessionStorage.setItem(draftKey, JSON.stringify(draft));
      setDirty(false);
      setError("Đã lưu bản nháp.");
    } catch {
      setError("Không lưu được bản nháp trên thiết bị này.");
    }
  }
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (
      !draft.request.trim() ||
      !/^\d+$/.test(draft.odo) ||
      Number(draft.odo) < 0
    ) {
      setError("Nhập số ODO hợp lệ và yêu cầu dịch vụ trước khi tiếp nhận.");
      return;
    }
    if (
      !window.confirm(
        `Tiếp nhận xe ${vehicle?.plate || "này"} và tạo phiếu dịch vụ?`,
      )
    )
      return;
    try {
      const order = receive(id, {
        ...draft,
        request: draft.request.trim(),
        odo: draft.odo.trim(),
      });
      sessionStorage.removeItem(draftKey);
      setDirty(false);
      router.push(`/co-van/phieu-dich-vu/${order.id}`);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không tiếp nhận được xe.",
      );
    }
  }
  if (!bookingsReady || !ready) return <AdminLoading />;
  if (!booking || !customer || !vehicle) return <NotFoundState />;
  if (existing)
    return (
      <section className="adm-form-page">
        <PageHeading
          eyebrow="CỐ VẤN / TIẾP NHẬN XE"
          title="Xe đã tiếp nhận"
          description="Lịch hẹn này đã có phiếu dịch vụ."
        />
        <Link
          className="adm-btn adm-primary"
          href={`/co-van/phieu-dich-vu/${existing.id}`}
        >
          Mở phiếu {existing.id}
        </Link>
      </section>
    );
  if (!["confirmed", "arrived"].includes(booking.status))
    return (
      <section className="adm-form-page">
        <PageHeading
          eyebrow="CỐ VẤN / TIẾP NHẬN XE"
          title="Chưa thể tiếp nhận"
          description="Xác nhận lịch hẹn trước khi tiếp nhận xe."
        />
        <Link className="adm-btn" href={`/co-van/lich-hen/${id}`}>
          Xem lịch hẹn
        </Link>
      </section>
    );
  return (
    <div className="adm-form-page adv-page">
      <PageHeading
        eyebrow="CỐ VẤN / TIẾP NHẬN XE"
        title="Tiếp nhận xe"
        description={`${id} · ${formatDate(bookingTime(booking))} ${timeLabel(bookingTime(booking))}`}
      />
      <form className="adm-booking-form" onSubmit={submit} noValidate>
        <section className="adm-panel">
          <div className="adm-form-section-title">
            <span>1</span>
            <div>
              <h2>Khách hàng và xe</h2>
              <p>Thông tin lấy từ lịch đã xác nhận.</p>
            </div>
          </div>
          <dl className="adm-info-grid">
            <div>
              <dt>Khách hàng</dt>
              <dd>{customer.name}</dd>
            </div>
            <div>
              <dt>Số điện thoại</dt>
              <dd>
                <a href={`tel:${customer.phone}`}>{customer.phone}</a>
              </dd>
            </div>
            <div>
              <dt>Xe</dt>
              <dd>
                {vehicle.model} {vehicle.year}
              </dd>
            </div>
            <div>
              <dt>Biển số</dt>
              <dd>{vehicle.plate || "Chưa có"}</dd>
            </div>
          </dl>
        </section>
        <section className="adm-panel">
          <div className="adm-form-section-title">
            <span>2</span>
            <div>
              <h2>Kiểm tra khi nhận xe</h2>
              <p>Ghi lại số km và tình trạng ban đầu.</p>
            </div>
          </div>
          <div className="adm-form-grid">
            <label className="adm-field">
              ODO hiện tại (km) *
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                value={draft.odo}
                onChange={(event) => change("odo", event.target.value)}
                placeholder="Ví dụ: 38250"
              />
            </label>
            <label className="adm-field">
              Ngoại thất
              <input
                value={draft.exterior}
                onChange={(event) => change("exterior", event.target.value)}
                placeholder="Vết trầy, móp…"
              />
            </label>
            <label className="adm-field">
              Nội thất
              <input
                value={draft.interior}
                onChange={(event) => change("interior", event.target.value)}
              />
            </label>
            <label className="adm-field">
              Động cơ
              <input
                value={draft.engine}
                onChange={(event) => change("engine", event.target.value)}
              />
            </label>
            <label className="adm-field">
              Đèn taplo
              <input
                value={draft.dashboard}
                onChange={(event) => change("dashboard", event.target.value)}
              />
            </label>
            <label className="adm-field">
              Lốp xe
              <input
                value={draft.tires}
                onChange={(event) => change("tires", event.target.value)}
              />
            </label>
          </div>
          <fieldset className="adv-checks">
            <legend>Kiểm tra vận hành</legend>
            <div className="adv-check-grid">
              {operationChecks.map((label) => (
                <label key={label}>
                  <input
                    type="checkbox"
                    checked={draft.operation.includes(label)}
                    onChange={(event) =>
                      change(
                        "operation",
                        event.target.checked
                          ? [...draft.operation, label]
                          : draft.operation.filter((item) => item !== label),
                      )
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        </section>
        <section className="adm-panel">
          <div className="adm-form-section-title">
            <span>3</span>
            <div>
              <h2>Yêu cầu dịch vụ và ảnh</h2>
            </div>
          </div>
          <div className="adm-form-grid">
            <label className="adm-field adm-span-full">
              Yêu cầu của khách *
              <textarea
                rows={3}
                value={draft.request}
                onChange={(event) => change("request", event.target.value)}
              />
            </label>
            <label className="adm-field adm-span-full">
              Ghi chú tiếp nhận
              <textarea
                rows={3}
                value={draft.receptionNote}
                onChange={(event) =>
                  change("receptionNote", event.target.value)
                }
              />
            </label>
          </div>
          <div className="adv-photo-inputs">
            <label className="adm-field adv-photo-input">
              Chụp ảnh xe
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(event) => {
                  void addPhotos(event.target.files);
                  event.target.value = "";
                }}
              />
            </label>
            <label className="adm-field adv-photo-input">
              Chọn ảnh từ thiết bị
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => {
                  void addPhotos(event.target.files);
                  event.target.value = "";
                }}
              />
            </label>
          </div>
          {draft.photos.length > 0 && (
            <div className="adv-photo-grid">
              {draft.photos.map((photo) => (
                <figure key={photo.id}>
                  <img src={photo.dataUrl} alt={photo.name} />
                  <button
                    type="button"
                    className="adm-btn adm-btn-sm"
                    onClick={() =>
                      change(
                        "photos",
                        draft.photos.filter((item) => item.id !== photo.id),
                      )
                    }
                  >
                    Xóa ảnh
                  </button>
                </figure>
              ))}
            </div>
          )}
        </section>
        {error && (
          <p
            className={
              error.startsWith("Bản nháp") ? "adm-muted" : "adm-error-text"
            }
            role="status"
          >
            {error}
          </p>
        )}
        <div className="adm-form-footer">
          <Link className="adm-btn" href={`/co-van/lich-hen/${id}`}>
            Quay lại lịch
          </Link>
          <div className="adm-action-row">
            <button type="button" className="adm-btn" onClick={saveDraft}>
              Lưu bản nháp
            </button>
            <button type="submit" className="adm-btn adm-primary">
              <AdminIcon name="check" />
              Hoàn tất tiếp nhận
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
