import test from "node:test";
import assert from "node:assert/strict";
import { shiftHours } from "../src/operations-utils";
test("adjacent shifts are continuous while leave gaps remain unavailable without mutating policy hours", () => {
  const hours = [{ start: 0, end: 100 }];
  const shifts = [
    { kind: "WORK", start: 0, end: 50 },
    { kind: "WORK", start: 50, end: 100 },
  ];
  assert.deepEqual(shiftHours(hours, shifts), hours);
  assert.deepEqual(
    shiftHours(hours, [...shifts, { kind: "LEAVE", start: 40, end: 60 }]),
    [
      { start: 0, end: 40 },
      { start: 60, end: 100 },
    ],
  );
  const copy = shiftHours(hours, []);
  copy[0].end = 1;
  assert.deepEqual(hours, [{ start: 0, end: 100 }]);
});
