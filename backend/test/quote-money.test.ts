import { test } from "node:test";
import assert from "node:assert/strict";
import { quoteMoney } from "../src/quote-money";
test("VND calculations round each line, discount and VAT exactly once", () => {
  const result = quoteMoney(
    [
      {
        quantity: "1.5",
        unitPrice: "100001",
        discountPercent: "10",
        vatPercent: "8",
      },
    ],
    "5",
  );
  assert.deepEqual(result.lines, [
    {
      subtotal: "150002",
      discountTotal: "21750",
      taxTotal: "10260",
      total: "138512",
    },
  ]);
  assert.equal(result.total, "138512");
  assert.equal(
    quoteMoney(
      [
        {
          quantity: "0.5",
          unitPrice: "1",
          discountPercent: "0",
          vatPercent: "0",
        },
      ],
      "0",
    ).total,
    "1",
  );
});
test("VND arithmetic retains precision above Number safe integer and rejects overflow", () => {
  assert.equal(
    quoteMoney(
      [
        {
          quantity: "10",
          unitPrice: "900719925474099",
          discountPercent: "0",
          vatPercent: "0",
        },
      ],
      "0",
    ).total,
    "9007199254740990",
  );
  assert.equal(
    quoteMoney(
      [
        {
          quantity: "1",
          unitPrice: "100",
          discountPercent: "100",
          vatPercent: "100",
        },
      ],
      "100",
    ).total,
    "0",
  );
  assert.throws(() =>
    quoteMoney(
      [
        {
          quantity: "9999999",
          unitPrice: "999999999999999",
          discountPercent: "0",
          vatPercent: "0",
        },
      ],
      "0",
    ),
  );
  assert.throws(() =>
    quoteMoney(
      [
        {
          quantity: "1",
          unitPrice: "1",
          discountPercent: "101",
          vatPercent: "0",
        },
      ],
      "0",
    ),
  );
});
