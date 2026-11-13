"use client";
import { useState } from "react";
import { newRequestKey } from "@/lib/api/client";
import type { Intake } from "@/lib/api/visits";
import { operationChecks } from "@/lib/advisor/seed";

export async function prepareIntakePhoto(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Vui lòng chọn ảnh.");
  if (file.size > 20 * 1024 * 1024) throw new Error("Ảnh gốc tối đa 20 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas"),
      scale = Math.min(1, 1200 / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Không thể xử lý ảnh.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let dataUrl = canvas.toDataURL("image/jpeg", 0.72);
    if (dataUrl.length > 273000) dataUrl = canvas.toDataURL("image/jpeg", 0.45);
    if (dataUrl.length > 273000)
      throw new Error("Ảnh còn quá lớn. Vui lòng chọn ảnh nhỏ hơn.");
    return {
      name: file.name.slice(0, 100).replace(/\.[^.]+$/, "") + ".jpg",
      dataUrl,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}
export function VisitIntakeFields({
  value,
  onChange,
  disabled = false,
  existingPhotos = 0,
  onProcessing,
  numbered = false,
}: {
  value: Intake;
  onChange: (v: Intake) => void;
  disabled?: boolean;
  existingPhotos?: number;
  onProcessing?: (busy: boolean) => void;
  numbered?: boolean;
}) {
  const [error, setError] = useState(""),
    [processing, setProcessing] = useState(false);
  const [photoInputId] = useState(newRequestKey);
  async function addPhotos(files: FileList | null) {
    if (processing) return;
    const selected = Array.from(files || []);
    if (selected.length + existingPhotos + value.photos.length > 6) {
      setError("Mỗi phiếu tối đa 6 ảnh.");
      return;
    }
    setProcessing(true);
    onProcessing?.(true);
    setError("");
    try {
      const added = [];
      for (const f of selected) added.push(await prepareIntakePhoto(f));
      onChange({ ...value, photos: [...value.photos, ...added] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không đọc được ảnh.");
    } finally {
      setProcessing(false);
      onProcessing?.(false);
    }
  }
  return (
    <fieldset
      disabled={disabled || processing}
      className="adv-stack adv-checks"
      aria-label="Thông tin tiếp nhận"
    >
      <section className="adm-panel">
        {numbered ? (
          <div className="adm-form-section-title">
            <span>2</span>
            <div>
              <h2>Kiểm tra khi nhận xe</h2>
              <p>Ghi lại số km và tình trạng ban đầu.</p>
            </div>
          </div>
        ) : (
          <h2>Kiểm tra khi nhận xe</h2>
        )}
        <div className="adm-form-grid">
          <label className="adm-field">
            ODO hiện tại (km)
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={9999999}
              step={1}
              value={value.odometer ?? ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  odometer:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </label>
          {value.odometer === null && (
            <label className="adm-field">
              Lý do chưa ghi ODO *
              <input
                required
                maxLength={400}
                value={value.odometerMissingReason || ""}
                onChange={(e) =>
                  onChange({ ...value, odometerMissingReason: e.target.value })
                }
              />
            </label>
          )}
          {(
            [
              ["exterior", "Ngoại thất"],
              ["interior", "Nội thất"],
              ["engine", "Động cơ"],
              ["dashboard", "Đèn taplo"],
              ["tires", "Lốp xe"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="adm-field">
              {label}
              <input
                maxLength={1000}
                value={value.conditions[key]}
                onChange={(e) =>
                  onChange({
                    ...value,
                    conditions: { ...value.conditions, [key]: e.target.value },
                  })
                }
              />
            </label>
          ))}
        </div>
        <fieldset className="adv-checks">
          <legend>Kiểm tra vận hành</legend>
          <div className="adv-check-grid">
            {operationChecks.map((label) => (
              <label key={label}>
                <input
                  type="checkbox"
                  checked={value.conditions.operation.includes(label)}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      conditions: {
                        ...value.conditions,
                        operation: e.target.checked
                          ? [...value.conditions.operation, label]
                          : value.conditions.operation.filter(
                              (s) => s !== label,
                            ),
                      },
                    })
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      </section>
      <section className="adm-panel">
        {numbered ? (
          <div className="adm-form-section-title">
            <span>3</span>
            <div>
              <h2>Yêu cầu dịch vụ và ảnh</h2>
              <p>Ghi nhận yêu cầu và hình ảnh khi tiếp nhận.</p>
            </div>
          </div>
        ) : (
          <h2>Yêu cầu dịch vụ và ảnh</h2>
        )}
        <label className="adm-field">
          Yêu cầu của khách *
          <textarea
            required
            maxLength={2000}
            rows={3}
            value={value.request}
            onChange={(e) => onChange({ ...value, request: e.target.value })}
          />
        </label>
        <label className="adm-field">
          Ghi chú tiếp nhận
          <textarea
            rows={3}
            maxLength={1000}
            value={value.receptionNote}
            onChange={(e) =>
              onChange({ ...value, receptionNote: e.target.value })
            }
          />
        </label>
        <div className="adv-photo-inputs">
          <label className="adm-field adv-photo-input" htmlFor={photoInputId}>
            Chọn ảnh từ thiết bị
            <input
              id={photoInputId}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                void addPhotos(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          <label className="adm-field adv-photo-input">
            Chụp ảnh xe
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                void addPhotos(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <div className="adv-photo-grid">
          {value.photos.map((p, i) => (
            <figure key={i}>
              <img src={p.dataUrl} alt={p.name} />
              <button
                type="button"
                className="adm-btn adm-btn-sm"
                onClick={() =>
                  onChange({
                    ...value,
                    photos: value.photos.filter((_, n) => n !== i),
                  })
                }
              >
                Xóa ảnh
              </button>
            </figure>
          ))}
        </div>
        {processing && <p role="status">Đang xử lý ảnh…</p>}
        {error && (
          <p role="alert" className="adm-error-text">
            {error}
          </p>
        )}
      </section>
    </fieldset>
  );
}
