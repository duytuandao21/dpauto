import { test } from "node:test";
import assert from "node:assert/strict";
import { bookingQuery } from "../src/contracts";

test("active queues allow undated pending/arrived requests, other undated searches still require scope", () => {
  assert.ok(bookingQuery.safeParse({ status: "PENDING" }).success);
  assert.ok(bookingQuery.safeParse({ status: "PENDING,ARRIVED" }).success);
  assert.equal(bookingQuery.safeParse({ status: "COMPLETED" }).success, false);
  assert.equal(bookingQuery.safeParse({}).success, false);
  assert.equal(
    bookingQuery.safeParse({ status: "PENDING", from: "2026-11-13" }).success,
    false,
  );
});
