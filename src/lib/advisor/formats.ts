export function formatPhone(value: string | null | undefined) {
  const phone = (value || "").trim().replace(/[\s().-]/g, "");
  return phone.replace(/^\+?84([1-9]\d{8,9})$/, "0$1");
}

export function formatOdometer(value: number | string | null | undefined) {
  const text = String(value ?? "");
  const digits = text.replaceAll(".", "");
  return /^\d+$/.test(digits)
    ? digits.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".")
    : text;
}

export function formatPlate(value: string | null | undefined) {
  const plate = (value || "").trim().toUpperCase();
  const compact = plate.replace(/[\s.-]/g, "");
  const current = /^(\d{2}[A-Z]{1,2}\d?)(\d{3})(\d{2})$/.exec(compact);
  if (current) return `${current[1]}-${current[2]}.${current[3]}`;
  const old = /^(\d{2}[A-Z]{1,2})(\d{4})$/.exec(compact);
  return old ? `${old[1]}-${old[2]}` : plate;
}

/** Formats a plate while it is typed: "51M7963" → "51M-796.3", "51M79631" → "51M-796.31". */
export function typePlate(value: string) {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
  const full = formatPlate(compact);
  if (full !== compact) return full;
  const m = /^(\d{2}[A-Z]{1,2})(\d+)$/.exec(compact);
  if (!m) return compact;
  const d = m[2];
  return `${m[1]}-${d.length > 3 ? `${d.slice(0, 3)}.${d.slice(3)}` : d}`;
}

export function formatDateInput(value: string, withTime = false) {
  if (!value) return "";
  const date = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(value);
  return date
    ? `${date[3]}/${date[2]}/${date[1]}${withTime && date[4] ? ` ${date[4]}:${date[5]}` : ""}`
    : value;
}

export function parseDateInput(value: string, withTime = false) {
  const parts = (
    withTime
      ? /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{2}):(\d{2})$/
      : /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
  ).exec(value.trim());
  if (!parts) return "";
  const [, day, month, year, hour, minute] = parts;
  const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  const date = new Date(`${iso}T12:00:00+07:00`);
  if (Number.isNaN(+date) || date.toISOString().slice(0, 10) !== iso) return "";
  if (withTime && (Number(hour) > 23 || Number(minute) > 59)) return "";
  return iso + (withTime ? `T${hour}:${minute}` : "");
}
