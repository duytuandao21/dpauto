import test from "node:test";
import assert from "node:assert/strict";
import { stockDraftBody } from "../src/lib/api/stock-finance.ts";
test("stock draft excludes server snapshots and calculated movement values while preserving exact decimal strings", () => {
  const body = stockDraftBody({
    warehouseId: "w",
    kind: "ADJUSTMENT",
    counterparty: "Kiểm kê",
    reason: "Đếm thực tế",
    lines: [
      {
        id: "server-line",
        partId: "p",
        quantity: "-0.125",
        unitCost: "900719925474099",
        part: { name: "Không gửi snapshot từ client", unit: "chai" },
        quantityDelta: "999",
        valueDelta: "999",
        expectedBalanceVersion: 7,
        requestId: null,
        originalLineId: null,
      },
    ],
  });
  assert.equal(body.lines[0].quantity, "-0.125");
  assert.equal(body.lines[0].unitCost, "900719925474099");
  assert.equal(body.lines[0].expectedBalanceVersion, 7);
  assert.equal(body.lines[0].requestId, undefined);
  assert.equal("id" in body.lines[0], false);
  assert.equal("valueDelta" in body.lines[0], false);
  assert.equal("part" in body.lines[0], false);
});
