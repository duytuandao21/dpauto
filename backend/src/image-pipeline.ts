import { createHash } from "node:crypto";
import sharp from "sharp";
import { fail } from "./common";

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
/** Request body limit for the upload route: the larger of the image and video limits. */
export const MAX_UPLOAD_BYTES = MAX_VIDEO_BYTES;
// ISO-BMFF brands that are still images (HEIC/AVIF), not playable video.
const imageBrands = new Set(["heic", "heix", "hevc", "heim", "heis", "mif1", "msf1", "avif", "avis"]);
/**
 * Browser-playable video from the bytes, never the file name: MP4 (ISO-BMFF `ftyp`) or WebM (EBML).
 * QuickTime `.mov` is refused because Chrome and Firefox often cannot play it.
 */
export function videoType(b: Buffer): { mime: string; ext: string } | undefined {
  if (b.length < 16) return undefined;
  if (b.toString("latin1", 4, 8) === "ftyp") {
    const brand = b.toString("latin1", 8, 12);
    if (brand === "qt  " || imageBrands.has(brand)) return undefined;
    return { mime: "video/mp4", ext: "mp4" };
  }
  if (b.readUInt32BE(0) === 0x1a45dfa3 && b.subarray(0, 64).includes("webm"))
    return { mime: "video/webm", ext: "webm" };
  return undefined;
}
const MAX_PIXELS = 50_000_000,
  MAX_EDGE = 2560,
  WIDTHS = [320, 640, 960, 1280, 1920],
  OG = { width: 1200, height: 630 };
const accepted: Record<string, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
};

export type Variant = {
  width: number;
  height: number;
  format: "avif" | "webp";
  key: string;
  bytes: number;
};
export type Processed = {
  sha256: string;
  mime: string;
  bytes: number;
  width: number;
  height: number;
  originalKey: string;
  placeholder: string;
  variants: Variant[];
  ogKey: string;
  /** Files to store; key → body + content type. */
  files: {
    bucket: "public" | "originals";
    key: string;
    body: Buffer;
    type: string;
  }[];
};

// Two images at a time keeps a small VPS responsive; later uploads wait instead of failing.
let active = 0;
const waiting: (() => void)[] = [];
async function slot<T>(fn: () => Promise<T>) {
  if (active < 2) active++;
  else await new Promise<void>((r) => waiting.push(r));
  try {
    return await fn();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else active--;
  }
}

export const sha256 = (b: Buffer) =>
  createHash("sha256").update(b).digest("hex");
export const ogKeyFor = (sha: string, x: number, y: number) =>
  `media/${sha}/og-${Math.round(x * 100)}-${Math.round(y * 100)}.jpg`;
const invalid = () =>
  fail(
    422,
    "INVALID_IMAGE",
    "Ảnh phải là JPEG, PNG, WebP hoặc AVIF, tối đa 20 MB và 50 megapixel. Ảnh HEIC của iPhone cần chuyển sang JPEG trước.",
  );

/** Reads the real format from the bytes, never from the file name or client header. */
export async function inspect(input: Buffer) {
  if (input.length < 12 || input.length > MAX_IMAGE_BYTES) invalid();
  const meta = await sharp(input, { limitInputPixels: MAX_PIXELS })
    .metadata()
    .catch(() => invalid());
  const ext =
    meta.format === "heif"
      ? meta.compression === "av1"
        ? "avif"
        : undefined
      : accepted[meta.format || ""];
  if (
    !ext ||
    !meta.width ||
    !meta.height ||
    meta.width * meta.height > MAX_PIXELS
  )
    invalid();
  return { ext: ext!, mime: ext === "jpg" ? "image/jpeg" : `image/${ext}` };
}

/** Upright, metadata-free pixels capped at MAX_EDGE; shared by every output. */
async function decode(input: Buffer) {
  const { data, info } = await sharp(input, { limitInputPixels: MAX_PIXELS })
    .rotate()
    .resize({
      width: MAX_EDGE,
      height: MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    // CMYK and 16-bit inputs would be misread as raw 8-bit RGB(A) without this.
    .toColourspace("srgb")
    .raw({ depth: "uchar" })
    .toBuffer({ resolveWithObject: true })
    .catch(() => invalid());
  const raw = {
    raw: { width: info.width, height: info.height, channels: info.channels },
  } as const;
  return {
    image: () => sharp(data, raw),
    width: info.width,
    height: info.height,
  };
}

async function og(
  decoded: Awaited<ReturnType<typeof decode>>,
  x: number,
  y: number,
) {
  const scale = Math.max(OG.width / decoded.width, OG.height / decoded.height),
    w = Math.max(OG.width, Math.round(decoded.width * scale)),
    h = Math.max(OG.height, Math.round(decoded.height * scale)),
    clamp = (v: number, max: number) => Math.min(Math.max(v, 0), max);
  return decoded
    .image()
    .resize(w, h)
    .extract({
      left: clamp(Math.round(x * w - OG.width / 2), w - OG.width),
      top: clamp(Math.round(y * h - OG.height / 2), h - OG.height),
      width: OG.width,
      height: OG.height,
    })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();
}

export function processImage(input: Buffer, focal = { x: 0.5, y: 0.5 }) {
  return slot(async (): Promise<Processed> => {
    const { ext, mime } = await inspect(input),
      sha = sha256(input),
      decoded = await decode(input),
      widths = [
        ...new Set([
          ...WIDTHS.filter((w) => w < decoded.width),
          Math.min(decoded.width, WIDTHS.at(-1)!),
        ]),
      ],
      files: Processed["files"] = [],
      variants: Variant[] = [];
    const originalKey = `originals/${sha}/original.${ext}`;
    files.push({
      bucket: "originals",
      key: originalKey,
      body: input,
      type: mime,
    });
    for (const width of widths)
      for (const format of ["avif", "webp"] as const) {
        const resized = decoded.image().resize({ width });
        const { data, info } = await (
          format === "avif"
            ? resized.avif({ quality: 50, effort: 2 })
            : resized.webp({ quality: 75 })
        ).toBuffer({ resolveWithObject: true });
        const key = `media/${sha}/w${width}.${format}`;
        files.push({
          bucket: "public",
          key,
          body: data,
          type: `image/${format}`,
        });
        variants.push({
          width,
          height: info.height,
          format,
          key,
          bytes: data.length,
        });
      }
    const ogKey = ogKeyFor(sha, focal.x, focal.y);
    files.push({
      bucket: "public",
      key: ogKey,
      body: await og(decoded, focal.x, focal.y),
      type: "image/jpeg",
    });
    const tiny = await decoded
      .image()
      .resize(16, 16, { fit: "inside" })
      .webp({ quality: 40 })
      .toBuffer();
    return {
      sha256: sha,
      mime,
      bytes: input.length,
      width: decoded.width,
      height: decoded.height,
      originalKey,
      placeholder: "data:image/webp;base64," + tiny.toString("base64"),
      variants,
      ogKey,
      files,
    };
  });
}

/** New share image after the focal point changes; the key encodes the point so caches never go stale. */
export function regenerateOg(
  original: Buffer,
  sha: string,
  x: number,
  y: number,
) {
  return slot(async () => ({
    key: ogKeyFor(sha, x, y),
    body: await og(await decode(original), x, y),
  }));
}
