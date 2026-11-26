import { builtInKeys } from "./cms-builtin";
import { randomUUID } from "node:crypto";
import type { z } from "zod";
import type { Config } from "./config";
import { sql, rows, one, json, ids, type Conn, type Row } from "./database";
import {
  audit,
  equal,
  expectVersion,
  fail,
  iso,
  mac,
  page,
  parse,
  type Context,
} from "./common";
import {
  pageKeys,
  payloadSchemas,
  seoPath,
  slug,
  vehicleCatalog,
} from "./cms-contracts";
import type { Visits } from "./visits";
import { mediaStore, type MediaStore } from "./media-store";

/** Deletes an asset's files from storage (kept while another live row shares the content hash) and marks the row purged; the row stays for the audit log. */
export async function purgeAsset(
  c: Conn,
  store: MediaStore,
  a: { id: string; sha256: string; storage: string },
) {
  const twin =
    a.storage !== "db" &&
    (await one(
      c,
      sql`SELECT 1 FROM cms_assets WHERE sha256=${a.sha256} AND id<>${a.id} AND purged_at IS NULL AND storage<>'db' LIMIT 1`,
    ));
  if (a.storage !== "db" && !twin) {
    await store.removePrefix("public", `media/${a.sha256}/`);
    await store.removePrefix("originals", `originals/${a.sha256}/`);
  }
  await c.execute(
    sql`UPDATE cms_assets SET purged_at=now() WHERE id=${a.id} AND purged_at IS NULL`,
  );
}
import {
  inspect,
  processImage,
  videoType,
  regenerateOg,
  sha256,
  type Variant,
} from "./image-pipeline";

/** Every cms_assets column except the legacy bytea body. */
export const assetColumns = sql.raw(
  "id,station_id,created_at,created_by,name,alt,sha256,storage,width,height,mime,bytes,original_key,variants,og_key,placeholder,focal_x,focal_y,deleted_at,deleted_by,purged_at",
);

