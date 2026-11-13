import test from "node:test";
import assert from "node:assert/strict";
import {
  quoteDraftBody,
  stationInstant,
  vnd,
} from "../src/lib/api/workflow.ts";

test("quote input excludes server totals, keeps decimal strings and exact VND", () => {
  const line = {
    id: "server-line",
    kind: "SERVICE" as const,
    serviceId: "service",
    name: "Vệ sinh",
    code: "VS",
    unit: "gói",
    quantity: "1",
    unitPrice: "900719925474099",
    discountPercent: "5.25",
    vatPercent: "8",
    total: "untrusted",
  };
  const body = quoteDraftBody({
    discountPercent: "2.50",
    note: "",
    lines: [line, { ...line, kind: "PART" }],
  });
  assert.equal(body.calculationPolicy, "VND_LINE_HALF_UP_V1");
  assert.equal(body.lines[0].unitPrice, "900719925474099");
  assert.equal(body.lines[0].discountPercent, "5.25");
  assert.equal(body.lines[1].serviceId, undefined);
  assert.ok(!("id" in body.lines[0]) && !("total" in body.lines[0]));
  assert.equal(vnd("900719925474099999"), "900.719.925.474.099.999 ₫");
  assert.equal(stationInstant("2026-11-12T15:30"), "2026-11-12T15:30:00+07:00");
});
