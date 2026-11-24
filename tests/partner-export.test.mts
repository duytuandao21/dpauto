import { test } from "node:test";
import assert from "node:assert/strict";
import { monthRange, toCsv } from "../src/lib/csv.ts";

test("month range covers the whole month, leap years included", () => {
  assert.deepEqual(monthRange("2026-11"), { from: "2026-11-01", to: "2026-11-30" });
  assert.deepEqual(monthRange("2028-02"), { from: "2028-02-01", to: "2028-02-29" });
});

test("CSV starts with a BOM and quotes cells with commas or quotes", () => {
  const csv = toCsv([["Mã", "Dòng xe"], ["PDV-1", 'Ford, "Ranger"']]);
  assert.equal(csv, '﻿Mã,Dòng xe\r\nPDV-1,"Ford, ""Ranger"""');
});
