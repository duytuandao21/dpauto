"use client";
import Image from "next/image";
import { useEffect, useState, type FormEvent } from "react";
import { apiEnabled, collection, command, request } from "@/lib/api/client";
import { useApiPage } from "@/lib/api/use-page";
import { useSession } from "@/components/admin/auth-gate";
import { AdminLoading, PageHeading } from "@/components/admin/primitives";
import { prepareIntakePhoto } from "@/components/advisor/visit-intake-fields";
import { CmsBlocks } from "@/components/sections/cms-blocks";
import {
  cmsPages,
  blocksToText,
  textToBlocks,
  type CmsKind,
  type CmsPayload,
  type CmsDocument,
  type CmsDetail,
  type CmsAsset,
} from "@/lib/api/cms";
import { stationToday } from "@/lib/api/operations";
import { workflowTime } from "@/lib/api/workflow";
import { ManagerPanel, ManagerTable } from "./manager-ui";
import { PageButtons } from "./live-stock";

const kinds = { content: "PAGE", news: "NEWS", seo: "SEO" } as const;
const titles = {
  content: "Nội dung website",
  news: "Bài viết",
  media: "Thư viện hình ảnh",
  seo: "SEO & hiển thị",
};
export function LiveCms({
  kind = "content",
}: {
  kind?: "content" | "news" | "media" | "seo";
}) {
  const session = useSession(),
    [reload, setReload] = useState(0),
    [editing, setEditing] = useState<CmsDetail | null>(null),
    [creating, setCreating] = useState(false),
    [assets, setAssets] = useState<CmsAsset[]>([]),
    [error, setError] = useState("");
  const p = useApiPage<CmsDocument>(
    `admin/cms/documents?kind=${kind === "media" ? "PAGE" : kinds[kind]}`,
    reload,
  );
  useEffect(() => {
    const a = new AbortController();
    if (!session?.permissions.includes("cms.read")) return;
    collection<CmsAsset>("admin/cms/assets", a.signal)
      .then(setAssets)
      .catch((e) => {
        if (!a.signal.aborted) setError(e.message);
      });
    return () => a.abort();
  }, [reload, session]);
  async function open(id: string) {
    setError("");
    try {
      setEditing((await request<CmsDetail>("admin/cms/documents/" + id)).data);
      setCreating(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tải nội dung.");
    }
  }
  if (!apiEnabled)
    return <p>Chức năng quản trị nội dung cần kết nối hệ thống.</p>;
  if (!session?.permissions.includes("cms.read"))
    return (
      <div className="adv-stack">
        <PageHeading title={titles[kind]} />
        <ManagerPanel title="Quyền truy cập">
          <p>Bạn chưa được cấp quyền quản trị nội dung.</p>
        </ManagerPanel>
      </div>
    );
  const write = session.permissions.includes("cms.write");
  return (
    <div className="adv-stack">
      <PageHeading
        title={titles[kind]}
        description={
          kind === "media"
            ? "Ảnh dùng cho nội dung website."
            : "Biên tập bản nháp và xuất bản phiên bản được duyệt."
        }
      />
      {error && (
        <p className="adm-error-text" role="alert">
          {error}
        </p>
      )}
      {kind === "media" ? (
        <CmsMedia
          assets={assets}
          onSaved={() => setReload((n) => n + 1)}
          write={write}
        />
      ) : (
        <>
          <ManagerPanel
            title="Danh sách nội dung"
            action={
              write && (
                <button
                  className="adm-btn adm-primary"
                  onClick={() => {
                    setCreating(true);
                    setEditing(null);
                  }}
                >
                  Thêm {kind === "news" ? "bài viết" : "nội dung"}
                </button>
              )
            }
          >
            {p.error && (
              <p className="adm-error-text" role="alert">
                {p.error}
              </p>
            )}
            {p.loading ? (
              <AdminLoading />
            ) : (
              <div className="mgr-table-scroll">
                <ManagerTable className="mgr-table">
                  <thead>
                    <tr>
                      <th>Tiêu đề</th>
                      <th>Đường dẫn / vị trí</th>
                      <th>Trạng thái</th>
                      <th>Cập nhật</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.data.map((d) => (
                      <tr key={d.id}>
                        <td>{d.title}</td>
                        <td>{cmsPages[d.key] || d.key}</td>
                        <td>
                          {d.withdrawn
                            ? "Đã gỡ"
                            : d.publishedRevisionId
                              ? "Đã xuất bản"
                              : "Bản nháp"}
                        </td>
                        <td>{workflowTime(d.updatedAt)}</td>
                        <td>
                          <button
                            className="adm-btn"
                            onClick={() => void open(d.id)}
                          >
                            Mở nội dung
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </ManagerTable>
                {!p.data.length && !p.error && (
                  <p className="adm-muted">
                    Chưa có nội dung được quản lý tại đây.
                  </p>
                )}
              </div>
            )}
            <PageButtons manager page={p} />
          </ManagerPanel>
          {(creating || editing) && (
            <CmsEditor
              key={editing?.id || `new-${kind}`}
              kind={kinds[kind]}
              document={editing}
              assets={assets}
              onClose={() => {
                setEditing(null);
                setCreating(false);
              }}
              onSaved={async (id) => {
                setReload((n) => n + 1);
                await open(id);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
function CmsEditor({
  kind,
  document,
  assets,
  onClose,
  onSaved,
}: {
  kind: CmsKind;
  document: CmsDetail | null;
  assets: CmsAsset[];
  onClose: () => void;
  onSaved: (id: string) => Promise<void>;
}) {
  const session = useSession()!,
    first = document?.revisions[0],
    empty: CmsPayload = {
      title: "",
      description: "",
      imageId: null,
      blocks: [],
      category: "",
      date: stationToday(),
      noindex: false,
    };
  const [payload, setPayload] = useState<CmsPayload>(first?.payload || empty),
    [body, setBody] = useState(blocksToText(first?.payload.blocks || [])),
    [key, setKey] = useState(
      document?.key ||
        (kind === "PAGE" ? "home.hero" : kind === "SEO" ? "/" : ""),
    ),
    [revision, setRevision] = useState(first?.id || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [preview, setPreview] = useState(false);
  useEffect(() => {
    if (document) {
      const r = document.revisions[0];
      if (r) {
        setPayload(r.payload);
        setBody(blocksToText(r.payload.blocks));
        setRevision(r.id);
      }
    }
  }, [document]);
  const write = session.permissions.includes("cms.write"),
    publish = session.permissions.includes("cms.publish");
  const homeSection = kind === "PAGE" && key.startsWith("home.");
  const showBody = kind === "NEWS" || (kind === "PAGE" && !homeSection);
  const showImage = !homeSection || ["home.hero", "home.cta"].includes(key);
  function select(id: string) {
    const r = document?.revisions.find((r) => r.id === id);
    if (r) {
      setRevision(id);
      setPayload(r.payload);
      setBody(blocksToText(r.payload.blocks));
      setMessage("");
    }
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy || !write) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const value = { ...payload, blocks: textToBlocks(body) },
        r = await command<{ id: string }>(
          document
            ? "admin/cms/documents/" + document.id
            : "admin/cms/documents",
          document
            ? { expectedVersion: document.version, payload: value }
            : { kind, key, payload: value },
          document ? "PATCH" : "POST",
        );
      await onSaved(r.data.id);
      setMessage("Đã lưu bản nháp.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể lưu.");
    } finally {
      setBusy(false);
    }
  }
  async function publication(withdraw = false) {
    if (!document || busy) return;
    const reason = window.prompt(
      withdraw ? "Lý do gỡ nội dung" : "Lý do xuất bản phiên bản đã chọn",
    );
    if (!reason?.trim()) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await command(
        `admin/cms/documents/${document.id}/${withdraw ? "withdraw" : "publish"}`,
        {
          expectedVersion: document.version,
          reason,
          ...(!withdraw ? { revisionId: revision } : {}),
        },
      );
      await onSaved(document.id);
      setMessage(
        withdraw ? "Đã gỡ khỏi website." : "Đã xuất bản phiên bản đã chọn.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể cập nhật.");
    } finally {
      setBusy(false);
    }
  }
  const dirty =
    JSON.stringify({ ...payload, blocks: textToBlocks(body) }) !==
    JSON.stringify(document?.revisions.find((r) => r.id === revision)?.payload);
  return (
    <ManagerPanel
      title={document ? "Biên tập nội dung" : "Tạo nội dung"}
      action={
        <button className="adm-btn" disabled={busy} onClick={onClose}>
          Đóng
        </button>
      }
    >
      {document && (
        <label className="adm-field">
          Phiên bản
          <select
            value={revision}
            onChange={(e) => select(e.target.value)}
            disabled={busy}
          >
            {document.revisions.map((r) => (
              <option key={r.id} value={r.id}>
                Phiên bản {r.number}
                {document.publishedRevisionId === r.id
                  ? " · Đang xuất bản"
                  : ""}{" "}
                · {workflowTime(r.createdAt)}
              </option>
            ))}
          </select>
          {document.hasOlderRevisions && (
            <small>Hiển thị 100 phiên bản gần nhất.</small>
          )}
        </label>
      )}
      <form className="adm-booking-form" onSubmit={save}>
        <fieldset disabled={busy || !write}>
          <legend>{kind === "SEO" ? "Thông tin SEO" : "Nội dung"}</legend>
          <div className="adm-form-grid">
            <label className="adm-field">
              {kind === "PAGE" ? "Vị trí nội dung" : "Đường dẫn"}
              {kind === "PAGE" ? (
                <select
                  value={key}
                  disabled={!!document}
                  onChange={(e) => setKey(e.target.value)}
                >
                  {Object.entries(cmsPages).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={key}
                  disabled={!!document}
                  required
                  maxLength={180}
                  placeholder={
                    kind === "NEWS" ? "huong-dan-cham-soc-xe" : "/news"
                  }
                  onChange={(e) => setKey(e.target.value)}
                />
              )}
            </label>
            <label className="adm-field">
              Tiêu đề
              <input
                required
                maxLength={180}
                value={payload.title}
                onChange={(e) =>
                  setPayload({ ...payload, title: e.target.value })
                }
              />
            </label>
            <label className="adm-field">
              Mô tả
              <textarea
                maxLength={500}
                value={payload.description}
                onChange={(e) =>
                  setPayload({ ...payload, description: e.target.value })
                }
              />
            </label>
            {showImage && (
              <label className="adm-field">
                Ảnh
                <select
                  required={kind === "NEWS"}
                  value={payload.imageId || ""}
                  onChange={(e) =>
                    setPayload({ ...payload, imageId: e.target.value || null })
                  }
                >
                  <option value="">Không dùng ảnh</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {a.alt}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {kind === "NEWS" && (
              <>
                <label className="adm-field">
                  Chuyên mục
                  <input
                    maxLength={80}
                    value={payload.category}
                    onChange={(e) =>
                      setPayload({ ...payload, category: e.target.value })
                    }
                  />
                </label>
                <label className="adm-field">
                  Ngày đăng
                  <input
                    required
                    type="date"
                    value={payload.date || ""}
                    onChange={(e) =>
                      setPayload({ ...payload, date: e.target.value })
                    }
                  />
                </label>
              </>
            )}
          </div>
          {showBody && (
            <label className="adm-field">
              Nội dung
              <textarea
                rows={12}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
              <small className="adm-muted">
                Mỗi đoạn cách nhau một dòng trống. Dùng ## cho tiêu đề, ### cho
                tiêu đề nhỏ, - cho mục liệt kê, &gt; cho trích dẫn.
              </small>
            </label>
          )}
          {(!homeSection || key === "home.hero") && (
            <div className="adv-check-grid">
              <label>
                <input
                  type="checkbox"
                  checked={payload.noindex}
                  onChange={(e) =>
                    setPayload({ ...payload, noindex: e.target.checked })
                  }
                />{" "}
                Không cho công cụ tìm kiếm lập chỉ mục
              </label>
            </div>
          )}
          {write && (
            <button className="adm-btn adm-primary">Lưu bản nháp</button>
          )}
        </fieldset>
      </form>
      <div className="mgr-toolbar">
        <button className="adm-btn" onClick={() => setPreview(!preview)}>
          {preview ? "Đóng xem trước" : "Xem trước"}
        </button>
        {document && publish && (
          <>
            <button
              className="adm-btn adm-primary"
              disabled={busy || !revision || dirty}
              onClick={() => void publication()}
            >
              Xuất bản phiên bản đã chọn
            </button>
            <button
              className="adm-btn adm-danger"
              disabled={busy || !document.publishedRevisionId}
              onClick={() => void publication(true)}
            >
              Gỡ khỏi website
            </button>
          </>
        )}
      </div>
      {document && dirty && (
        <p className="adm-muted">
          Lưu thay đổi thành bản nháp trước khi xuất bản.
        </p>
      )}
      {error && (
        <p className="adm-error-text" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {preview && (
        <article className="adm-panel">
          <h1>{payload.title}</h1>
          <p>{payload.description}</p>
          {payload.imageId && (
            <div className="mgr-preview-image">
              <Image
                src={`/api/v1/admin/cms/assets/${payload.imageId}`}
                alt={
                  assets.find((a) => a.id === payload.imageId)?.alt ||
                  payload.title
                }
                fill
                sizes="100vw"
                unoptimized
              />
            </div>
          )}
          <CmsBlocks blocks={textToBlocks(body)} />
        </article>
      )}
    </ManagerPanel>
  );
}
function CmsMedia({
  assets,
  onSaved,
  write,
}: {
  assets: CmsAsset[];
  onSaved: () => void;
  write: boolean;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget,
      d = new FormData(form),
      file = d.get("image");
    if (!(file instanceof File) || !file.size) return;
    setBusy(true);
    setError("");
    try {
      const photo = await prepareIntakePhoto(file);
      await command("admin/cms/assets", { ...photo, alt: d.get("alt") });
      form.reset();
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tải ảnh.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <ManagerPanel title="Ảnh website">
      {write && (
        <form className="adm-booking-form" onSubmit={upload}>
          <fieldset disabled={busy}>
            <legend>Thêm ảnh</legend>
            <label className="adm-field">
              Ảnh
              <input
                required
                type="file"
                name="image"
                accept="image/jpeg,image/png,image/webp"
              />
            </label>
            <label className="adm-field">
              Mô tả ảnh
              <input name="alt" required maxLength={240} />
            </label>
            <button className="adm-btn adm-primary">
              {busy ? "Đang tải…" : "Tải ảnh"}
            </button>
          </fieldset>
        </form>
      )}
      {error && (
        <p role="alert" className="adm-error-text">
          {error}
        </p>
      )}
      <div className="mgr-media-grid">
        {assets.map((a) => (
          <figure className="mgr-media-card" key={a.id}>
            <div className="mgr-media-image">
              <Image
                src={`/api/v1/admin/cms/assets/${a.id}`}
                alt={a.alt}
                fill
                sizes="(max-width: 767px) 100vw, 33vw"
                unoptimized
              />
            </div>
            <figcaption>
              <strong>{a.name}</strong>
              <p>{a.alt}</p>
            </figcaption>
          </figure>
        ))}
      </div>
      {!assets.length && (
        <p className="adm-muted">Chưa có ảnh trong thư viện.</p>
      )}
    </ManagerPanel>
  );
}
