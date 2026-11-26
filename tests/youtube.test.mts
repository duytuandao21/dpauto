import test from "node:test";
import assert from "node:assert/strict";
import { youtubeId } from "../src/lib/youtube.ts";

test("youtube id: common link shapes, rejects others", () => {
  const id = "dQw4w9WgXcQ";
  for (const url of [
    `https://www.youtube.com/watch?v=${id}&t=30s`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://youtu.be/${id}?si=abc`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube.com/embed/${id}`,
    `https://www.youtube.com/live/${id}?feature=share`,
  ])
    assert.equal(youtubeId(url), id, url);
  for (const url of [
    "",
    undefined,
    "not a url",
    `https://vimeo.com/${id}`,
    "https://www.youtube.com/watch?v=short",
    "https://www.youtube.com/@channel",
  ])
    assert.equal(youtubeId(url), null, String(url));
});
