import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname, resolve, basename } from "node:path";
import {
  inspectLegacyFile,
  readLegacyFile,
  shaBytes,
} from "../src/legacy-file";
import { legacyFixture } from "./legacy-fixtures";
import { signedDocument, verifyDocument } from "../src/backup";
import { z } from "zod";

test("legacy format validates source counts, exact money and cutoff without matching identities by phone", () => {
  const f = legacyFixture(),
    bytes = Buffer.from(JSON.stringify(f)),
    r = inspectLegacyFile(bytes);
  assert.equal(r.report.valid, true);
  assert.equal(r.fileSha256, shaBytes(bytes));
  assert.equal(r.records[0].data!.phone, "+84909999999");
  const bad = structuredClone(f);
  bad.expected.totals.received = "1";
  assert.ok(
    inspectLegacyFile(Buffer.from(JSON.stringify(bad))).report.errors.some(
      (e) => e.code === "TOTAL_MISMATCH",
    ),
  );
  const duplicate = structuredClone(f);
  duplicate.records.push(duplicate.records[0]);
  assert.ok(
    inspectLegacyFile(
      Buffer.from(JSON.stringify(duplicate)),
    ).report.errors.some((e) => e.code === "DUPLICATE_SOURCE_ID"),
  );
});
test("unknown enum, floating money and post-cutoff data are quarantined with field codes only", () => {
  const f = legacyFixture();
  f.records[3].data.status = "IN_PROGRESS";
  f.records[3].data.quoteTotal = 100.5;
  f.records[3].data.password = "DO_NOT_LOG_THIS";
  const r = inspectLegacyFile(Buffer.from(JSON.stringify(f)));
  assert.equal(r.report.valid, false);
  assert.equal(r.records[3].data, null);
  assert.ok(!JSON.stringify(r.report).includes("DO_NOT_LOG_THIS"));
  const g = legacyFixture();
  g.records[3].data.occurredAt = "2027-01-01T00:00:00Z";
  assert.ok(
    inspectLegacyFile(Buffer.from(JSON.stringify(g))).report.errors.some(
      (e) => e.code === "AFTER_CUTOFF",
    ),
  );
});
test("source media may not escape the package directory or claim a different checksum", async () => {
  const folder = await mkdtemp(join(tmpdir(), "dpauto-legacy-test-"));
  try {
    const f = legacyFixture(),
      b = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    await writeFile(join(folder, "photo.png"), b);
    f.records.push({
      type: "MEDIA",
      key: "m-1",
      sourceVersion: "1",
      data: {
        historyKey: "h-1",
        name: "photo.png",
        relativePath: "photo.png",
        bytes: b.length,
        sha256: shaBytes(b),
        contentType: "image/png",
      },
    });
    f.expected.counts.MEDIA = 1;
    f.expected.totals.mediaBytes = b.length;
    const path = join(folder, "source.json");
    await writeFile(path, JSON.stringify(f));
    assert.equal((await readLegacyFile(path)).report.valid, true);
    f.records.at(-1)!.data.relativePath = "../photo.png";
    await writeFile(path, JSON.stringify(f));
    assert.equal((await readLegacyFile(path)).report.valid, false);
    f.records.at(-1)!.data.relativePath = "photo.png";
    f.records.at(-1)!.data.sha256 = "0".repeat(64);
    await writeFile(path, JSON.stringify(f));
    assert.equal((await readLegacyFile(path)).report.valid, false);
  } finally {
    assert.equal(dirname(folder), resolve(tmpdir()));
    assert.ok(basename(folder).startsWith("dpauto-legacy-test-"));
    await rm(folder, { recursive: true, force: true });
  }
});
test("operations evidence rejects signature tampering", () => {
  const schema = z.strictObject({ verified: z.literal(true) }),
    secret = "private-test-secret";
  const doc = signedDocument({ verified: true }, secret);
  assert.deepEqual(verifyDocument(doc, schema, secret), { verified: true });
  assert.throws(() =>
    verifyDocument({ ...doc, value: { verified: false } }, schema, secret),
  );
});
