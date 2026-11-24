import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { processImage, regenerateOg } from "../src/image-pipeline";

const photo = (
  width: number,
  height: number,
  format: "jpeg" | "png" | "gif" = "jpeg",
) =>
  sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 30, b: 30 },
    },
  })
    .toFormat(format)
    .toBuffer();

test("creates AVIF + WebP widths up to 1920, a 1200×630 share image and a placeholder", async () => {
  const p = await processImage(await photo(3000, 2000));
  assert.equal(p.width, 2560);
  assert.equal(p.height, 1707);
  assert.deepEqual(
    p.variants.filter((v) => v.format === "webp").map((v) => v.width),
    [320, 640, 960, 1280, 1920],
  );
  assert.equal(p.variants.filter((v) => v.format === "avif").length, 5);
  const og = p.files.find((f) => f.key === p.ogKey)!;
  const ogMeta = await sharp(og.body).metadata();
  assert.deepEqual(
    [ogMeta.format, ogMeta.width, ogMeta.height],
    ["jpeg", 1200, 630],
  );
  assert.match(p.placeholder, /^data:image\/webp;base64,/);
  assert.equal(
    p.files.find((f) => f.bucket === "originals")!.key,
    p.originalKey,
  );
  assert.ok(p.files.every((f) => f.key.includes(p.sha256)));
});

test("never enlarges a small image", async () => {
  const p = await processImage(await photo(200, 100, "png"));
  assert.deepEqual(
    p.variants.map((v) => [v.format, v.width, v.height]),
    [
      ["avif", 200, 100],
      ["webp", 200, 100],
    ],
  );
});

test("applies EXIF rotation and strips EXIF/GPS from every public file", async () => {
  const input = await sharp(await photo(400, 200))
    .withExif({ IFD3: { GPSLatitudeRef: "N" } })
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer();
  const before = await sharp(input).metadata();
  assert.ok(before.exif && before.orientation === 6);
  const p = await processImage(input);
  assert.deepEqual([p.width, p.height], [200, 400]);
  for (const f of p.files.filter((f) => f.bucket === "public")) {
    const m = await sharp(f.body).metadata();
    assert.equal(m.exif, undefined, f.key);
    assert.ok(!m.orientation || m.orientation === 1, f.key);
  }
});

test("rejects files that are not supported photos", async () => {
  const svg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>',
  );
  for (const bad of [
    Buffer.from("not an image at all, just text"),
    svg,
    await photo(20, 20, "gif"),
  ])
    await assert.rejects(processImage(bad), { code: "INVALID_IMAGE" });
});

test("share image key follows the focal point", async () => {
  const input = await photo(1600, 1600),
    og = await regenerateOg(input, "abc", 0.25, 0.8);
  assert.equal(og.key, "media/abc/og-25-80.jpg");
  assert.equal((await sharp(og.body).metadata()).height, 630);
});
