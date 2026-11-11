import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

function moduleUrl(file, replacements = {}) {
  let source = ts.transpileModule(
    fs.readFileSync(new URL(file, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2020,
      },
    },
  ).outputText;
  for (const [from, to] of Object.entries(replacements))
    source = source.replaceAll(`"${from}"`, JSON.stringify(to));
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
}
const logicUrl = moduleUrl("../src/lib/booking/logic.ts");
const {
  allowedActions,
  transitionBooking,
  validateDraft,
  shiftDate,
  validDate,
  terminal,
} = await import(logicUrl);
const { createSeed } = await import(
  moduleUrl("../src/lib/booking/seed.ts", { "./logic": logicUrl })
);
const seed = createSeed("2026-11-07");

test("mock data has consistent relationships and follows the supplied relative date", () => {
  assert.equal(seed.bookings.length, 18);
  assert.equal(
    seed.bookings.filter((b) =>
      (b.confirmedAt || b.requestedAt).startsWith("2026-11-07"),
    ).length,
    6,
  );
  const customers = new Set(seed.customers.map((c) => c.id));
  const vehicles = new Set(seed.vehicles.map((v) => v.id));
  for (const b of seed.bookings) {
    assert.ok(customers.has(b.customerId));
    assert.ok(vehicles.has(b.vehicleId));
    assert.ok(b.events.length);
    assert.ok(b.serviceIds.length);
  }
  assert.equal(shiftDate("2026-12-31", 1), "2027-01-01");
  assert.equal(validDate("2026-02-30"), false);
});
test("booking lifecycle only permits valid transitions and logs every action", () => {
  let b = seed.bookings[0];
  const count = b.events.length;
  assert.throws(() => transitionBooking(b, "complete"));
  b = transitionBooking(b, "confirm");
  assert.equal(b.status, "confirmed");
  assert.equal(b.confirmedAt, b.requestedAt);
  b = transitionBooking(b, "arrive");
  assert.equal(b.status, "arrived");
  assert.throws(() => transitionBooking(b, "cancel"));
  b = transitionBooking(b, "complete");
  assert.equal(b.status, "completed");
  assert.equal(b.events.length, count + 3);
  assert.equal(terminal(b.status), true);
  assert.deepEqual(allowedActions(b), []);
  assert.throws(() => transitionBooking(b, "confirm"));
});
test("no-show is available only after confirmed appointment time", () => {
  const b = seed.bookings[1];
  assert.equal(
    allowedActions(b, new Date("2026-11-06T12:00:00")).includes("no_show"),
    false,
  );
  assert.equal(
    allowedActions(b, new Date("2026-11-08T12:00:00")).includes("no_show"),
    true,
  );
  assert.equal(
    transitionBooking(b, "no_show", new Date("2026-11-08T12:00:00")).status,
    "no_show",
  );
  assert.equal(
    transitionBooking(seed.bookings[0], "cancel").status,
    "cancelled",
  );
});
test("form rejects missing data, impossible dates, past dates, invalid phone and incomplete confirmation", () => {
  const draft = {
    name: "Khách mẫu",
    phone: "0900000099",
    model: "Toyota",
    serviceIds: ["wash"],
    date: "2026-11-07",
    time: "09:00",
    confirmedDate: "",
    confirmedTime: "",
    advisorId: "a1",
  };
  assert.deepEqual(validateDraft(draft, "2026-11-07"), {});
  assert.ok(validateDraft({ ...draft, phone: "abc" }, "2026-11-07").phone);
  assert.ok(validateDraft({ ...draft, date: "2026-11-06" }, "2026-11-07").date);
  assert.ok(validateDraft({ ...draft, date: "2026-02-30" }, "2026-11-07").date);
  assert.ok(
    validateDraft({ ...draft, serviceIds: [] }, "2026-11-07").serviceIds,
  );
  assert.ok(
    validateDraft({ ...draft, confirmedDate: "2026-11-08" }, "2026-11-07")
      .confirmedTime,
  );
  assert.ok(validateDraft({ ...draft, time: "25:99" }, "2026-11-07").time);
});
