import { test } from "node:test";
import assert from "node:assert/strict";
import { pendingQueue } from "../src/lib/booking/queue.ts";
import type { Booking } from "../src/lib/booking/types.ts";
import {
  formatDate,
  timeLabel,
  localDate,
  shiftDate,
  validDate,
} from "../src/lib/booking/logic.ts";

test("rescheduled pending requests prioritize the current requested day without overwriting their origin", () => {
  const original = {
    id: "moved",
    status: "pending",
    requestedAt: "2026-11-14T07:30:00+07:00",
    scheduledAt: "2026-11-28T12:30:00+07:00",
    createdAt: "2026-11-13T00:00:00Z",
  } as Booking;
  const earlier = {
    ...original,
    id: "earlier",
    requestedAt: "2026-11-20T07:30:00+07:00",
    scheduledAt: "2026-11-20T07:30:00+07:00",
  };
  assert.deepEqual(
    pendingQueue([original, earlier]).map((b) => b.id),
    ["earlier", "moved"],
  );
  assert.equal(original.requestedAt, "2026-11-14T07:30:00+07:00");
});

test("dates display dd/mm/yyyy in HCM regardless of the browser timezone", () => {
  assert.equal(formatDate("2026-11-13"), "13/11/2026");
  assert.equal(formatDate("2026-11-13T17:15:00Z"), "14/11/2026");
  assert.equal(timeLabel("2026-11-13T17:15:00Z"), "00:15");
  assert.equal(timeLabel("2026-11-14T09:30:00"), "09:30");
  assert.equal(localDate(new Date("2026-11-13T17:15:00Z")), "2026-11-14");
  assert.equal(shiftDate("2026-12-31", 1), "2027-01-01");
  assert.equal(validDate("2026-02-30"), false);
});

test("pending queue includes future and old requests, orders near dates then oldest, excludes terminal", () => {
  const make = (
    id: string,
    date: string,
    created: string,
    status = "pending",
  ) => ({ id, requestedAt: date, createdAt: created, status }) as Booking;
  const queue = pendingQueue([
    make("future", "2027-02-01", "2026-11-10"),
    make("new", "2026-11-14", "2026-11-13"),
    make("old", "2026-11-14", "2026-11-12"),
    make("done", "2026-11-13", "2026-11-10", "confirmed"),
  ]);
  assert.deepEqual(
    queue.map((b) => b.id),
    ["old", "new", "future"],
  );
});
