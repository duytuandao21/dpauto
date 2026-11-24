import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { builtInKeys } from "../src/cms-builtin";
import { slug } from "../src/cms-contracts";

// The website's built-in slugs live in the frontend; this guards the copy the API reserves.
test("built-in CMS keys match the website seed and the slug rule", () => {
  const site = JSON.parse(
    readFileSync(resolve(__dirname, "../../src/data/site-content.json"), "utf8"),
  );
  const accessories = readFileSync(
    resolve(__dirname, "../../src/lib/accessories.ts"),
    "utf8",
  );
  assert.deepEqual(
    [...builtInKeys.SERVICE].sort(),
    site.services.map((s: { slug: string }) => s.slug).sort(),
  );
  assert.deepEqual(
    [...builtInKeys.NEWS].sort(),
    site.articles.map((a: { slug: string }) => a.slug).sort(),
  );
  for (const key of builtInKeys.ACCESSORY)
    assert.ok(accessories.includes(`"${key}"`), key);
  for (const keys of Object.values(builtInKeys))
    for (const key of keys) assert.match(key, slug);
});
