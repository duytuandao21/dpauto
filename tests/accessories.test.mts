import { test } from "node:test";
import assert from "node:assert/strict";
import {
  accessories,
  accessoryBrands,
  filterAccessories,
  searchText,
} from "../src/lib/accessories.ts";

test("accessory search ignores Vietnamese accents and case", () => {
  assert.equal(searchText("  Cảm Biến ÁP SUẤT  "), "cam bien ap suat");
  assert.equal(searchText("Đèn"), "den");
  assert.equal(filterAccessories({ query: "camera hanh trinh" }).length, 7);
});

test("brand, category and search combine; sorting never drops items", () => {
  const zestech = filterAccessories({ brand: "Zestech" });
  assert.deepEqual(
    zestech.map((p) => p.id),
    ["zestech-c500", "zestech-dx165", "zestech-tpms"],
  );
  assert.equal(
    filterAccessories({ brand: "ICAR", category: "Android Box" }).length,
    3,
  );
  assert.equal(filterAccessories({ brand: "VietMap", query: "m2" }).length, 1);
  const az = filterAccessories({ sort: "name-asc" });
  assert.equal(az.length, accessories.length);
  assert.equal(az[0].name, "70mai A810");
  assert.equal(
    filterAccessories({ sort: "name-desc" })[0].name,
    az.at(-1)!.name,
  );
  // Every product's brand has a logo tile.
  for (const p of accessories)
    assert.ok(
      accessoryBrands.some((b) => b.name === p.brand),
      p.brand,
    );
});