/** Asset ids referenced anywhere in a payload: image fields, legacy imageId and rich-text images. */
export function assetIds(value: unknown, found = new Set<string>()) {
  if (Array.isArray(value)) for (const v of value) assetIds(v, found);
  else if (value && typeof value === "object")
    for (const [k, v] of Object.entries(value)) {
      if ((k === "assetId" || k === "imageId") && typeof v === "string")
        found.add(v);
      else assetIds(v, found);
    }
  return found;
}
const listKinds = ["SERVICE", "NEWS", "ACCESSORY", "PROJECT"];
/** No version history is kept: drops every revision of a document except `keep`. */
async function prune(c: Conn, documentId: string, keep: string[]) {
  const others = sql`SELECT id FROM cms_revisions WHERE document_id=${documentId} AND NOT (id = ANY(${ids(keep)}))`;
  await c.execute(
    sql`DELETE FROM cms_revision_assets WHERE revision_id IN (${others})`,
  );
  await c.execute(
    sql`DELETE FROM cms_revisions WHERE document_id=${documentId} AND NOT (id = ANY(${ids(keep)}))`,
  );
}
const latest = sql`JOIN LATERAL(SELECT id,payload FROM cms_revisions WHERE document_id=d.id ORDER BY revision_no DESC LIMIT 1) r ON true`;
const titleOf = sql`COALESCE(r.payload->>'title',r.payload->>'name',d.key)`;
const PREVIEW_MS = 30 * 60 * 1000;
export class Cms {
  constructor(
    readonly config: Config,
    readonly visits: Visits,
  ) {
    this.store = mediaStore(config.media);
  }
  readonly store: MediaStore;
  validKey(kind: string, key: string) {
    const ok =
      kind === "PAGE"
        ? pageKeys.includes(key)
        : kind === "SETTINGS"
          ? key === "site"
          : kind === "NAVIGATION"
            ? key === "main"
            : kind === "SEO"
              ? seoPath.test(key)
              : kind === "CATALOG"
                ? key === "accessories" || key === "vehicles"
              : slug.test(key) && key.length <= 120;
    if (!ok) fail(422, "CMS_KEY_INVALID");
  }
  async documents(c: Conn, ctx: Context, q: Row) {
    const search = q.search
      ? "%" + q.search.replace(/[\\%_]/g, (m: string) => "\\" + m) + "%"
      : "";
    const p = await page(
      c,
      this.config,
      ctx,
      sql`SELECT d.*,${titleOf} AS title,r.id AS latest_revision_id,(r.payload->>'hidden')='true' AS hidden,jsonb_strip_nulls(jsonb_build_object('image',COALESCE(r.payload->'image'->>'src',r.payload->'images'->0->>'src',r.payload->'after'->>'src',r.payload->'logo'->>'src'),'imageId',r.payload->>'imageId','order',r.payload->'order','category',r.payload->>'category','brand',r.payload->>'brand','price',r.payload->'price','date',r.payload->>'date','publishAt',r.payload->>'publishAt','vehicle',r.payload->>'vehicle','featured',r.payload->'featured','description',left(r.payload->>'description',200),'slug',r.payload->>'slug','shortcutImage',r.payload->'shortcutImage'->>'src','shortcutIcon',r.payload->>'shortcutIcon')) AS summary,d.updated_at AS cursor_key FROM cms_documents d LEFT ${latest} WHERE d.station_id=${ctx.station.id} ${q.kind ? sql`AND d.kind=${q.kind}` : sql``} ${q.key ? sql`AND d.key=${q.key}` : sql``} ${search ? sql`AND (d.key ILIKE ${search} OR ${titleOf} ILIKE ${search})` : sql``}`,
      { ...q, search: q.search || undefined },
      "cms-documents",
      true,
    );
    return {
      data: p.items.map((d) => ({
        id: d.id,
        kind: d.kind,
        key: d.key,
        title: d.title,
        version: d.version,
        updatedAt: iso(d.updated_at),
        publishedRevisionId: d.published_revision_id,
        withdrawn: d.withdrawn,
        deleted: !!d.deleted_at,
        hidden: !!d.hidden,
        hasDraft: d.latest_revision_id !== d.published_revision_id,
        summary: d.summary,
      })),
      page: p.page,
    };
  }
  async detail(c: Conn, ctx: Context, id: string) {
    const d = await one(
      c,
      sql`SELECT * FROM cms_documents WHERE id=${id} AND station_id=${ctx.station.id} AND deleted_at IS NULL`,
    );
    if (!d) fail(404, "NOT_FOUND");
    const revisions = await rows(
      c,
      sql`SELECT r.id,r.revision_no,r.payload,r.created_at,s.name AS author FROM cms_revisions r LEFT JOIN staff_profiles s ON s.user_id=r.created_by WHERE r.document_id=${id} ORDER BY r.revision_no DESC LIMIT 101`,
    );
    return {
      id: d.id,
      kind: d.kind,
      key: d.key,
      version: d.version,
      withdrawn: d.withdrawn,
      updatedAt: iso(d.updated_at),
      publishedRevisionId: d.published_revision_id,
      revisions: revisions.slice(0, 100).map((r) => ({
        id: r.id,
        number: r.revision_no,
        payload: r.payload,
        createdAt: iso(r.created_at),
        author: r.author || null,
      })),
      hasOlderRevisions: revisions.length > 100,
    };
  }
  async save(c: Conn, ctx: Context, input: Row, id?: string) {
    let d: Row;
    if (id) {
      d = (await one(
        c,
        sql`SELECT * FROM cms_documents WHERE id=${id} AND station_id=${ctx.station.id} AND deleted_at IS NULL FOR UPDATE`,
      ))!;
      if (!d) fail(404, "NOT_FOUND");
      expectVersion(d, input.expectedVersion);
    } else {
      this.validKey(input.kind, input.key);
      const builtIn = builtInKeys[input.kind];
      if (builtIn) {
        const reserved = builtIn.includes(input.key);
        if (reserved && !input.builtIn)
          fail(409, "CMS_KEY_TAKEN", "Đường dẫn này đã được dùng.");
        if (!reserved && input.builtIn) fail(422, "CMS_KEY_INVALID");
      }
      const existing = await one(
        c,
        sql`SELECT * FROM cms_documents WHERE station_id=${ctx.station.id} AND kind=${input.kind} AND key=${input.key} FOR UPDATE`,
      );
      // A deleted built-in keeps its key so its default stays hidden; saving it again brings it back.
      if (existing && !(existing.deleted_at && input.builtIn))
        fail(409, "CMS_KEY_TAKEN", "Đường dẫn này đã được dùng.");
      d = (await one(
        c,
        existing
          ? sql`UPDATE cms_documents SET deleted_at=NULL,withdrawn=false,published_revision_id=NULL,version=version+1,updated_at=${ctx.now} WHERE id=${existing.id} RETURNING *`
          : sql`INSERT INTO cms_documents(station_id,kind,key,updated_at) VALUES(${ctx.station.id},${input.kind},${input.key},${ctx.now}) RETURNING *`,
      ))!;
    }
    const schema: z.ZodType<Row> =
      d.kind === "CATALOG" && d.key === "vehicles"
        ? vehicleCatalog
        : payloadSchemas[d.kind as keyof typeof payloadSchemas];
    const payload = parse(schema, input.payload);
    if (
      d.kind === "NEWS" &&
      (!payload.date || !(payload.imageId || payload.image?.src))
    )
      fail(
        422,
        "CMS_ARTICLE_INCOMPLETE",
        "Bài viết cần ngày đăng và ảnh đại diện.",
      );
    if (d.kind === "SERVICE" && payload.slug) {
      // URLs resolve by slug first, then by key, so neither may belong to another service.
      const clash =
        (payload.slug !== d.key &&
          builtInKeys.SERVICE?.includes(payload.slug)) ||
        (await one(
          c,
          sql`SELECT 1 FROM cms_documents d ${latest} WHERE d.station_id=${ctx.station.id} AND d.kind='SERVICE' AND d.deleted_at IS NULL AND d.id<>${d.id} AND (d.key=${payload.slug} OR r.payload->>'slug'=${payload.slug})`,
        ));
      if (clash)
        fail(409, "CMS_SLUG_TAKEN", "Đường dẫn này đã được dùng cho dịch vụ khác.");
    }
    const refs = [...assetIds(payload)];
    const present = refs.length
      ? new Set(
          (
            await rows(
              c,
              sql`SELECT id FROM cms_assets WHERE station_id=${ctx.station.id} AND id = ANY(${ids(refs)}) AND deleted_at IS NULL AND purged_at IS NULL`,
            )
          ).map((a) => a.id as string),
        )
      : new Set<string>();
    const missing = refs.filter((id) => !present.has(id));
    if (missing.length) {
      // Name the images so the admin knows which field to re-pick.
      const names = new Set<string>();
      JSON.stringify(payload, (_k, v) => {
        const id = v && typeof v === "object" ? (v.assetId ?? v.imageId) : undefined;
        if (missing.includes(id))
          names.add(
            String(v.alt || v.name || v.src || `ảnh cũ (mã ${id.slice(0, 8)})`).slice(0, 60),
          );
        return v;
      });
      fail(
        422,
        "CMS_ASSET_INVALID",
        `Có ảnh không còn trong thư viện: ${[...names].join(", ")}. Hãy chọn lại ảnh khác.`,
      );
    }
    const next = await one(
      c,
      sql`SELECT COALESCE(max(revision_no),0)+1 AS n FROM cms_revisions WHERE document_id=${d.id}`,
    );
    const rev = await one(
      c,
      sql`INSERT INTO cms_revisions(document_id,revision_no,payload,created_at,created_by) VALUES(${d.id},${next!.n},${json(payload)},${ctx.now},${ctx.actor!.userId}) RETURNING id`,
    );
    for (const asset of refs)
      await c.execute(
        sql`INSERT INTO cms_revision_assets(revision_id,asset_id) VALUES(${rev!.id},${asset})`,
      );
    // Only the live revision and this newest draft remain.
    await prune(
      c,
      d.id,
      [rev!.id, d.published_revision_id].filter(Boolean),
    );
    if (id)
      await c.execute(
        sql`UPDATE cms_documents SET version=version+1,updated_at=${ctx.now} WHERE id=${id}`,
      );
    await audit(c, ctx, "CMS_DRAFT_SAVED", "cms", d.id, `Revision ${rev!.id}`);
    return {
      id: d.id,
      version: d.version + (id ? 1 : 0),
      revisionId: rev!.id,
      eventId: randomUUID(),
    };
  }
  async publish(
    c: Conn,
    ctx: Context,
    id: string,
    input: Row,
    withdraw = false,
  ) {
    const d = await one(
      c,
      sql`SELECT * FROM cms_documents WHERE id=${id} AND station_id=${ctx.station.id} AND deleted_at IS NULL FOR UPDATE`,
    );
    if (!d) fail(404, "NOT_FOUND");
    expectVersion(d, input.expectedVersion);
    if (
      !withdraw &&
      !(await one(
        c,
        sql`SELECT id FROM cms_revisions WHERE id=${input.revisionId} AND document_id=${id}`,
      ))
    )
      fail(422, "CMS_REVISION_INVALID");
    await c.execute(
      sql`UPDATE cms_documents SET published_revision_id=${withdraw ? null : input.revisionId}::uuid,withdrawn=${withdraw},version=version+1,updated_at=${ctx.now} WHERE id=${id}`,
    );
    if (!withdraw) await prune(c, id, [input.revisionId]);
    if (d.kind === "SERVICE") {
      const rev = withdraw
        ? null
        : await one(
            c,
            sql`SELECT payload FROM cms_revisions WHERE id=${input.revisionId}`,
          );
      await this.syncService(c, ctx, d.key, rev?.payload ?? null);
    }
    if (withdraw) {
      // Removing an item also deletes every image any of its revisions used, unless other content still uses it.
      const own = await rows(
        c,
        sql`SELECT DISTINCT a.id,a.sha256,a.storage FROM cms_assets a JOIN cms_revision_assets x ON x.asset_id=a.id JOIN cms_revisions r ON r.id=x.revision_id WHERE r.document_id=${id} AND a.station_id=${ctx.station.id} AND a.purged_at IS NULL`,
      );
      for (const a of own)
        if (!(await this.usage(c, ctx, a.id)).data.some((u) => u.id !== id))
          await this.destroyAsset(c, ctx, a as never);
      // List items leave the admin too. A built-in key stays so its default stays hidden;
      // any other key is renamed so the slug can be used again.
      if (listKinds.includes(d.kind)) {
        await c.execute(
          sql`UPDATE cms_documents SET deleted_at=${ctx.now},key=${builtInKeys[d.kind]?.includes(d.key) ? d.key : `${d.key.slice(0, 150)}--deleted-${id.slice(0, 8)}`} WHERE id=${id}`,
        );
        await prune(c, id, []);
      } else {
        // Hidden sections keep only their newest content so the admin form can bring it back.
        const last = await one(
          c,
          sql`SELECT id FROM cms_revisions WHERE document_id=${id} ORDER BY revision_no DESC LIMIT 1`,
        );
        await prune(c, id, last ? [last.id] : []);
      }
    }
    await audit(
      c,
      ctx,
      withdraw ? "CMS_WITHDRAWN" : "CMS_PUBLISHED",
      "cms",
      id,
      `${input.reason || (withdraw ? "Gỡ từ trang quản trị" : "Xuất bản từ trang quản trị")}; revision ${d.published_revision_id || "none"} -> ${withdraw ? "none" : input.revisionId}`,
    );
    return { id, version: d.version + 1, eventId: randomUUID() };
  }
  /**
   * Website services are the operations catalogue: each visible published SERVICE has one
   * bookable operations service (marketing_slug = its key) used by booking, /co-van and /dieu-hanh.
   */
  async syncService(c: Conn, ctx: Context, key: string, payload: Row | null) {
    const visible = !!payload?.title && !payload.hidden;
    const s = await one(
      c,
      sql`SELECT * FROM services WHERE marketing_slug=${key} FOR UPDATE`,
    );
    if (!s && !visible) return;
    const minutes =
      payload?.durationMinutes ?? s?.estimated_duration_minutes ?? 60;
    const name = visible ? String(payload!.title).slice(0, 120) : s!.name;
    const description = visible ? payload!.description || null : s!.description;
    const order = Math.max(0, payload?.order ?? s?.sort_order ?? 0);
    if (s)
      await c.execute(
        sql`UPDATE services SET name=${name},description=${description},active=${visible},bookable=${visible},sort_order=${order},estimated_duration_minutes=${minutes},plan_revision=plan_revision+${minutes === s.estimated_duration_minutes ? 0 : 1},version=version+1,updated_at=${ctx.now} WHERE id=${s.id}`,
      );
    else
      await c.execute(
        sql`INSERT INTO services(code,name,category_id,active,bookable,sort_order,description,marketing_slug,estimated_duration_minutes)
          SELECT ${"WEB_" + key.toUpperCase().replace(/[^A-Z0-9]+/g, "_").slice(0, 60)},${name},id,true,true,${order},${description},${key},${minutes}
          FROM service_categories WHERE code='OTHER'`,
      );
    await c.execute(
      sql`UPDATE stations SET catalog_version=catalog_version+1 WHERE id=${ctx.station.id}`,
    );
  }
  /** Drops the override entirely so the website and the admin form show the built-in default again. */
  async revert(c: Conn, ctx: Context, id: string, input: Row) {
    const d = await one(
      c,
      sql`SELECT * FROM cms_documents WHERE id=${id} AND station_id=${ctx.station.id} AND deleted_at IS NULL FOR UPDATE`,
    );
    if (!d) fail(404, "NOT_FOUND");
    expectVersion(d, input.expectedVersion);
    await c.execute(
      sql`UPDATE cms_documents SET published_revision_id=NULL WHERE id=${id}`,
    );
    await prune(c, id, []);
    await c.execute(sql`DELETE FROM cms_documents WHERE id=${id}`);
    await audit(
      c,
      ctx,
      "CMS_REVERTED",
      "cms",
      id,
      input.reason || "Khôi phục nội dung mặc định",
    );
    return { id, version: d.version + 1, eventId: randomUUID() };
  }
  async overview(c: Conn, ctx: Context) {
    const station = ctx.station.id,
      draft = sql`d.published_revision_id IS DISTINCT FROM r.id AND NOT d.withdrawn`;
    const [kinds, drafts, scheduled, media, months, recent] = await Promise.all(
      [
        rows(
          c,
          sql`SELECT d.kind,count(*)::int AS total,count(*) FILTER (WHERE d.published_revision_id IS NOT NULL AND NOT d.withdrawn)::int AS live,count(*) FILTER (WHERE ${draft})::int AS drafts FROM cms_documents d ${latest} WHERE d.station_id=${station} AND d.deleted_at IS NULL GROUP BY d.kind`,
        ),
        rows(
          c,
          sql`SELECT d.id,d.kind,d.key,${titleOf} AS title,d.updated_at FROM cms_documents d ${latest} WHERE d.station_id=${station} AND d.deleted_at IS NULL AND ${draft} ORDER BY d.updated_at DESC LIMIT 8`,
        ),
        rows(
          c,
          sql`SELECT d.id,d.key,p.payload->>'title' AS title,p.payload->>'publishAt' AS publish_at FROM cms_documents d JOIN cms_revisions p ON p.id=d.published_revision_id WHERE d.station_id=${station} AND d.kind='NEWS' AND NOT d.withdrawn AND (p.payload->>'publishAt')::timestamptz > ${ctx.now} ORDER BY (p.payload->>'publishAt')::timestamptz LIMIT 10`,
        ),
        one(
          c,
          sql`SELECT count(*) FILTER (WHERE deleted_at IS NULL)::int AS count,COALESCE(sum(COALESCE(bytes,octet_length(content))) FILTER (WHERE deleted_at IS NULL),0)::bigint AS bytes,count(*) FILTER (WHERE deleted_at IS NOT NULL)::int AS trash FROM cms_assets WHERE station_id=${station} AND purged_at IS NULL`,
        ),
        rows(
          c,
          sql`SELECT to_char(date_trunc('month',a.occurred_at AT TIME ZONE 'Asia/Ho_Chi_Minh'),'YYYY-MM') AS month,count(*) FILTER (WHERE a.action='CMS_PUBLISHED')::int AS published,count(*) FILTER (WHERE a.action='CMS_DRAFT_SAVED')::int AS saved,count(*) FILTER (WHERE a.action='CMS_MEDIA_CREATED')::int AS uploaded FROM audit_logs a JOIN staff_profiles s ON s.user_id=a.actor_user_id AND s.station_id=${station} WHERE a.action LIKE 'CMS%' AND a.occurred_at > ${new Date(+ctx.now - 366 * 86400000)} GROUP BY 1 ORDER BY 1`,
        ),
        this.activity(c, ctx, { limit: 10 }),
      ],
    );
    return {
      kinds: Object.fromEntries(
        kinds.map((k) => [
          k.kind,
          { total: k.total, live: k.live, drafts: k.drafts },
        ]),
      ),
      drafts: drafts.map((d) => ({
        id: d.id,
        kind: d.kind,
        key: d.key,
        title: d.title,
        updatedAt: iso(d.updated_at),
      })),
      scheduled: scheduled.map((s) => ({
        id: s.id,
        key: s.key,
        title: s.title,
        publishAt: iso(new Date(s.publish_at)),
      })),
      media: {
        count: media!.count,
        bytes: Number(media!.bytes),
        trash: media!.trash,
      },
      months,
      recent: recent.data,
    };
  }
  async activity(c: Conn, ctx: Context, q: Row) {
    const p = await page(
      c,
      this.config,
      ctx,
      sql`SELECT a.id,a.action,a.entity_type,a.entity_id,a.reason,a.occurred_at,s.name AS actor,d.kind AS doc_kind,d.key AS doc_key,COALESCE(rr.payload->>'title',rr.payload->>'name') AS doc_title,ca.name AS asset_name,a.occurred_at AS cursor_key FROM audit_logs a JOIN staff_profiles s ON s.user_id=a.actor_user_id AND s.station_id=${ctx.station.id} LEFT JOIN cms_documents d ON a.entity_type='cms' AND d.id=a.entity_id LEFT JOIN LATERAL(SELECT payload FROM cms_revisions WHERE document_id=d.id ORDER BY revision_no DESC LIMIT 1) rr ON true LEFT JOIN cms_assets ca ON a.entity_type='cms_asset' AND ca.id=a.entity_id WHERE a.action LIKE 'CMS%'`,
      q,
      "cms-activity",
      true,
    );
    return {
      data: p.items.map((a) => ({
        id: a.id,
        action: a.action,
        actor: a.actor,
        at: iso(a.occurred_at),
        reason: a.reason,
        target:
          a.entity_type === "cms_asset"
            ? { type: "asset", id: a.entity_id, title: a.asset_name }
            : {
                type: "document",
                id: a.entity_id,
                kind: a.doc_kind,
                key: a.doc_key,
                title: a.doc_title || a.doc_key,
              },
      })),
      page: p.page,
    };
  }
  /** Short-lived signed token that lets the website render the latest drafts. */
  previewToken(ctx: Context) {
    const body = Buffer.from(
      JSON.stringify({ s: ctx.station.id, e: +ctx.now + PREVIEW_MS }),
    ).toString("base64url");
    return {
      token: `${body}.${mac(this.config.secret, "cms-preview:" + body)}`,
      expiresAt: iso(new Date(+ctx.now + PREVIEW_MS)),
    };
  }
  previewAllowed(ctx: Context, token: string) {
    const [body, sig] = token.split(".");
    if (
      !body ||
      !sig ||
      !equal(sig, mac(this.config.secret, "cms-preview:" + body))
    )
      fail(403, "PREVIEW_INVALID");
    const t = JSON.parse(Buffer.from(body, "base64url").toString());
    if (t.s !== ctx.station.id || !(t.e > +ctx.now))
      fail(403, "PREVIEW_EXPIRED", "Link xem trước đã hết hạn.");
  }
  view(a: Row, isPublic = false) {
    const variants = (a.variants || []) as Variant[],
      list = (format: Variant["format"]) =>
        variants
          .filter((v) => v.format === format)
          .map((v) => ({ width: v.width, url: this.store.url(v.key) })),
      webp = list("webp"),
      video = String(a.mime || "").startsWith("video/");
    return {
      id: a.id,
      kind: video ? "video" : "image",
      name: a.name,
      alt: a.alt,
      createdAt: iso(a.created_at),
      deletedAt: a.deleted_at ? iso(a.deleted_at) : null,
      width: a.width ?? null,
      height: a.height ?? null,
      bytes: a.bytes ?? null,
      mime: a.mime || "image/jpeg",
      focal: { x: Number(a.focal_x ?? 0.5), y: Number(a.focal_y ?? 0.5) },
      placeholder: a.placeholder || null,
      // Rows still stored in Postgres keep their original endpoint until `media migrate` runs.
      src: video
        ? this.store.url(a.original_key)
        : webp.at(-1)?.url ||
        `/api/v1/${isPublic ? "public" : "admin"}/cms/assets/${a.id}`,
      avif: list("avif"),
      webp,
      og: a.og_key ? this.store.url(a.og_key) : null,
    };
  }
  async assets(c: Conn, ctx: Context, q: Row) {
    const search = q.search
      ? "%" + q.search.replace(/[\\%_]/g, (m: string) => "\\" + m) + "%"
      : "";
    const p = await page(
      c,
      this.config,
      ctx,
      sql`SELECT ${assetColumns},created_at AS cursor_key FROM cms_assets WHERE station_id=${ctx.station.id} AND purged_at IS NULL AND ${q.trash ? sql`deleted_at IS NOT NULL` : sql`deleted_at IS NULL`} ${search ? sql`AND (name ILIKE ${search} OR alt ILIKE ${search})` : sql``} ${q.type === "video" ? sql`AND mime LIKE 'video/%'` : q.type === "image" ? sql`AND (mime IS NULL OR mime NOT LIKE 'video/%')` : sql``}`,
      q,
      "cms-assets",
      true,
    );
    return { data: p.items.map((a) => this.view(a)), page: p.page };
  }
  /** Runs before the transaction: CPU and storage work must not hold the station lock. */
  async prepareUpload(c: Conn, ctx: Context, body: unknown) {
    if (!Buffer.isBuffer(body)) fail(415, "IMAGE_REQUIRED");
    const video = videoType(body);
    if (!video) await inspect(body);
    const sha = sha256(body);
    if (
      await one(
        c,
        sql`SELECT id FROM cms_assets WHERE station_id=${ctx.station.id} AND sha256=${sha} AND storage<>'db' AND purged_at IS NULL LIMIT 1`,
      )
    )
      return { sha256: sha };
    if (video) {
      // Videos are stored as uploaded (no transcoding) and served straight from the public bucket.
      const key = `media/${sha}/video.${video.ext}`;
      await this.store.put("public", key, body, video.mime);
      return {
        sha256: sha,
        mime: video.mime,
        bytes: body.length,
        width: null,
        height: null,
        originalKey: key,
        variants: [],
        ogKey: null,
        placeholder: null,
      };
    }
    const { files, ...processed } = await processImage(body);
    await Promise.all(
      files.map((f) => this.store.put(f.bucket, f.key, f.body, f.type)),
    );
    return processed;
  }
  async upload(c: Conn, ctx: Context, input: Row, prepared: Row) {
    const found = await one(
      c,
      sql`SELECT id,deleted_at FROM cms_assets WHERE station_id=${ctx.station.id} AND sha256=${input.sha256} AND storage<>'db' AND purged_at IS NULL ORDER BY created_at,id LIMIT 1 FOR UPDATE`,
    );
    if (found) {
      if (found.deleted_at) {
        await c.execute(
          sql`UPDATE cms_assets SET deleted_at=NULL,deleted_by=NULL WHERE id=${found.id}`,
        );
        await audit(c, ctx, "CMS_MEDIA_RESTORED", "cms_asset", found.id);
      }
      return {
        id: found.id,
        version: 1,
        duplicate: true,
        eventId: randomUUID(),
      };
    }
    // The twin image was purged between preparation and commit; the client simply retries.
    if (!prepared.variants) fail(409, "REQUEST_IN_PROGRESS");
    const a = await one(
      c,
      sql`INSERT INTO cms_assets(station_id,created_at,created_by,name,alt,sha256,storage,width,height,mime,bytes,original_key,variants,og_key,placeholder) VALUES(${ctx.station.id},${ctx.now},${ctx.actor!.userId},${input.name},${input.alt},${prepared.sha256},${this.store.driver},${prepared.width},${prepared.height},${prepared.mime},${prepared.bytes},${prepared.originalKey},${json(prepared.variants)},${prepared.ogKey},${prepared.placeholder}) RETURNING id`,
    );
    await audit(c, ctx, "CMS_MEDIA_CREATED", "cms_asset", a!.id);
    return { id: a!.id, version: 1, duplicate: false, eventId: randomUUID() };
  }
  async asset(c: Conn, ctx: Context, id: string, isPublic = false) {
    const a = await one(
      c,
      sql`SELECT a.storage,a.content,a.variants,a.mime,a.original_key FROM cms_assets a WHERE a.id=${id} AND a.station_id=${ctx.station.id} AND a.purged_at IS NULL ${isPublic ? sql`AND a.deleted_at IS NULL AND EXISTS(SELECT 1 FROM cms_revision_assets x JOIN cms_documents d ON d.published_revision_id=x.revision_id WHERE x.asset_id=a.id AND d.station_id=${ctx.station.id} AND NOT d.withdrawn)` : sql``}`,
    );
    if (!a) fail(404, "NOT_FOUND");
    if (a.storage === "db") return { bytes: a.content };
    if (String(a.mime).startsWith("video/"))
      return { redirect: this.store.url(a.original_key) };
    const webp = (a.variants as Variant[]).filter((v) => v.format === "webp");
    return { redirect: this.store.url(webp.at(-1)!.key) };
  }
  /** Runs before the transaction: a new focal point needs a freshly cropped share image. */
  async prepareUpdate(c: Conn, ctx: Context, id: string, input: Row) {
    if (input.focalX === undefined) return undefined;
    const a = await one(
      c,
      sql`SELECT storage,sha256,original_key,mime FROM cms_assets WHERE id=${id} AND station_id=${ctx.station.id} AND purged_at IS NULL`,
    );
    if (!a) fail(404, "NOT_FOUND");
    // Videos have no share image to re-crop.
    if (a.storage === "db" || String(a.mime).startsWith("video/")) return undefined;
    const og = await regenerateOg(
      await this.store.get("originals", a.original_key),
      a.sha256,
      input.focalX,
      input.focalY,
    );
    await this.store.put("public", og.key, og.body, "image/jpeg");
    return { ogKey: og.key };
  }
  async updateAsset(
    c: Conn,
    ctx: Context,
    id: string,
    input: Row,
    prepared?: Row,
  ) {
    const a = await one(
      c,
      sql`SELECT ${assetColumns} FROM cms_assets WHERE id=${id} AND station_id=${ctx.station.id} AND purged_at IS NULL FOR UPDATE`,
    );
    if (!a) fail(404, "NOT_FOUND");
    await c.execute(
      sql`UPDATE cms_assets SET name=${input.name ?? a.name},alt=${input.alt ?? a.alt},focal_x=${input.focalX ?? a.focal_x},focal_y=${input.focalY ?? a.focal_y},og_key=${prepared?.ogKey ?? a.og_key} WHERE id=${id}`,
    );
    await audit(c, ctx, "CMS_MEDIA_UPDATED", "cms_asset", id);
    return { id, version: 1, eventId: randomUUID() };
  }
  /** Documents whose latest draft or live revision shows the image. */
  async usage(c: Conn, ctx: Context, id: string) {
    const data = await rows(
      c,
      sql`SELECT d.id,d.kind,d.key,r.payload->>'title' AS title,bool_or(x.revision_id=d.published_revision_id AND NOT d.withdrawn) AS live FROM cms_documents d JOIN LATERAL(SELECT id,payload FROM cms_revisions WHERE document_id=d.id ORDER BY revision_no DESC LIMIT 1) r ON true JOIN cms_revision_assets x ON x.asset_id=${id} AND (x.revision_id=r.id OR (x.revision_id=d.published_revision_id AND NOT d.withdrawn)) WHERE d.station_id=${ctx.station.id} GROUP BY d.id,d.kind,d.key,r.payload ORDER BY d.kind,d.key`,
    );
    return {
      data: data.map((d) => ({
        id: d.id,
        kind: d.kind,
        key: d.key,
        title: d.title,
        live: !!d.live,
      })),
    };
  }
  /** Permanent delete: files leave storage (R2) right away. */
  private async destroyAsset(
    c: Conn,
    ctx: Context,
    a: { id: string; sha256: string; storage: string },
  ) {
    await c.execute(
      sql`UPDATE cms_assets SET deleted_at=COALESCE(deleted_at,${ctx.now}),deleted_by=COALESCE(deleted_by,${ctx.actor!.userId}) WHERE id=${a.id}`,
    );
    await purgeAsset(c, this.store, a);
    await audit(c, ctx, "CMS_MEDIA_DELETED", "cms_asset", a.id);
  }
  async removeAsset(c: Conn, ctx: Context, id: string, restore = false) {
    const a = await one(
      c,
      sql`SELECT id,sha256,storage,deleted_at,purged_at FROM cms_assets WHERE id=${id} AND station_id=${ctx.station.id} FOR UPDATE`,
    );
    if (!a) fail(404, "NOT_FOUND");
    if (a.purged_at)
      fail(409, "CMS_ASSET_PURGED", "Ảnh đã bị xóa vĩnh viễn khỏi thư viện.");
    if (restore) {
      await c.execute(
        sql`UPDATE cms_assets SET deleted_at=NULL,deleted_by=NULL WHERE id=${id}`,
      );
      await audit(c, ctx, "CMS_MEDIA_RESTORED", "cms_asset", id);
      return { id, version: 1, eventId: randomUUID() };
    }
    await this.destroyAsset(c, ctx, a as never);
    return { id, version: 1, eventId: randomUUID() };
  }
  /** Live website feed; with a valid preview token, the latest revision of every document instead. */
  async published(c: Conn, ctx: Context, previewToken?: string) {
    if (previewToken) this.previewAllowed(ctx, previewToken);
    // shortcut: the manifest includes article bodies, split list/detail reads before growing a large content library.
    const data = await rows(
      c,
      previewToken
        ? sql`SELECT d.kind,d.key,false AS withdrawn,r.id AS published_revision_id,r.payload FROM cms_documents d ${latest} WHERE d.station_id=${ctx.station.id} AND NOT d.withdrawn ORDER BY d.kind,d.key LIMIT 2001`
        : sql`SELECT d.kind,d.key,d.withdrawn,d.published_revision_id,r.payload FROM cms_documents d LEFT JOIN cms_revisions r ON r.id=d.published_revision_id WHERE d.station_id=${ctx.station.id} AND (d.published_revision_id IS NOT NULL OR d.withdrawn) ORDER BY d.kind,d.key LIMIT 2001`,
    );
    if (data.length > 2000) fail(503, "CMS_PUBLICATION_LIMIT");
    const live = data.filter(
      (d) =>
        !d.withdrawn &&
        d.payload &&
        // Scheduled articles stay off the live site until their time; previews show them.
        (previewToken ||
          d.kind !== "NEWS" ||
          !d.payload.publishAt ||
          new Date(d.payload.publishAt) <= ctx.now),
    );
    const refs = [...assetIds(live.map((d) => d.payload))];
    const images = new Map(
      (refs.length
        ? await rows(
            c,
            sql`SELECT ${assetColumns} FROM cms_assets WHERE station_id=${ctx.station.id} AND purged_at IS NULL AND id = ANY(${ids(refs)})`,
          )
        : []
      ).map((a) => [a.id, this.view(a, true)]),
    );
    return {
      items: data
        .filter((d) => d.withdrawn || live.includes(d))
        .map((d) => ({
          kind: d.kind,
          key: d.key,
          withdrawn: d.withdrawn,
          revisionId: d.published_revision_id,
          payload: d.withdrawn
            ? null
            : d.payload.imageId
              ? images.has(d.payload.imageId)
                ? { ...d.payload, image: images.get(d.payload.imageId) }
                : // A deleted image drops out so the website falls back to its default picture.
                  // shortcut: only the main imageId is dropped; images inside article bodies/galleries stay as broken links until re-edited.
                  { ...d.payload, imageId: undefined }
              : d.payload,
        })),
      assets: Object.fromEntries(images),
      preview: !!previewToken,
      asOf: iso(ctx.now),
    };
  }
}
