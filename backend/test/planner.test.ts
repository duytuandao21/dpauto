import { test } from "node:test";
import assert from "node:assert/strict";
import { plan, type PlannerInput } from "../src/capacity/planner";

const minute = 60000;
const input = (): PlannerInput => ({
  requirements: [
    { key: "a", poolId: "pool", units: 1, start: 0, end: 30 * minute },
  ],
  resources: [
    {
      id: "bay",
      code: "BAY",
      pools: ["pool"],
      hours: [{ start: 0, end: 60 * minute }],
    },
  ],
  hours: [{ start: 0, end: 60 * minute }],
  blocks: [],
  busy: [],
  buckets: [
    {
      poolId: "pool",
      start: 0,
      end: 30 * minute,
      limit: 1,
      held: 0,
      closed: false,
    },
    {
      poolId: "pool",
      start: 30 * minute,
      end: 60 * minute,
      limit: 1,
      held: 0,
      closed: false,
    },
  ],
  bucketMinutes: 30,
  gridOrigin: 0,
});
test("continuous resource: combined minutes cannot replace one continuous bay", () => {
  const value = input();
  value.requirements[0].end = 60 * minute;
  value.resources.push({
    id: "other",
    code: "OTHER",
    pools: ["pool"],
    hours: [{ start: 0, end: 60 * minute }],
  });
  value.busy = [
    { resourceId: "bay", start: 0, end: 30 * minute, keys: [] },
    { resourceId: "other", start: 30 * minute, end: 60 * minute, keys: [] },
  ];
  assert.throws(
    () => plan(value),
    (e: any) => e.code === "CAPACITY_FULL",
  );
});
test("sequential raw requirements share one rounded allocation and one charge", () => {
  const value = input();
  value.requirements = [
    { key: "a", poolId: "pool", units: 1, start: 0, end: 5 * minute },
    { key: "b", poolId: "pool", units: 1, start: 5 * minute, end: 10 * minute },
  ];
  const result = plan(value);
  assert.equal(result.allocations.length, 1);
  assert.equal(result.charges.length, 1);
  assert.equal(result.charges[0].units, 1);
  assert.deepEqual(result.allocations[0].keys, ["a", "b"]);
});
test("pool membership never duplicates physical capacity", () => {
  const value = input();
  value.resources[0].pools.push("second");
  value.requirements.push({
    ...value.requirements[0],
    key: "b",
    poolId: "second",
  });
  value.buckets.push({ ...value.buckets[0], poolId: "second" });
  assert.throws(
    () => plan(value),
    (e: any) => e.code === "CAPACITY_FULL",
  );
});
test("planner exhaustion is unavailable, not a false full result", () => {
  const value = input();
  value.budget = 1;
  assert.throws(
    () => plan(value),
    (e: any) => e.status === 503 && e.code === "CAPACITY_CHECK_UNAVAILABLE",
  );
});
