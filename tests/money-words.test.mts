import { test } from "node:test";
import assert from "node:assert/strict";
import { moneyWords } from "../src/lib/money-words.ts";

test("money is read in Vietnamese words", () => {
  assert.equal(moneyWords("10012520"), "Mười triệu không trăm mười hai nghìn năm trăm hai mươi đồng");
  assert.equal(moneyWords("0"), "Không đồng");
  assert.equal(moneyWords("105"), "Một trăm lẻ năm đồng");
  assert.equal(moneyWords("21"), "Hai mươi mốt đồng");
  assert.equal(moneyWords("15"), "Mười lăm đồng");
  assert.equal(moneyWords("1000500"), "Một triệu năm trăm đồng");
  assert.equal(moneyWords("2000000000"), "Hai tỷ đồng");
  assert.equal(moneyWords("1500000"), "Một triệu năm trăm nghìn đồng");
});
