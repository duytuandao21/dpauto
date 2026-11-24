import { test } from "node:test";
import assert from "node:assert/strict";
import { typePlate } from "../src/lib/advisor/formats.ts";

test("plate is formatted while typing", () => {
  assert.equal(typePlate("51m"), "51M");
  assert.equal(typePlate("51M79"), "51M-79");
  assert.equal(typePlate("51M796"), "51M-796");
  assert.equal(typePlate("51M79631"), "51M-796.31");
  assert.equal(typePlate("51m-796.31"), "51M-796.31");
  assert.equal(typePlate("51F123456"), "51F1-234.56");
  assert.equal(typePlate("51A1234"), "51A-1234");
});
