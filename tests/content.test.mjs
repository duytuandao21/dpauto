import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const content = JSON.parse(
  fs.readFileSync(
    new URL("../src/data/site-content.json", import.meta.url),
    "utf8",
  ),
);

test("every original service and article has its own unique route and complete content", () => {
  assert.equal(content.services.length, 10);
  assert.equal(content.articles.length, 6);
  for (const group of [content.services, content.articles]) {
    assert.equal(new Set(group.map((item) => item.slug)).size, group.length);
    for (const item of group) {
      assert.ok(item.title);
      assert.ok(item.description);
      assert.ok(item.image.src);
    }
  }
  for (const service of content.services) {
    assert.equal(service.process.length, 4, service.slug);
    assert.ok(service.overviewHtml.includes("<p>"), service.slug);
    assert.ok(service.gallery.length >= 2, service.slug);
    assert.equal(service.faq.length, 4, service.slug);
  }
  for (const article of content.articles)
    assert.ok(article.content.length > 15, article.slug);
});

test("every local content asset exists and retains its original file", () => {
  const serialized = JSON.stringify(content);
  const assets = [
    ...new Set(serialized.match(/\/(?:images|videos|fonts)\/[A-Za-z0-9_.-]+/g)),
  ];
  assert.ok(assets.length > 60);
  for (const asset of assets) {
    const file = new URL(`../public${asset}`, import.meta.url);
    assert.ok(fs.existsSync(file), asset);
    assert.ok(fs.statSync(file).size > 0, asset);
  }
  assert.equal(
    fs.readdirSync(new URL("../public/images/", import.meta.url)).length,
    82,
  );
  assert.equal(
    fs.readdirSync(new URL("../public/videos/", import.meta.url)).length,
    3,
  );
  assert.equal(
    fs.readdirSync(new URL("../public/fonts/", import.meta.url)).length,
    9,
  );
});

test("all FAQ answers and before/after image pairs are present", () => {
  assert.equal(content.home.faq.length, 8);
  for (const item of [
    ...content.home.faq,
    ...content.services.flatMap((s) => s.faq),
  ]) {
    assert.ok(item.question.length > 5);
    assert.ok(item.answer.length > 20, `Missing answer: ${item.question}`);
  }
  assert.equal(content.projects.length, 6);
  for (const project of content.projects) {
    assert.notEqual(project.before.src, project.after.src);
    assert.ok(project.before.alt.toLowerCase().includes("before"));
    assert.ok(project.after.alt.toLowerCase().includes("after"));
  }
});

test("article links resolve to implemented local pages or explicit external destinations", () => {
  const routes = new Set([
    "/",
    "/services",
    "/news",
    "/our-work",
    "/about",
    "/contact",
    "/privacy",
    "/terms",
    ...content.services.map((s) => `/services/${s.slug}`),
    ...content.articles.map((a) => `/news/${a.slug}`),
  ]);
  for (const item of content.articles.flatMap((a) => a.content)) {
    for (const match of item.html.matchAll(/href="([^"]+)"/g)) {
      const href = match[1];
      if (/^(https?:|tel:|mailto:|#)/.test(href)) continue;
      assert.ok(routes.has(href.split("#")[0]), `Unresolved link: ${href}`);
    }
  }
});
