import test from "node:test";
import assert from "node:assert/strict";
import { defaultSeoTitle, openingHours, seoChecks } from "../src/lib/service-seo.ts";

test("default title carries the year", () => {
  assert.equal(defaultSeoTitle("Phủ ceramic", 2026), "Phủ ceramic – Bảng giá 2026");
});

test("opening hours: Vietnamese labels to schema.org, closed days dropped", () => {
  assert.deepEqual(
    openingHours([
      { label: "Thứ Hai – Thứ Sáu", value: "08:00 – 18:00" },
      { label: "Thứ Bảy", value: "8h00 - 12h00" },
      { label: "Chủ Nhật", value: "Nghỉ" },
      { label: "Ngày lễ", value: "08:00 – 12:00" },
    ]),
    ["Mo-Fr 08:00-18:00", "Sa 08:00-12:00"],
  );
});

test("seo checks: keyword matched without accents, body outline read", () => {
  const body = {
    type: "doc",
    content: [
      { type: "heading", content: [{ type: "text", text: "Bảng giá bảo dưỡng ô tô" }] },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Bảo dưỡng ô tô định kỳ tại xưởng, " },
          { type: "text", text: "đặt lịch", marks: [{ type: "link", attrs: { href: "/dich-vu" } }] },
        ],
      },
      { type: "image", attrs: { alt: "" } },
    ],
  };
  const checks = seoChecks({
    keyword: "bao duong o to",
    title: "Bảo dưỡng ô tô định kỳ – Bảng giá 2026",
    description: "ngắn",
    slug: "bao-duong-o-to-dinh-ky",
    body,
    faqCount: 3,
    hasBanner: false,
  });
  const ok = (text: string) => checks.find((c) => c.text.startsWith(text))?.ok;
  assert.equal(ok("Tiêu đề"), true);
  assert.equal(ok("Mô tả"), false);
  assert.equal(ok("Từ khoá có trong tiêu đề SEO"), true);
  assert.equal(ok("Từ khoá có trong mô tả"), false);
  assert.equal(ok("Từ khoá có trong đường dẫn"), true);
  assert.equal(ok("Từ khoá có trong đoạn đầu bài"), true);
  assert.equal(ok("Từ khoá có trong ít nhất một tiêu đề"), true);
  assert.equal(ok("1 / 1 ảnh"), false);
  assert.equal(ok("Có link"), true);
  assert.equal(ok("3 câu hỏi"), true);
  assert.equal(ok("Có ảnh banner"), false);
});

test("extra JSON-LD: script wrapper stripped, @type required, context added", async () => {
  const { parseJsonLd } = await import("../src/lib/service-seo.ts");
  assert.deepEqual(parseJsonLd(""), { blocks: [] });
  assert.deepEqual(
    parseJsonLd('<script type="application/ld+json">{"@type":"VideoObject","name":"A"}</script>'),
    { blocks: [{ "@context": "https://schema.org", "@type": "VideoObject", name: "A" }] },
  );
  assert.ok(parseJsonLd('{"@type": "A",}').error);
  assert.ok(parseJsonLd('[{"@type":"A"},{"name":"no type"}]').error);
  assert.ok(parseJsonLd("[]").error);
  assert.ok(parseJsonLd('"text"').error);
});
