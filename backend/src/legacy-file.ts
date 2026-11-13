import { readFile, realpath, stat } from "node:fs/promises";
import {
  dirname,
  isAbsolute,
  relative,
  resolve,
  win32,
  posix,
} from "node:path";
import { canonical, fail, hash, parse } from "./common";
import { decimal, quantity } from "./stock-money";
import {
  exportFile,
  payloads,
  recordTypes,
  rowEnvelope,
  type LegacyType,
} from "./legacy-contracts";
import type { Row } from "./database";

export const emptyTotals = () => ({
  quoteTotal: "0",
  received: "0",
  refunded: "0",
  outstanding: "0",
  openingDebt: "0",
  deposits: "0",
  cashCollected: "0",
  cashRefunded: "0",
  stockValue: "0",
  stockQuantities: {} as Record<string, string>,
  activeOrders: 0,
  mediaBytes: 0,
});
export type ImportRow = {
  row: number;
  type: string;
  key: string;
  sourceVersion: string;
  checksum: string;
  data: Row | null;
  errors: string[];
  media?: Buffer;
};
export function inspectLegacyFile(bytes: Buffer) {
  if (bytes.length > 20 * 1024 * 1024) fail(413, "LEGACY_FILE_TOO_LARGE");
  let raw: unknown;
  try {
    raw = JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/, ""));
  } catch {
    fail(400, "LEGACY_JSON_INVALID");
  }
  const input = parse(exportFile, raw),
    seen = new Set<string>(),
    records: ImportRow[] = [],
    counts = Object.fromEntries(recordTypes.map((t) => [t, 0])) as Record<
      LegacyType,
      number
    >,
    totals = emptyTotals();
  for (const [index, value] of input.records.entries()) {
    const envelope = rowEnvelope.safeParse(value),
      errors: string[] = [];
    const r: ImportRow = {
      row: index + 1,
      type: envelope.success ? envelope.data.type : "UNKNOWN",
      key: envelope.success ? envelope.data.key : `row:${index + 1}`,
      sourceVersion: envelope.success ? envelope.data.sourceVersion : "unknown",
      checksum: hash(canonical(value)),
      data: null,
      errors,
    };
    if (!envelope.success) errors.push("INVALID_ENVELOPE");
    else {
      const e = envelope.data,
        body = payloads[e.type].safeParse(e.data);
      counts[e.type]++;
      const identity = e.type + ":" + e.key;
      if (seen.has(identity)) errors.push("DUPLICATE_SOURCE_ID");
      seen.add(identity);
      if (!body.success)
        errors.push(
          ...body.error.issues.map((i) => "FIELD:" + i.path.join(".")),
        );
      else {
        r.data = body.data;
        r.checksum = hash(
          canonical({ type: e.type, key: e.key, data: body.data }),
        );
        const d = r.data!,
          at = d.occurredAt || d.asOf || d.validFrom;
        if (at && +new Date(at) > +new Date(input.cutoffAt))
          errors.push("AFTER_CUTOFF");
        if (e.type === "HISTORY")
          for (const k of [
            "quoteTotal",
            "received",
            "refunded",
            "outstanding",
          ] as const)
            totals[k] = (BigInt(totals[k]) + BigInt(d[k])).toString();
        if (e.type === "FINANCE") {
          if (d.mode === "OPENING" && !["DEBT", "DEPOSIT"].includes(d.kind))
            errors.push("OPENING_KIND_INVALID");
          const k =
            d.mode === "OPENING"
              ? d.kind === "DEBT"
                ? "openingDebt"
                : "deposits"
              : d.kind === "COLLECT"
                ? "cashCollected"
                : d.kind === "REFUND"
                  ? "cashRefunded"
                  : null;
          if (k) totals[k] = (BigInt(totals[k]) + BigInt(d.amount)).toString();
        }
        if (e.type === "STOCK" && d.mode === "OPENING") {
          const k = JSON.stringify([d.warehouseCode, d.partCode, d.unit]);
          totals.stockQuantities[k] = decimal(
            quantity(totals.stockQuantities[k] || "0") + quantity(d.quantity),
          );
          totals.stockValue = (
            BigInt(totals.stockValue) + BigInt(d.value)
          ).toString();
          if (quantity(d.quantity) === 0n && BigInt(d.value) !== 0n)
            errors.push("STOCK_VALUE_WITHOUT_QUANTITY");
        }
        if (e.type === "ACTIVE_ORDER") totals.activeOrders++;
        if (e.type === "MEDIA") totals.mediaBytes += d.bytes;
      }
    }
    records.push(r);
  }
  const expectedCounts = Object.fromEntries(
    recordTypes.map((t) => [t, input.expected.counts[t] || 0]),
  );
  const expectedQuantities = Object.fromEntries(
    Object.entries(input.expected.totals.stockQuantities).map(([k, v]) => [
      k,
      decimal(quantity(v)),
    ]),
  );
  const totalsMatch =
    canonical({
      ...input.expected.totals,
      stockQuantities: expectedQuantities,
    }) === canonical(totals);
  const errors = records.flatMap((r) =>
    r.errors.map((code) => ({ row: r.row, code })),
  );
  if (canonical(expectedCounts) !== canonical(counts))
    errors.push({ row: 0, code: "COUNT_MISMATCH" });
  if (!totalsMatch) errors.push({ row: 0, code: "TOTAL_MISMATCH" });
  return {
    input,
    records,
    fileSha256: shaBytes(bytes),
    report: { counts, totals, errors, valid: errors.length === 0 },
  };
}
export async function readLegacyFile(path: string) {
  if ((await stat(path)).size > 20 * 1024 * 1024)
    fail(413, "LEGACY_FILE_TOO_LARGE");
  const checked = inspectLegacyFile(await readFile(path)),
    root = await realpath(dirname(resolve(path)));
  if (checked.report.totals.mediaBytes > 100 * 1024 * 1024)
    fail(413, "LEGACY_MEDIA_BATCH_TOO_LARGE");
  for (const r of checked.records.filter(
    (r) => r.type === "MEDIA" && r.data && !r.errors.length,
  )) {
    try {
      const d = r.data!,
        p = d.relativePath as string;
      if (
        win32.isAbsolute(p) ||
        posix.isAbsolute(p) ||
        p.split(/[\\/]/).includes("..")
      )
        fail(422, "MEDIA_PATH_INVALID");
      const full = await realpath(resolve(root, p)),
        rel = relative(root, full);
      if (rel.startsWith("..") || isAbsolute(rel))
        fail(422, "MEDIA_PATH_INVALID");
      const info = await stat(full);
      if (!info.isFile() || info.size !== d.bytes || info.size > 10485760)
        fail(422, "MEDIA_SIZE_MISMATCH");
      const b = await readFile(full),
        signature =
          d.contentType === "image/jpeg"
            ? b[0] === 255 &&
              b[1] === 216 &&
              b.at(-2) === 255 &&
              b.at(-1) === 217
            : d.contentType === "image/png"
              ? b
                  .subarray(0, 8)
                  .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
              : d.contentType === "image/webp"
                ? b.toString("ascii", 0, 4) === "RIFF" &&
                  b.toString("ascii", 8, 12) === "WEBP"
                : b.toString("ascii", 0, 5) === "%PDF-";
      if (!signature || shaBytes(b) !== d.sha256)
        fail(422, "MEDIA_CHECKSUM_MISMATCH");
      r.media = b;
    } catch {
      r.errors.push("MEDIA_UNAVAILABLE_OR_INVALID");
      checked.report.errors.push({
        row: r.row,
        code: "MEDIA_UNAVAILABLE_OR_INVALID",
      });
      checked.report.valid = false;
    }
  }
  return checked;
}
import { createHash } from "node:crypto";
export const shaBytes = (b: Buffer) =>
  createHash("sha256").update(b).digest("hex");
