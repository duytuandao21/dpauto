import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const { load } = require("./helpers/service-ticket-render.cjs");
const formats = load("lib/advisor/formats.ts");
const { formatPhone, formatPlate, formatDateInput, parseDateInput } = formats;

test("advisor phone uses domestic prefix for stored and entered Vietnamese numbers", () => {
  for (const [input, expected] of [
    ["+84 901 234 567", "0901234567"],
    ["84901234567", "0901234567"],
    ["0901.234.567", "0901234567"],
    ["+84 (28) 3822-1234", "02838221234"],
    ["+1234567890", "+1234567890"],
    ["+84abc", "+84abc"],
    [null, ""],
  ]) {
    assert.equal(formatPhone(input), expected);
    assert.equal(formatPhone(expected), expected);
  }
});

test("advisor plates use readable punctuation without losing older or unknown plates", () => {
  for (const [input, expected] of [
    ["61k12345", "61K-123.45"],
    [" 61K-12345 ", "61K-123.45"],
    ["59X112345", "59X1-123.45"],
    ["51LD12345", "51LD-123.45"],
    ["51A1234", "51A-1234"],
    ["XE-CHUA-CAP", "XE-CHUA-CAP"],
    [undefined, ""],
  ]) {
    assert.equal(formatPlate(input), expected);
    assert.equal(formatPlate(expected), expected);
  }
});

test("advisor date input displays day/month/year while preserving API ISO values", () => {
  assert.equal(formatDateInput("2026-11-16"), "16/11/2026");
  assert.equal(formatDateInput("2026-11-16T06:30", true), "16/11/2026 06:30");
  assert.equal(parseDateInput("1/2/2026"), "2026-02-01");
  assert.equal(parseDateInput("29/02/2028"), "2028-02-29");
  assert.equal(parseDateInput("16/11/2026 23:59", true), "2026-11-16T23:59");
  for (const value of [
    "29/02/2026",
    "31/04/2026",
    "00/11/2026",
    "16/13/2026",
    "2026-11-16",
    "16/11",
    "",
  ]) {
    assert.equal(parseDateInput(value), "");
  }
  for (const value of ["16/11/2026 24:00", "16/11/2026 12:60", "16/11/2026"]) {
    assert.equal(parseDateInput(value, true), "");
  }
});

test("advisor date field keeps labels, validation bounds and native picker; other workspaces keep native fields", () => {
  let path = "/co-van/lich-hen";
  const { DateInput } = load("components/advisor/date-input.tsx", {
    "next/navigation": { usePathname: () => path },
    "@/components/admin/admin-icon": { AdminIcon: () => null },
    "@/lib/advisor/formats": formats,
  });
  const props = {
    id: "date",
    required: true,
    value: "2026-11-16",
    min: "2026-11-01",
    max: "2026-11-30",
    onValueChange() {},
  };
  const html = renderToStaticMarkup(React.createElement(DateInput, props));
  assert.match(html, /id="date"[^>]*type="text"[^>]*value="16\/11\/2026"/);
  assert.match(html, /aria-label="Chọn ngày"/);
  assert.match(html, /type="date"[^>]*min="2026-11-01"[^>]*max="2026-11-30"/);
  path = "/quan-ly/lich-hen";
  const other = renderToStaticMarkup(React.createElement(DateInput, props));
  assert.match(other, /type="date"/);
  assert.doesNotMatch(other, /adv-date-input/);
});
