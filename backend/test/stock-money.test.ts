import { test } from "node:test";
import assert from "node:assert/strict";
import {
  quantity,
  decimal,
  issueValue,
  money,
  rounded,
} from "../src/stock-money";
test("stock decimals and moving average preserve exact quantity and carrying value", () => {
  assert.equal(quantity("12.005"), 12005n);
  assert.equal(decimal(-1001n), "-1.001");
  assert.equal(decimal(quantity("9999999999999.999")), "9999999999999.999");
  const qty = quantity("3"),
    value = 100n,
    first = issueValue(value, qty, 1000n),
    last = issueValue(value - first, qty - 1000n, 2000n);
  assert.equal(first + last, 100n);
  assert.equal(rounded(11n, 2n), 6n);
  assert.throws(() => issueValue(100n, 1000n, 1001n));
  assert.throws(() => money(-1n));
  assert.throws(() => quantity("1.0001"));
});
