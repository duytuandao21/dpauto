import { test } from "node:test";
import assert from "node:assert/strict";
import { receiveInput } from "../src/visit-contracts";

const service = "10000000-0000-4000-8000-000000000001";
const base = {
  expectedVersion: 1,
  vehicle: { model: "Honda Civic", plate: "79A12345" },
  vehicleVerified: true,
  policyVersion: 1,
  intake: {
    request: "Kiểm tra xe",
    odometer: null,
    conditions: { operation: [] },
  },
};

test("booking reception accepts an optional validated service selection and keeps old clients compatible", () => {
  assert.equal(receiveInput.safeParse(base).success, true);
  assert.equal(
    receiveInput.safeParse({
      ...base,
      serviceIds: [service],
      catalogVersion: 1,
    }).success,
    true,
  );
  for (const invalid of [
    { serviceIds: [service] },
    { catalogVersion: 1 },
    { serviceIds: [], catalogVersion: 1 },
    { serviceIds: [service, service], catalogVersion: 1 },
    { serviceIds: ["unknown"], catalogVersion: 1 },
    { serviceIds: [service], catalogVersion: 0 },
    {
      serviceIds: Array.from(
        { length: 11 },
        (_, index) =>
          `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      ),
      catalogVersion: 1,
    },
  ])
    assert.equal(
      receiveInput.safeParse({ ...base, ...invalid }).success,
      false,
    );
});
