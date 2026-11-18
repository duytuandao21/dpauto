import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BookingTimeForm } from "../src/components/admin/booking-time-form.tsx";
import { VisitIntakeFields } from "../src/components/advisor/visit-intake-fields.tsx";
import { bookingFromApi } from "../src/lib/api/booking-adapter.ts";
import { emptyIntake } from "../src/lib/api/visits.ts";

test("phase6 UI: shared confirmation starts with empty agreed time and preserves original period after confirmation", () => {
  const booking = bookingFromApi({
    id: "booking",
    code: "DP-DV13112026-001",
    customerId: "customer",
    status: "PENDING",
    source: "WEBSITE",
    customer: { name: "Nguyễn Văn An", phone: "0772584279" },
    vehicle: { id: "vehicle", model: "Toyota Vios", plate: "51G-123.45" },
    services: [{ id: "service", name: "Vệ sinh xe" }],
    requestedStartAt: "2026-11-20T00:30:00Z",
    requestedPeriod: "AFTERNOON",
    originalRequestedPeriod: "MORNING",
    scheduledStartAt: "2026-11-21T05:30:00Z",
    confirmedStartAt: null,
    assignedAdvisor: null,
    version: 2,
    changeKind: "RESCHEDULED",
  });
  const html = renderToStaticMarkup(
    createElement(BookingTimeForm, {
      booking,
      confirm: true,
      advisors: [],
      pickAdvisor: true,
      onSave: async () => {},
      onCancel: () => {},
    }),
  );
  assert.match(html, /type="time" value=""/);
  assert.match(html, /20\/11\/2026/);
  assert.match(html, /Buổi sáng/);
  assert.match(html, /Cố vấn phụ trách/);
  assert.doesNotMatch(html, /type="checkbox"/);
  assert.match(html, /Xác nhận lịch hẹn/);
  const confirmed = bookingFromApi({
    id: "b",
    code: "DP-DV13112026-002",
    status: "CONFIRMED",
    source: "WEBSITE",
    customer: { name: "An", phone: "0772584279" },
    vehicle: null,
    services: [],
    requestedStartAt: "2026-11-20T00:30:00Z",
    requestedPeriod: "AFTERNOON",
    originalRequestedPeriod: "MORNING",
    scheduledStartAt: "2026-11-21T07:15:00Z",
    confirmedStartAt: "2026-11-21T07:15:00Z",
    assignedAdvisor: null,
    version: 3,
    changeKind: "RESCHEDULED",
  });
  assert.equal(confirmed.period, undefined);
  assert.equal(confirmed.originalPeriod, "morning");
});

test("phase6 UI: intake keeps request and optional ODO visible without reason fields, optional checks collapse", () => {
  const html = renderToStaticMarkup(
    createElement(VisitIntakeFields, {
      value: emptyIntake,
      onChange: () => {},
      collapsible: true,
      numbered: true,
    }),
  );
  assert.doesNotMatch(html, /Lý do/);
  assert.match(html, /ODO hiện tại/);
  assert.match(html, /Yêu cầu của khách/);
  const details = html.slice(
    html.indexOf("<details"),
    html.indexOf("</details>") + 10,
  );
  assert.match(details, /Kiểm tra và hình ảnh/);
  assert.doesNotMatch(details, /<details[^>]*\bopen(?:=|\s|>)/);
  assert.doesNotMatch(details, /\brequired(?:=|\s|>)/);
  assert.match(details, /type="file"/);
});
