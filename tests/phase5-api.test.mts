import test from "node:test";
import assert from "node:assert/strict";
import { blocksToText, textToBlocks } from "../src/lib/api/cms.ts";
import { rateText, subjectHref } from "../src/lib/api/operations.ts";
import { mergePublishedArticles } from "../src/lib/cms-content.ts";
import type { PublicDocument } from "../src/lib/api/cms.ts";
test("CMS plain text round trip preserves headings and never interprets HTML", () => {
  const blocks = [
    { tag: "h2" as const, text: "Chăm sóc xe" },
    { tag: "p" as const, text: '<img onerror="alert(1)"> & nội dung' },
    { tag: "li" as const, text: "Kiểm tra xe" },
  ];
  assert.deepEqual(textToBlocks(blocksToText(blocks)), blocks);
  assert.equal(rateText({ numerator: 0, denominator: 0 }), "— (0/0)");
  assert.equal(
    subjectHref("/co-van", "visit", "id"),
    "/co-van/phieu-dich-vu/id",
  );
});

test("published news escapes markup, overrides seeds and retains withdrawal tombstones", () => {
  const payload = {
    title: "Tiêu đề mới",
    description: "Mô tả",
    imageId: "asset",
    blocks: [
      { tag: "p" as const, text: "<img src=x onerror=\"alert(1)\"> & 'text'" },
    ],
    noindex: false,
    category: "Chăm xe",
    date: "2026-11-13",
  };
  const docs: PublicDocument[] = [
    {
      kind: "NEWS",
      key: "new-post",
      withdrawn: false,
      revisionId: "r",
      payload,
    },
  ];
  const result = mergePublishedArticles([], docs);
  assert.equal(result.length, 1);
  assert.ok(!result[0].content[0].html.includes("<img"));
  assert.ok(result[0].content[0].html.includes("&lt;img"));
  assert.equal(result[0].image.src, "/api/v1/public/cms/assets/asset");
  assert.equal(
    mergePublishedArticles(result, [
      { ...docs[0], payload: { ...payload, title: "Đã cập nhật" } },
    ])[0].title,
    "Đã cập nhật",
  );
  assert.deepEqual(
    mergePublishedArticles(result, [
      { ...docs[0], withdrawn: true, payload: null },
    ]),
    [],
  );
});

test("new CMS posts appear before legacy articles in newest publication-date order", () => {
  const payload = {
    title: "Bài mới",
    description: "",
    imageId: "image",
    blocks: [],
    noindex: false,
    category: "",
    date: "2026-11-13",
  };
  const doc: PublicDocument = {
    kind: "NEWS",
    key: "new-post",
    withdrawn: false,
    revisionId: "r",
    payload,
  };
  const seed = mergePublishedArticles(
    [],
    [{ ...doc, key: "old-post", payload: { ...payload, date: "2026-11-01" } }],
  );
  const merged = mergePublishedArticles(seed, [
    doc,
    { ...doc, key: "newer-post", payload: { ...payload, date: "2026-11-14" } },
  ]);
  assert.deepEqual(
    merged.map((a) => a.slug),
    ["newer-post", "new-post", "old-post"],
  );
});
