import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import {
  bookingServices,
  displayDate,
  type CustomerFields,
  type CustomerErrors,
} from "@/lib/public-booking/mock";

export function StepIntro({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="pb-step-intro">
      <h3 tabIndex={-1} data-step-heading>
        {title}
      </h3>
      {children && <p>{children}</p>}
    </div>
  );
}

export function CustomerStep({
  customer,
  errors,
  onChange,
  onBlur,
}: {
  customer: CustomerFields;
  errors: CustomerErrors;
  onChange: (field: keyof CustomerFields, value: string) => void;
  onBlur: (field: keyof CustomerFields) => void;
}) {
  const fields: {
    key: keyof CustomerFields;
    label: string;
    placeholder: string;
    required?: boolean;
    autoComplete?: string;
    maxLength: number;
  }[] = [
    {
      key: "name",
      label: "Họ và tên",
      placeholder: "Nhập họ tên của bạn",
      required: true,
      autoComplete: "name",
      maxLength: 100,
    },
    {
      key: "phone",
      label: "Số điện thoại",
      placeholder: "Ví dụ: 0901 234 567",
      required: true,
      autoComplete: "tel",
      maxLength: 24,
    },
    {
      key: "plate",
      label: "Biển số xe",
      placeholder: "Ví dụ: 51K-123.45",
      maxLength: 20,
    },
    {
      key: "vehicle",
      label: "Hãng / Dòng xe",
      placeholder: "Ví dụ: Toyota Vios",
      maxLength: 100,
    },
  ];
  return (
    <>
      <StepIntro title="Thông tin của bạn" />
      <div className="pb-fields">
        {fields.map(
          ({ key, label, placeholder, required, autoComplete, maxLength }) => (
            <div className="pb-field" key={key}>
              <label htmlFor={`pb-${key}`}>
                {label}{" "}
                {required ? (
                  <span className="pb-required" aria-hidden="true">
                    *
                  </span>
                ) : (
                  <span className="pb-optional">(không bắt buộc)</span>
                )}
              </label>
              <input
                id={`pb-${key}`}
                name={key}
                value={customer[key]}
                type={key === "phone" ? "tel" : "text"}
                inputMode={key === "phone" ? "tel" : undefined}
                autoComplete={autoComplete ?? "off"}
                maxLength={maxLength}
                placeholder={placeholder}
                required={required}
                aria-invalid={!!errors[key]}
                aria-describedby={errors[key] ? `pb-${key}-error` : undefined}
                onChange={(event) => onChange(key, event.target.value)}
                onBlur={() => onBlur(key)}
              />
              {errors[key] && (
                <p className="pb-error" id={`pb-${key}-error`} role="alert">
                  {errors[key]}
                </p>
              )}
            </div>
          ),
        )}
      </div>
    </>
  );
}

export function ServicesStep({
  selected,
  error,
  onChange,
}: {
  selected: string[];
  error: string;
  onChange: (ids: string[]) => void;
}) {
  return (
    <>
      <StepIntro title="Xe của bạn cần dịch vụ gì?">
        Chọn một hoặc nhiều dịch vụ.
      </StepIntro>
      <fieldset
        className="pb-service-fieldset"
        aria-describedby={error ? "pb-services-error" : undefined}
      >
        <legend className="pb-sr-only">
          Dịch vụ cần đặt (bắt buộc chọn ít nhất một)
        </legend>
        <div className="pb-services">
          {bookingServices.map((service) => {
            const checked = selected.includes(service.id);
            return (
              <label
                key={service.id}
                className={`pb-service ${checked ? "is-selected" : ""} ${service.disabled ? "is-disabled" : ""}`}
              >
                <input
                  type="checkbox"
                  name="services"
                  value={service.id}
                  checked={checked}
                  disabled={service.disabled}
                  onChange={() =>
                    onChange(
                      checked
                        ? selected.filter((id) => id !== service.id)
                        : [...selected, service.id],
                    )
                  }
                />
                <span className="pb-service-icon">
                  <Icon name={service.icon} />
                </span>
                <span className="pb-service-copy">
                  <strong>{service.name}</strong>
                  <small>{service.durationLabel}</small>
                </span>
                <span className="pb-checkbox" aria-hidden="true">
                  {checked && <Icon name="check" />}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      {error && (
        <p className="pb-error" id="pb-services-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

export function BookingSummary({
  customer,
  serviceIds,
  date,
  time,
  note,
  onEdit,
  success = false,
}: {
  customer: CustomerFields;
  serviceIds: string[];
  date: string;
  time: string;
  note: string;
  onEdit?: (step: number) => void;
  success?: boolean;
}) {
  const services = bookingServices.filter((service) =>
    serviceIds.includes(service.id),
  );
  return (
    <section className="pb-summary" aria-label="Tóm tắt yêu cầu đặt lịch">
      <div className="pb-summary-heading">
        <h4>{success ? "Thông tin yêu cầu mẫu" : "Thông tin đặt lịch"}</h4>
        {onEdit && (
          <button
            type="button"
            className="pb-text-button"
            onClick={() => onEdit(1)}
          >
            Chỉnh sửa
          </button>
        )}
      </div>
      <dl>
        <div>
          <dt>Khách hàng</dt>
          <dd>
            <strong>{customer.name.trim()}</strong>
            <span>{customer.phone}</span>
          </dd>
        </div>
        {(customer.vehicle.trim() || customer.plate.trim()) && (
          <div>
            <dt>Phương tiện</dt>
            <dd>
              {[customer.vehicle.trim(), customer.plate.trim()]
                .filter(Boolean)
                .join(" · ")}
            </dd>
          </div>
        )}
        <div>
          <dt>Dịch vụ</dt>
          <dd>
            <ul>
              {services.map((service) => (
                <li key={service.id}>{service.name}</li>
              ))}
            </ul>
            {onEdit && (
              <button
                type="button"
                className="pb-text-button"
                onClick={() => onEdit(2)}
              >
                Đổi dịch vụ
              </button>
            )}
          </dd>
        </div>
        <div className="pb-summary-time">
          <dt>Thời gian</dt>
          <dd>
            {time ? (
              <strong>
                {time} · {displayDate(date)}
              </strong>
            ) : (
              <span>Chưa chọn khung giờ</span>
            )}
          </dd>
        </div>
        {note.trim() && (
          <div>
            <dt>Ghi chú</dt>
            <dd className="pb-note-preview">{note.trim()}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}
