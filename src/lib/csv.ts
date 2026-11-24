/** "2026-11" → first and last day of that month. */
export function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

const cell = (v: string | number) => {
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV text; the BOM makes Excel read Vietnamese correctly. */
export const toCsv = (rows: (string | number)[][]) =>
  "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
