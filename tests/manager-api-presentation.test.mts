import test from "node:test";
import assert from "node:assert/strict";
import {
  managerBookingSummary,
  managerBookingNeedsAdvisor,
  managerSectionActive,
  managerVisitStage,
} from "../src/lib/api/manager-presentation.ts";
import type { ManagerBooking } from "../src/lib/manager/mock.ts";

test("unassigned drilldown uses the same open-booking rule as the KPI", () => {
  const values = [
    { status: "pending", advisorId: "" },
    { status: "confirmed", advisorId: "" },
    { status: "confirmed", advisorId: "advisor" },
    { status: "cancelled", advisorId: "" },
    { status: "arrived", advisorId: "" },
    { status: "completed", advisorId: "" },
    { status: "no_show", advisorId: "" },
  ] as ManagerBooking[];
  assert.deepEqual(values.map(managerBookingNeedsAdvisor), [true, true, false, false, false, false, false]);
});

test("manager navigation keeps details under their own section without selecting the dashboard or a similar prefix", () => {
  assert.equal(
    managerSectionActive("/dieu-hanh/phieu-dich-vu/123", "/phieu-dich-vu"),
    true,
  );
  assert.equal(
    managerSectionActive("/dieu-hanh/tai-chinh/123", "/tai-chinh"),
    true,
  );
  assert.equal(managerSectionActive("/dieu-hanh/phieu-dich-vu/123", ""), false);
  assert.equal(
    managerSectionActive("/dieu-hanh/khach-hang-khac", "/khach-hang"),
    false,
  );
  assert.equal(managerSectionActive("/dieu-hanh", ""), true);
});
test("old manager stage links retain the corresponding API filter and invalid values cannot become a stage", () => {
  assert.equal(managerVisitStage("quote"), "INSPECTED");
  assert.equal(managerVisitStage("work"), "IN_PROGRESS");
  assert.equal(managerVisitStage("done"), "HANDED_OVER");
  assert.equal(managerVisitStage("QUALITY_CHECK"), "QUALITY_CHECK");
  assert.equal(managerVisitStage("__proto__"), "");
  assert.equal(managerVisitStage(null), "");
});
test("manager KPIs count only the selected period and do not mark closed unassigned bookings as needing assignment", () => {
  const values = [
    { date: "2026-11-13", status: "pending", advisorId: "" },
    { date: "2026-11-13", status: "confirmed", advisorId: "a" },
    { date: "2026-11-13", status: "cancelled", advisorId: "" },
    { date: "2026-11-13", status: "arrived", advisorId: "a" },
    { date: "2026-11-12", status: "pending", advisorId: "" },
  ] as ManagerBooking[];
  const today = managerBookingSummary(values, "2026-11-13", "2026-11-13");
  assert.deepEqual(
    {
      total: today.total,
      pending: today.pending,
      confirmed: today.confirmed,
      unassigned: today.unassigned,
      received: today.received,
    },
    { total: 4, pending: 1, confirmed: 1, unassigned: 1, received: 1 },
  );
  assert.equal(
    managerBookingSummary(values, "2026-11-12", "2026-11-13").pending,
    2,
  );
  assert.equal(
    managerBookingSummary(values, "2026-11-14", "2026-11-14").total,
    0,
  );
  assert.equal(values.length, 5);
});
