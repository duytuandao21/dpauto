import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

// Load the actual TypeScript domain modules without starting Next.js.
const urls = new Map();
function moduleUrl(file) {
  if (urls.has(file)) return urls.get(file);
  let source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  source = source.replace(/from\s+["']([^"']+)["']/g, (_, specifier) => {
    const resolved = specifier.startsWith("@/")
      ? path.resolve("src", specifier.slice(2))
      : path.resolve(path.dirname(file), specifier);
    return `from ${JSON.stringify(moduleUrl(resolved + ".ts"))}`;
  });
  const url =
    "data:text/javascript;base64," + Buffer.from(source).toString("base64");
  urls.set(file, url);
  return url;
}
const { validateBookingChange, applyBookingChange } = await import(
  moduleUrl(path.resolve("src/lib/manager/rules.ts"))
);
const { createManagerData } = await import(
  moduleUrl(path.resolve("src/lib/manager/mock.ts"))
);
const { operationAlerts, orderAmounts, paymentLabel } = await import(
  moduleUrl(path.resolve("src/lib/manager/operations.ts"))
);
const today = "2026-11-11";
const shift = (date, days) => {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
function fixture() {
  const data = createManagerData(today, shift);
  const booking = data.bookings.find(
    (b) => b.status === "pending" && b.date === today,
  );
  return { data, booking };
}
test("pending reservations are counted and confirming does not reserve twice", () => {
  const { data, booking } = fixture();
  assert.ok(booking.holds.length);
  const next = applyBookingChange(
    data,
    booking,
    "confirm",
    booking.date,
    booking.time,
  );
  assert.deepEqual(next.capacity, data.capacity);
  assert.equal(
    next.bookings.find((b) => b.id === booking.id).status,
    "confirmed",
  );
});
test("rescheduling needs consent and terminal / arrived appointments cannot be cancelled", () => {
  const { data, booking } = fixture();
  assert.ok(
    validateBookingChange(
      data,
      booking,
      "reschedule",
      shift(today, 1),
      "13:30",
      "Khách đổi giờ",
      false,
    ),
  );
  assert.ok(
    validateBookingChange(
      data,
      { ...booking, status: "arrived" },
      "cancel",
      today,
      "13:30",
      "Lý do",
      true,
    ),
  );
  assert.ok(
    validateBookingChange(
      data,
      { ...booking, status: "completed" },
      "cancel",
      today,
      "13:30",
      "Lý do",
      true,
    ),
  );
});
test("invalid calendar days, holidays and outside business hours are rejected", () => {
  const { data, booking } = fixture();
  for (const [date, time] of [
    ["2026-02-31", "09:00"],
    [today, "25:00"],
    [today, "18:00"],
  ])
    assert.ok(
      validateBookingChange(
        data,
        booking,
        "reschedule",
        date,
        time,
        "Khách đổi",
        true,
      ),
    );
  data.holidays.push({ date: shift(today, 1), reason: "Nghỉ" });
  assert.ok(
    validateBookingChange(
      data,
      booking,
      "reschedule",
      shift(today, 1),
      "13:30",
      "Khách đổi",
      true,
    ),
  );
});
test("locked or insufficient capacity rejects a move while preserving the source", () => {
  const { data, booking } = fixture(),
    tomorrow = shift(today, 1);
  const slot = data.capacity.find(
    (s) =>
      s.date === tomorrow &&
      s.group === "Chăm sóc xe" &&
      s.time.startsWith("13:00"),
  );
  slot.locked = true;
  assert.ok(
    validateBookingChange(
      data,
      booking,
      "reschedule",
      tomorrow,
      "13:30",
      "Khách đổi",
      true,
    ),
  );
  slot.locked = false;
  slot.total = 20;
  assert.ok(
    validateBookingChange(
      data,
      booking,
      "reschedule",
      tomorrow,
      "13:30",
      "Khách đổi",
      true,
    ),
  );
  assert.equal(booking.date, today);
});
test("moving a reservation releases the old slot and holds the new slot atomically in local state", () => {
  const { data, booking } = fixture(),
    tomorrow = shift(today, 1);
  data.capacity.find(
    (s) =>
      s.date === tomorrow &&
      s.group === "Chăm sóc xe" &&
      s.time.startsWith("13:00"),
  ).total = 1440;
  assert.equal(
    validateBookingChange(
      data,
      booking,
      "reschedule",
      tomorrow,
      "13:30",
      "Khách đổi",
      true,
    ),
    "",
  );
  const oldTotal = data.capacity.reduce((n, s) => n + s.reserved, 0);
  const next = applyBookingChange(
    data,
    booking,
    "reschedule",
    tomorrow,
    "13:30",
  );
  const moved = next.bookings.find((b) => b.id === booking.id);
  assert.equal(moved.date, tomorrow);
  assert.equal(moved.changeKind, "rescheduled");
  assert.equal(
    next.capacity.reduce((n, s) => n + s.reserved, 0),
    oldTotal,
  );
  assert.equal(data.bookings.find((b) => b.id === booking.id).date, today);
  assert.ok(
    moved.holds.every(
      (h) => next.capacity.find((s) => s.id === h.slotId).date === tomorrow,
    ),
  );
});
test("cancel releases only the appointment's own held resource", () => {
  const { data, booking } = fixture();
  const next = applyBookingChange(data, booking, "cancel", today, booking.time);
  assert.equal(
    next.capacity.reduce((n, s) => n + s.reserved, 0),
    data.capacity.reduce((n, s) => n + s.reserved, 0) -
      booking.holds.reduce((n, h) => n + h.minutes, 0),
  );
  assert.equal(next.bookings.find((b) => b.id === booking.id).holds.length, 0);
});
test("reducing capacity does not remove reservations or cancel appointments", () => {
  const { data, booking } = fixture();
  const slot = data.capacity.find((s) => s.id === booking.holds[0].slotId);
  slot.total = 0;
  assert.ok(slot.reserved > 0);
  assert.equal(booking.status, "pending");
  const next = applyBookingChange(
    data,
    booking,
    "confirm",
    booking.date,
    booking.time,
  );
  assert.equal(
    next.capacity.find((s) => s.id === slot.id).reserved,
    slot.reserved,
  );
});
test("completed service can remain unpaid; unconfirmed quotation is not accounts receivable", () => {
  const { data } = fixture();
  const done = data.orders.find((o) => o.stage === "done");
  assert.ok(orderAmounts(done).debt > 0);
  assert.notEqual(paymentLabel(done), "Đã thu đủ");
  assert.equal(
    orderAmounts(data.orders.find((o) => o.quote.status === "waiting")).debt,
    null,
  );
});
test("alerts have stable unique IDs and resolve when the underlying condition resolves", () => {
  const { data, booking } = fixture();
  const now = Date.parse(today + "T15:00:00+07:00");
  const alerts = operationAlerts(data, now);
  assert.equal(new Set(alerts.map((a) => a.id)).size, alerts.length);
  assert.ok(alerts.some((a) => a.id === `pending-${booking.id}`));
  assert.ok(
    !operationAlerts(
      applyBookingChange(data, booking, "confirm", booking.date, booking.time),
      now,
    ).some((a) => a.id === `pending-${booking.id}`),
  );
  assert.ok(alerts.some((a) => a.type === "stock"));
  assert.ok(alerts.some((a) => a.type === "deadline"));
});
