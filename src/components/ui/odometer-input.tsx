"use client";

import { useEffect, useRef, type InputHTMLAttributes } from "react";
import { formatOdometer } from "@/lib/advisor/formats";

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  | "value"
  | "defaultValue"
  | "onChange"
  | "type"
  | "inputMode"
  | "min"
  | "max"
  | "step"
  | "pattern"
> & {
  value: number | string | null;
  onValueChange: (digits: string) => void;
  max?: number;
};

export function OdometerInput({
  value,
  onValueChange,
  max,
  onKeyDown,
  ...props
}: Props) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.setCustomValidity(
      max !== undefined &&
        value !== null &&
        value !== "" &&
        Number(String(value).replaceAll(".", "")) > max
        ? `ODO tối đa ${formatOdometer(max)} km.`
        : "",
    );
  }, [value, max]);
  return (
    <input
      {...props}
      ref={input}
      data-odometer=""
      type="text"
      inputMode="numeric"
      pattern="[0-9]{1,3}(\.[0-9]{3})*"
      value={formatOdometer(value)}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        const field = event.currentTarget;
        const caret = field.selectionStart;
        if (
          event.defaultPrevented ||
          caret === null ||
          caret !== field.selectionEnd
        )
          return;
        // Skip a grouping dot so Backspace/Delete still removes a digit in one press.
        if (event.key === "Backspace" && field.value[caret - 1] === ".")
          field.setSelectionRange(caret - 1, caret - 1);
        if (event.key === "Delete" && field.value[caret] === ".")
          field.setSelectionRange(caret + 1, caret + 1);
      }}
      onChange={(event) => {
        const field = event.currentTarget;
        const raw = field.value;
        if (!/^[0-9.\s]*$/.test(raw)) {
          field.value = formatOdometer(value);
          return;
        }
        const before = raw
          .slice(0, field.selectionStart ?? raw.length)
          .replace(/\D/g, "").length;
        const digits = raw.replace(/[.\s]/g, "").replace(/^0+(?=\d)/, "");
        const formatted = formatOdometer(digits);
        let caret = 0,
          count = 0;
        while (caret < formatted.length && count < before) {
          if (/\d/.test(formatted[caret])) count++;
          caret++;
        }
        field.value = formatted;
        onValueChange(digits);
        field.setSelectionRange(caret, caret);
      }}
    />
  );
}
