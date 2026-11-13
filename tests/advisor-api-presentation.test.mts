import test from "node:test";
import assert from "node:assert/strict";
import {
  visitFollowUp,
  visitStageTone,
  type Visit,
} from "../src/lib/api/visits.ts";

const now = Date.parse("2026-11-13T05:00:00Z");
const visit = (stage: Visit["stage"], work: Visit["work"] = null) =>
  ({ stage, work }) as Visit;

test("advisor follow-ups use live visit stages and never offer work on closed visits", () => {
  for (const [stage, tab] of [
    ["RECEIVED", "tong-quan"],
    ["INSPECTED", "bao-gia"],
    ["IN_PROGRESS", "thi-cong"],
    ["QUALITY_CHECK", "nghiem-thu"],
    ["READY", "nghiem-thu"],
  ] as const) {
    assert.equal(visitFollowUp(visit(stage), now)?.tab, tab);
  }
  assert.equal(visitFollowUp(visit("HANDED_OVER"), now), null);
  assert.equal(visitFollowUp(visit("ABORTED"), now), null);
});

test("overdue work is urgent only while it still needs completion", () => {
  const work = {
    status: "IN_PROGRESS",
    dueAt: "2026-11-13T11:59:00+07:00",
    total: 1,
    done: 0,
    technicians: [],
  };
  assert.equal(visitFollowUp(visit("IN_PROGRESS", work), now)?.priority, 0);
  assert.equal(
    visitFollowUp(
      visit("IN_PROGRESS", { ...work, dueAt: "2026-11-13T12:01:00+07:00" }),
      now,
    )?.priority,
    3,
  );
  assert.equal(
    visitFollowUp(visit("IN_PROGRESS", { ...work, status: "FINISHED" }), now)
      ?.priority,
    3,
  );
  assert.equal(
    visitFollowUp(visit("IN_PROGRESS", { ...work, status: "ABORTED" }), now)
      ?.priority,
    3,
  );
});

test("quote, work, inspection, completion and stopped visits retain distinct existing status colors", () => {
  assert.equal(
    new Set([
      visitStageTone.INSPECTED,
      visitStageTone.IN_PROGRESS,
      visitStageTone.QUALITY_CHECK,
      visitStageTone.HANDED_OVER,
      visitStageTone.ABORTED,
    ]).size,
    5,
  );
});
