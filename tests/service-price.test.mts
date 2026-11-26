import test from "node:test";
import assert from "node:assert/strict";
import { servicePrice, priceText } from "../src/lib/service-price.ts";

test("service price: structured fields, legacy text and contact fallback", () => {
  assert.deepEqual(
    priceText(servicePrice({ priceKind: "FROM", priceAmount: 239000 })),
    { label: "Giá từ", value: "239.000đ" },
  );
  assert.equal(
    priceText(servicePrice({ priceKind: "FIXED", priceAmount: 1500000 })).label,
    "Giá chỉ",
  );
  assert.deepEqual(servicePrice({ priceFrom: "Từ 1.500.000đ" }), {
    kind: "FROM",
    amount: 1500000,
  });
  assert.equal(servicePrice({ priceFrom: "Giá chỉ 899000" })!.kind, "FIXED");
  assert.equal(servicePrice({ priceFrom: "1tr5" }), null);
  assert.equal(servicePrice({ priceKind: "FROM" }), null);
  assert.deepEqual(priceText(null), { label: "", value: "Liên hệ báo giá" });
});

test("service pricing: columns by id, single column fallback, empty table", async () => {
  const { servicePricing } = await import("../src/lib/service-price.ts");
  assert.equal(servicePricing({ pricing: [{ name: " " }] }), null);
  const single = servicePricing({ pricing: [{ name: "Cơ bản", prices: { _: 350000 } }] })!;
  assert.deepEqual(single.columns, ["Giá"]);
  assert.deepEqual(single.rows[0].prices, [350000]);
  const table = servicePricing({
    pricingColumns: [{ id: "b", name: "SUV" }, { id: "a", name: "Sedan" }],
    pricing: [{ name: "Cao cấp", featured: true, prices: { a: 650000 } }],
  })!;
  assert.deepEqual(table.columns, ["SUV", "Sedan"]);
  assert.deepEqual(table.rows[0].prices, [null, 650000]);
});
