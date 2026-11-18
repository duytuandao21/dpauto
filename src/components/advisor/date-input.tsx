"use client";

import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { usePathname } from "next/navigation";
import { AdminIcon } from "@/components/admin/admin-icon";
import { formatDateInput, parseDateInput } from "@/lib/advisor/formats";

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type" | "min" | "max"
> & {
  value: string;
  onValueChange: (value: string) => void;
  withTime?: boolean;
  min?: string;
  max?: string;
};

export function DateInput({
  value,
  onValueChange,
  withTime = false,
  min,
  max,
  ...props
}: Props) {
  const path = usePathname();
  const [text, setText] = useState(formatDateInput(value, withTime));
  const lastValue = useRef(value);
  const picker = useRef<HTMLInputElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (value !== lastValue.current) {
      lastValue.current = value;
      setText(formatDateInput(value, withTime));
      input.current?.setCustomValidity("");
    }
  }, [value, withTime]);
  useEffect(() => {
    const next = parseDateInput(text, withTime);
    input.current?.setCustomValidity(
      text && (!next || (min && next < min) || (max && next > max))
        ? `Nhập ${withTime ? "ngày giờ" : "ngày"} hợp lệ theo dạng ${withTime ? "dd/mm/yyyy HH:mm" : "dd/mm/yyyy"}${min ? `, từ ${formatDateInput(min, withTime)}` : ""}${max ? `, đến ${formatDateInput(max, withTime)}` : ""}.`
        : "",
    );
  }, [text, withTime, min, max]);

  if (!path?.startsWith("/co-van"))
    return (
      <input
        {...props}
        type={withTime ? "datetime-local" : "date"}
        value={value}
        min={min}
        max={max}
        onChange={(event) => onValueChange(event.target.value)}
      />
    );

  const commit = (next: string) => {
    lastValue.current = next;
    onValueChange(next);
  };
  return (
    <span className="adv-date-input">
      <input
        {...props}
        ref={input}
        type="text"
        placeholder={withTime ? "dd/mm/yyyy HH:mm" : "dd/mm/yyyy"}
        maxLength={withTime ? 16 : 10}
        value={text}
        onChange={(event) => {
          const raw = event.target.value;
          const next = parseDateInput(raw, withTime);
          setText(raw);
          commit(next);
        }}
        onBlur={(event) => {
          const next = parseDateInput(text, withTime);
          if (next) setText(formatDateInput(next, withTime));
          props.onBlur?.(event);
        }}
      />
      <button
        type="button"
        className="adm-icon-btn"
        disabled={props.disabled || props.readOnly}
        aria-label={withTime ? "Chọn ngày và giờ" : "Chọn ngày"}
        onClick={() => {
          if (picker.current?.showPicker) picker.current.showPicker();
          else picker.current?.click();
        }}
      >
        <AdminIcon name="calendar" />
      </button>
      <input
        ref={picker}
        className="adv-date-picker"
        type={withTime ? "datetime-local" : "date"}
        tabIndex={-1}
        aria-hidden="true"
        disabled={props.disabled || props.readOnly}
        min={min}
        max={max}
        value={value}
        onChange={(event) => {
          setText(formatDateInput(event.target.value, withTime));
          input.current?.setCustomValidity("");
          commit(event.target.value);
        }}
      />
    </span>
  );
}
