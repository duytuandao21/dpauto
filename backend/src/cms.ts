import { randomUUID } from "node:crypto";
import type { Config } from "./config";
import { sql, rows, one, json, type Conn, type Row } from "./database";
import {
  audit,
  expectVersion,
  fail,
  hash,
  iso,
  page,
  type Context,
} from "./common";
import type { Visits } from "./visits";

export const pageKeys = [
  "home.hero",
  "home.services",
  "home.pricing",
  "home.cta",
  "about",
  "contact",
  "privacy",
  "terms",
];
export class Cms {
  constructor(
    readonly config: Config,
    readonly visits: Visits,
  ) {}
  validKey(kind: string, key: string) {
    if (kind === "NEWS" && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key))
      fail(422, "CMS_KEY_INVALID");
    if (kind === "PAGE" && !pageKeys.includes(key))
      fail(422, "CMS_KEY_INVALID");
    if (
      kind === "SEO" &&
      !/^(\/|\/(news|services)(\/[a-z0-9]+(?:-[a-z0-9]+)*)?|\/(about|contact|privacy|terms|our-work|chinh-sach-dat-lich))$/.test(
        key,
      )
    )
      fail(422, "CMS_KEY_INVALID");
    if (
      kind === "SEO" &&
      /^\/(admin|api|co-van|dieu-hanh|quanly)(\/|$)/.test(key)
    )
      fail(422, "CMS_KEY_INVALID");
  }
  async documents(c: Conn, ctx: Context, q: Row) {
    const p = await page(
      c,
      this.config,
      ctx,
      sql`SELECT d.*,r.payload->>'title' AS title,d.updated_at AS cursor_key FROM cms_documents d JOIN LATERAL(SELECT payload FROM cms_revisions WHERE document_id=d.id ORDER BY revision_no DESC LIMIT 1) r ON true WHERE d.station_id=${ctx.station.id} ${q.kind ? sql`AND d.kind=${q.kind}` : sql``}`,
      q,
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
      })),
      page: p.page,
    };
  }
  async detail(c: Conn, ctx: Context, id: string) {
    const d = await one(
      c,
      sql`SELECT * FROM cms_documents WHERE id=${id} AND station_id=${ctx.station.id}`,
    );
    if (!d) fail(404, "NOT_FOUND");
    const revisions = await rows(
      c,
      sql`SELECT id,revision_no,payload,created_at FROM cms_revisions WHERE document_id=${id} ORDER BY revision_no DESC LIMIT 101`,
    );
    return {
      id: d.id,
      kind: d.kind,
      key: d.key,
      version: d.version,
      withdrawn: d.withdrawn,
      publishedRevisionId: d.published_revision_id,
      revisions: revisions.slice(0, 100).map((r) => ({
        id: r.id,
        number: r.revision_no,
        payload: r.payload,
        createdAt: iso(r.created_at),
      })),
      hasOlderRevisions: revisions.length > 100,
    };
  }
  async save(c: Conn, ctx: Context, input: Row, id?: string) {
    let d: Row;
    if (id) {
      d = (await one(
        c,
        sql`SELECT * FROM cms_documents WHERE id=${id} AND station_id=${ctx.station.id} FOR UPDATE`,
      ))!;
      if (!d) fail(404, "NOT_FOUND");
      expectVersion(d, input.expectedVersion);
    } else {
      this.validKey(input.kind, input.key);
      d = (await one(
        c,
        sql`INSERT INTO cms_documents(station_id,kind,key,updated_at) VALUES(${ctx.station.id},${input.kind},${input.key},${ctx.now}) RETURNING *`,
      ))!;
    }
    const asset = input.payload.imageId;
    if (
      asset &&
      !(await one(
        c,
        sql`SELECT id FROM cms_assets WHERE id=${asset} AND station_id=${ctx.station.id}`,
      ))
    )
      fail(422, "CMS_ASSET_INVALID");
    if (d.kind === "NEWS" && (!input.payload.date || !asset))
      fail(
        422,
        "CMS_ARTICLE_INCOMPLETE",
        "Bài viết cần ngày đăng và ảnh đại diện.",
      );
    const next = await one(
      c,
      sql`SELECT COALESCE(max(revision_no),0)+1 AS n FROM cms_revisions WHERE document_id=${d.id}`,
    );
    const rev = await one(
      c,
      sql`INSERT INTO cms_revisions(document_id,revision_no,payload,created_at,created_by) VALUES(${d.id},${next!.n},${json(input.payload)},${ctx.now},${ctx.actor!.userId}) RETURNING id`,
    );
    if (asset)
      await c.execute(
        sql`INSERT INTO cms_revision_assets(revision_id,asset_id) VALUES(${rev!.id},${asset})`,
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
      sql`SELECT * FROM cms_documents WHERE id=${id} AND station_id=${ctx.station.id} FOR UPDATE`,
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
    await audit(
      c,
      ctx,
      withdraw ? "CMS_WITHDRAWN" : "CMS_PUBLISHED",
      "cms",
      id,
      `${input.reason}; revision ${d.published_revision_id || "none"} -> ${withdraw ? "none" : input.revisionId}`,
    );
    return { id, version: d.version + 1, eventId: randomUUID() };
  }
  async assets(c: Conn, ctx: Context, q: Row) {
    const p = await page(
      c,
      this.config,
      ctx,
      sql`SELECT id,name,alt,created_at AS cursor_key FROM cms_assets WHERE station_id=${ctx.station.id}`,
      q,
      "cms-assets",
      true,
    );
    return {
      data: p.items.map((a) => ({
        id: a.id,
        name: a.name,
        alt: a.alt,
        createdAt: iso(a.cursor_key),
      })),
      page: p.page,
    };
  }
  async upload(c: Conn, ctx: Context, input: Row) {
    if (!input.dataUrl.startsWith("data:image/jpeg;base64,"))
      fail(422, "INVALID_IMAGE");
    const bytes = await this.visits.photoBytes(input.dataUrl);
    const a = await one(
      c,
      sql`INSERT INTO cms_assets(station_id,created_at,created_by,name,alt,content,sha256) VALUES(${ctx.station.id},${ctx.now},${ctx.actor!.userId},${input.name},${input.alt},${bytes},${hash(bytes.toString("base64"))}) RETURNING id`,
    );
    await audit(c, ctx, "CMS_MEDIA_CREATED", "cms_asset", a!.id);
    return { id: a!.id, version: 1, eventId: randomUUID() };
  }
  async asset(c: Conn, ctx: Context, id: string, isPublic = false) {
    const a = await one(
      c,
      sql`SELECT a.content FROM cms_assets a WHERE a.id=${id} AND a.station_id=${ctx.station.id} ${isPublic ? sql`AND EXISTS(SELECT 1 FROM cms_revision_assets x JOIN cms_documents d ON d.published_revision_id=x.revision_id WHERE x.asset_id=a.id AND d.station_id=${ctx.station.id} AND NOT d.withdrawn)` : sql``}`,
    );
    if (!a) fail(404, "NOT_FOUND");
    return { bytes: a.content };
  }
  async published(c: Conn, ctx: Context) {
    // shortcut: the manifest includes article bodies, split list/detail reads before growing a large content library.
    const data = await rows(
      c,
      sql`SELECT d.kind,d.key,d.withdrawn,d.published_revision_id,r.payload FROM cms_documents d LEFT JOIN cms_revisions r ON r.id=d.published_revision_id WHERE d.station_id=${ctx.station.id} AND (d.published_revision_id IS NOT NULL OR d.withdrawn) ORDER BY d.kind,d.key LIMIT 2001`,
    );
    if (data.length > 2000) fail(503, "CMS_PUBLICATION_LIMIT");
    return {
      items: data.map((d) => ({
        kind: d.kind,
        key: d.key,
        withdrawn: d.withdrawn,
        revisionId: d.published_revision_id,
        payload: d.withdrawn ? null : d.payload,
      })),
      asOf: iso(ctx.now),
    };
  }
}
