"use client";
import {
  useEffect,
  useState,
  type DragEvent,
  type FormEvent,
  type MouseEvent,
} from "react";
import { useSearchParams } from "next/navigation";
import { collection, command, request, uploadFile } from "@/lib/api/client";
import type { CmsAsset, CmsAssetUsage } from "@/lib/api/cms";
import { useSession } from "@/components/admin/auth-gate";
import { CmsIcon } from "./icon";
import {
  Alert,
  Badge,
  Button,
  Card,
  Dialog,
  Empty,
  Field,
  Input,
  Loading,
  PageHeader,
  Tabs,
  bytes,
  dateTime,
  errorText,
  useToast,
} from "./ui";
import { editPath } from "./data";

const MAX = 20 * 1024 * 1024,
  MAX_VIDEO = 100 * 1024 * 1024;
const imageTypes = "image/jpeg,image/png,image/webp,image/avif",
  videoTypes = "video/mp4,video/webm";
/** What a picker or uploader handles: images, videos, or both (the library page). */
export type MediaKind = "image" | "video" | "any";
const acceptFor = (kind: MediaKind) =>
  kind === "image" ? imageTypes : kind === "video" ? videoTypes : `${imageTypes},${videoTypes}`;
export const isVideo = (a: Pick<CmsAsset, "kind">) => a.kind === "video";
export const thumb = (a: CmsAsset) =>
  a.webp.find((v) => v.width >= 320)?.url || a.src;
// shortcut: preview frame at 1 s, since phone/TikTok clips often fade in from black; a real poster image would need server-side decoding.
export const videoFrame = (src: string) => `${src}#t=1`;
/** Small preview of a library item: a frame near the start for videos. */
export function AssetPreview({ src, video }: { src: string; video?: boolean }) {
  return video ? (
    <video src={videoFrame(src)} muted playsInline preload="metadata" />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" loading="lazy" />
  );
}
function precheck(f: File, kind: MediaKind) {
  const video =
    f.type.startsWith("video/") || /\.(mp4|m4v|webm|mov)$/i.test(f.name);
  if (video) {
    if (kind === "image") return "Ô này chỉ nhận ảnh.";
    if (/\.mov$/i.test(f.name) || f.type === "video/quicktime")
      return "Video .mov chưa được hỗ trợ, hãy xuất sang MP4 (H.264).";
    if (f.size > MAX_VIDEO) return "Video vượt quá 100 MB.";
    if (f.type && !videoTypes.split(",").includes(f.type))
      return "Chỉ nhận video MP4 hoặc WebM.";
    return "";
  }
  if (kind === "video") return "Ô này chỉ nhận video MP4 hoặc WebM.";
  if (/\.(heic|heif)$/i.test(f.name) || /hei[cf]/i.test(f.type))
    return "Ảnh HEIC chưa được hỗ trợ, hãy chọn JPEG hoặc PNG.";
  if (f.size > MAX) return "Ảnh vượt quá 20 MB.";
  if (f.type && !imageTypes.split(",").includes(f.type))
    return "Chỉ nhận JPEG, PNG, WebP hoặc AVIF.";
  return "";
}

type Job = { name: string; progress: number; error: string; done: boolean };
/** Drag-and-drop uploader with per-file progress; resolves the ids of stored images. */
export function Uploader({
  onDone,
  compact,
  kind = "image",
}: {
  onDone: (ids: string[]) => void;
  compact?: boolean;
  kind?: MediaKind;
}) {
  const [jobs, setJobs] = useState<Job[]>([]),
    [drag, setDrag] = useState(false),
    [alt, setAlt] = useState(""),
    [busy, setBusy] = useState(false);
  async function run(files: File[]) {
    if (busy || !files.length) return;
    const queue = files.map((f) => ({
      name: f.name,
      progress: 0,
      error: precheck(f, kind),
      done: false,
    }));
    setJobs(queue);
    setBusy(true);
    const ids: string[] = [],
      patch = (i: number, c: Partial<Job>) =>
        setJobs((all) => all.map((j, n) => (n === i ? { ...j, ...c } : j)));
    for (const [i, f] of files.entries()) {
      if (queue[i].error) continue;
      try {
        const r = await uploadFile<{ id: string }>(
          "admin/cms/assets",
          f,
          {
            name: f.name.slice(0, 120),
            alt: (
              alt.trim() ||
              f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ")
            ).slice(0, 240),
          },
          (p) => patch(i, { progress: p }),
        );
        ids.push(r.data.id);
        patch(i, { progress: 1, done: true });
      } catch (e) {
        patch(i, { error: errorText(e, "Không thể tải tệp lên.") });
      }
    }
    setBusy(false);
    if (ids.length) onDone(ids);
  }
  const drop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    void run([...e.dataTransfer.files]);
  };
  return (
    <div className="cms-stack-sm">
      <label
        className="cms-dropzone"
        data-active={drag}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={drop}
      >
        <CmsIcon name="upload" size={24} />
        <strong style={{ color: "var(--c-fg)" }}>
          {busy
            ? "Đang tải lên…"
            : kind === "video"
              ? "Kéo thả video vào đây hoặc bấm để chọn"
              : kind === "any"
                ? "Kéo thả ảnh hoặc video vào đây, hoặc bấm để chọn"
                : "Kéo thả ảnh vào đây hoặc bấm để chọn"}
        </strong>
        <span>
          {kind !== "video" &&
            "Ảnh JPEG, PNG, WebP, AVIF · tối đa 20 MB · hệ thống tự tạo các kích thước phù hợp"}
          {kind === "any" && <br />}
          {kind !== "image" &&
            "Video MP4 (H.264) hoặc WebM · tối đa 100 MB · lưu nguyên bản, nên nén trước khi tải"}
        </span>
        <input
          type="file"
          multiple
          accept={acceptFor(kind)}
          disabled={busy}
          className="cms-sr-only"
          style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
          onChange={(e) => {
            void run([...(e.target.files || [])]);
            e.target.value = "";
          }}
        />
      </label>
      {!compact && (
        <Field
          label="Mô tả ảnh (alt) cho lượt tải này"
          help="Để trống sẽ dùng tên file; có thể sửa từng ảnh sau."
        >
          <Input
            value={alt}
            maxLength={240}
            onChange={(e) => setAlt(e.target.value)}
            placeholder="Ví dụ: Xe SUV sau khi phủ ceramic"
          />
        </Field>
      )}
      {!!jobs.length && (
        <div className="cms-stack-sm" aria-live="polite">
          {jobs.map((j, i) => (
            <div
              key={i}
              className="cms-row-card"
              data-tone={j.error ? "danger" : j.done ? "success" : undefined}
            >
              <CmsIcon name={j.error ? "alert" : j.done ? "check" : "image"} />
              <div className="cms-row-main">
                <strong>{j.name}</strong>
                {j.error ? (
                  <span>{j.error}</span>
                ) : j.done ? (
                  <span>Đã tải xong</span>
                ) : (
                  <>
                    <div className="cms-progress" style={{ marginTop: 6 }}>
                      <span
                        style={{ width: `${Math.round(j.progress * 100)}%` }}
                      />
                    </div>
                    {/* After the bytes arrive the server still resizes and encodes every variant. */}
                    <span>
                      {j.progress >= 1
                        ? "Đang xử lý và lưu…"
                        : `Đang tải lên ${Math.round(j.progress * 100)}%`}
                    </span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AssetDetail({
  asset,
  write,
  onClose,
  onChanged,
}: {
  asset: CmsAsset;
  write: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const video = isVideo(asset),
    toast = useToast(),
    [focal, setFocal] = useState(asset.focal),
    [usage, setUsage] = useState<CmsAssetUsage[] | null>(null),
    [busy, setBusy] = useState(false),
    [confirmDelete, setConfirmDelete] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const a = new AbortController();
    request<CmsAssetUsage[]>(`admin/cms/assets/${asset.id}/usage`, {
      signal: a.signal,
    })
      .then((r) => setUsage(r.data))
      .catch(() => {});
    return () => a.abort();
  }, [asset.id]);
  async function act(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    setError("");
    try {
      await fn();
      toast("success", done);
      onChanged();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget),
      moved = focal.x !== asset.focal.x || focal.y !== asset.focal.y;
    void act(
      () =>
        command(
          "admin/cms/assets/" + asset.id,
          {
            name: d.get("name"),
            alt: d.get("alt"),
            ...(moved ? { focalX: focal.x, focalY: focal.y } : {}),
          },
          "PATCH",
        ),
      "Đã lưu thông tin ảnh.",
    );
  }
  const pick = (e: MouseEvent<HTMLDivElement>) => {
    if (!write) return;
    const r = e.currentTarget.getBoundingClientRect(),
      c = (v: number) => Math.min(1, Math.max(0, Math.round(v * 100) / 100));
    setFocal({
      x: c((e.clientX - r.left) / r.width),
      y: c((e.clientY - r.top) / r.height),
    });
  };
  return (
    <Dialog
      title={asset.name}
      description={`${asset.width && asset.height ? `${asset.width}×${asset.height}px · ` : ""}${bytes(asset.bytes)} · tải lên ${dateTime(asset.createdAt)}`}
      size="lg"
      onClose={onClose}
      footer={
        write && (
          <>
            {asset.deletedAt && (
              <Button
                icon="revert"
                disabled={busy}
                onClick={() =>
                  void act(
                    () => command(`admin/cms/assets/${asset.id}/restore`, {}),
                    "Đã khôi phục ảnh.",
                  )
                }
              >
                Khôi phục ảnh
              </Button>
            )}
            <Button
              variant="danger"
              icon="trash"
              disabled={busy}
              onClick={() => setConfirmDelete(true)}
            >
              Xóa vĩnh viễn
            </Button>
            <Button
              variant="primary"
              icon="save"
              type="submit"
              form="cms-asset-form"
              disabled={busy}
            >
              Lưu thay đổi
            </Button>
          </>
        )
      }
    >
      <div
        className="cms-grid-main"
        style={{ gridTemplateColumns: "minmax(0,1fr) 320px" }}
      >
        {video ? (
          <div className="cms-stack-sm">
            <video
              src={videoFrame(asset.src)}
              controls
              playsInline
              preload="metadata"
              // Portrait clips would otherwise be taller than the dialog.
              style={{
                width: "100%",
                maxHeight: "60vh",
                objectFit: "contain",
                borderRadius: 8,
                background: "#000",
              }}
            />
          </div>
        ) : (
          <div className="cms-stack-sm">
            <div
              className="cms-focal"
              onClick={pick}
              title={write ? "Bấm để chọn điểm lấy nét" : undefined}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset.src} alt={asset.alt} />
              <span
                className="cms-focal-dot"
                style={{ left: `${focal.x * 100}%`, top: `${focal.y * 100}%` }}
              />
            </div>
            <p className="cms-help">
              Bấm lên ảnh để chọn phần quan trọng (điểm lấy nét). Khi ảnh bị cắt
              theo khung hiển thị, phần này luôn được giữ lại.
            </p>
          </div>
        )}
        <form id="cms-asset-form" className="cms-stack-sm" onSubmit={save}>
          <fieldset
            disabled={!write || busy}
            style={{
              border: 0,
              padding: 0,
              margin: 0,
              display: "grid",
              gap: 16,
            }}
          >
            <Field label="Tên ảnh">
              <Input
                name="name"
                required
                maxLength={120}
                defaultValue={asset.name}
              />
            </Field>
            <Field
              label="Mô tả ảnh (alt)"
              help="Mô tả ngắn nội dung ảnh, giúp SEO và người dùng trình đọc màn hình."
            >
              <Input
                name="alt"
                required
                maxLength={240}
                defaultValue={asset.alt}
              />
            </Field>
            {!video && (
            <>
            <Field label={`Điểm lấy nét ngang: ${Math.round(focal.x * 100)}%`}>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(focal.x * 100)}
                onChange={(e) =>
                  setFocal({ ...focal, x: +e.target.value / 100 })
                }
              />
            </Field>
            <Field label={`Điểm lấy nét dọc: ${Math.round(focal.y * 100)}%`}>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(focal.y * 100)}
                onChange={(e) =>
                  setFocal({ ...focal, y: +e.target.value / 100 })
                }
              />
            </Field>
            </>
            )}
          </fieldset>
          <div>
            <span className="cms-label">Các kích thước đã tạo</span>
            <p className="cms-help" style={{ marginTop: 6 }}>
              {video
                ? `Video ${asset.mime.replace("video/", "").toUpperCase()}, lưu nguyên bản (không nén lại)`
                : asset.webp.length
                  ? asset.webp.map((v) => `${v.width}px`).join(" · ") +
                    " (AVIF + WebP)"
                  : "Ảnh cũ, chưa chuyển sang kho ảnh"}
            </p>
          </div>
          <div>
            <span className="cms-label">Đang dùng ở</span>
            {usage === null ? (
              <p className="cms-help">Đang tải…</p>
            ) : usage.length ? (
              <div className="cms-stack-sm" style={{ marginTop: 8 }}>
                {usage.map((u) => (
                  <a
                    key={u.id}
                    className="cms-row-card"
                    href={editPath(u.kind as "PAGE", u.key)}
                  >
                    <div className="cms-row-main">
                      <strong>{u.title || u.key}</strong>
                    </div>
                    <Badge tone={u.live ? "success" : "warn"}>
                      {u.live ? "đang hiển thị" : "chưa áp dụng"}
                    </Badge>
                  </a>
                ))}
              </div>
            ) : (
              <p className="cms-help">Chưa được nội dung nào sử dụng.</p>
            )}
          </div>
          {error && <Alert tone="danger">{error}</Alert>}
        </form>
      </div>
      {confirmDelete && (
        <Dialog
          title="Xóa vĩnh viễn ảnh này?"
          description={
            usage?.length
              ? `Ảnh đang được dùng ở: ${usage.map((u) => u.title || u.key).join(", ")}. Ảnh và mọi kích thước của nó sẽ bị xóa khỏi kho lưu trữ (R2) ngay lập tức, không thể khôi phục; các nội dung trên sẽ dùng ảnh mặc định.`
              : "Ảnh và mọi kích thước của nó sẽ bị xóa khỏi kho lưu trữ (R2) ngay lập tức và không thể khôi phục."
          }
          onClose={() => setConfirmDelete(false)}
          footer={
            <>
              <Button onClick={() => setConfirmDelete(false)}>Hủy</Button>
              <Button
                variant="danger"
                icon="trash"
                disabled={busy}
                onClick={() => {
                  setConfirmDelete(false);
                  void act(
                    () => command("admin/cms/assets/" + asset.id, {}, "DELETE"),
                    "Đã xóa vĩnh viễn ảnh.",
                  );
                }}
              >
                Xóa vĩnh viễn
              </Button>
            </>
          }
        >
          {null}
        </Dialog>
      )}
    </Dialog>
  );
}

function useAssets(
  search: string,
  trash: boolean,
  tick: number,
  kind: MediaKind = "any",
) {
  const [state, setState] = useState<{
    data: CmsAsset[];
    loading: boolean;
    error?: string;
  }>({ data: [], loading: true });
  useEffect(() => {
    const a = new AbortController(),
      q = new URLSearchParams({
        ...(search ? { search } : {}),
        ...(trash ? { trash: "true" } : {}),
        ...(kind !== "any" ? { type: kind } : {}),
      });
    setState((s) => ({ ...s, loading: true }));
    collection<CmsAsset>(`admin/cms/assets?${q}`, a.signal)
      .then((data) => setState({ data, loading: false }))
      .catch(
        (e) =>
          !a.signal.aborted &&
          setState({ data: [], loading: false, error: errorText(e) }),
      );
    return () => a.abort();
  }, [search, trash, tick, kind]);
  return state;
}

function AssetGrid({
  assets,
  selected,
  onPick,
}: {
  assets: CmsAsset[];
  selected?: string;
  onPick: (a: CmsAsset) => void;
}) {
  return (
    <div className="cms-media-grid">
      {assets.map((a) => (
        <button
          type="button"
          key={a.id}
          className="cms-media-card"
          aria-pressed={selected === a.id}
          onClick={() => onPick(a)}
        >
          <div className="cms-image-preview">
            <AssetPreview src={thumb(a)} video={isVideo(a)} />
          </div>
          <div>
            <strong>{a.name}</strong>
            <small>
              {isVideo(a)
                ? "Video"
                : a.width
                  ? `${a.width}×${a.height}`
                  : "Ảnh cũ"}{" "}
              · {bytes(a.bytes)}
            </small>
          </div>
        </button>
      ))}
    </div>
  );
}

export function MediaLibraryPage() {
  const session = useSession(),
    write = !!session?.permissions.includes("cms.write"),
    params = useSearchParams(),
    [tab, setTab] = useState<"library" | "trash">(
      params.get("trash") ? "trash" : "library",
    ),
    [search, setSearch] = useState(""),
    [q, setQ] = useState(""),
    [tick, setTick] = useState(0),
    [open, setOpen] = useState<CmsAsset | null>(null),
    [upload, setUpload] = useState(false);
  const list = useAssets(search, tab === "trash", tick),
    total = list.data.reduce((n, a) => n + (a.bytes || 0), 0);
  useEffect(() => {
    const t = setTimeout(() => setSearch(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <>
      <PageHeader
        title="Thư viện ảnh"
        description="Ảnh và video dùng trên website. Ảnh được tự động tạo các kích thước AVIF/WebP để tải nhanh; video được lưu nguyên bản."
        actions={
          write && (
            <Button
              variant="primary"
              icon="upload"
              onClick={() => setUpload(true)}
            >
              Tải ảnh / video lên
            </Button>
          )
        }
      />
      <div className="cms-stats" data-count="4">
        <div className="cms-card cms-stat">
          <strong>{list.loading ? "…" : list.data.length}</strong>
          <span>
            {tab === "trash" ? "Ảnh trong thùng rác" : "Ảnh trong thư viện"}
          </span>
        </div>
        <div className="cms-card cms-stat">
          <strong>{bytes(total)}</strong>
          <span>Dung lượng ảnh gốc</span>
        </div>
        <div className="cms-card cms-stat">
          <strong>{list.data.filter((a) => a.webp.length).length}</strong>
          <span>Đã tối ưu (AVIF/WebP)</span>
        </div>
        <div className="cms-card cms-stat">
          <strong>{list.data.filter(isVideo).length}</strong>
          <span>Video</span>
        </div>
      </div>
      <Tabs
        label="Thư viện ảnh"
        value={tab}
        onChange={setTab}
        items={[
          { value: "library", label: "Thư viện", icon: "image" },
          { value: "trash", label: "Thùng rác", icon: "trash" },
        ]}
      />
      <Card pad={false}>
        <div className="cms-toolbar">
          <div className="cms-input-icon">
            <CmsIcon name="search" />
            <Input
              type="search"
              placeholder="Tìm theo tên hoặc mô tả ảnh…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Tìm ảnh"
            />
          </div>
        </div>
        <div className="cms-card-body">
          {tab === "trash" && (
            <Alert tone="info">
              Ảnh trong thùng rác bị xóa vĩnh viễn sau 30 ngày. Mở ảnh để khôi
              phục hoặc xóa vĩnh viễn ngay.
            </Alert>
          )}
          {list.error && <Alert tone="danger">{list.error}</Alert>}
          <div style={{ marginTop: tab === "trash" ? 16 : 0 }}>
            {list.loading && !list.data.length ? (
              <Loading />
            ) : list.data.length ? (
              <AssetGrid assets={list.data} onPick={setOpen} />
            ) : (
              <Empty
                icon="image"
                title={
                  search
                    ? "Không tìm thấy ảnh phù hợp"
                    : tab === "trash"
                      ? "Thùng rác trống"
                      : "Chưa có ảnh"
                }
              >
                {tab === "library" &&
                  !search &&
                  "Bấm “Tải ảnh lên” để thêm ảnh đầu tiên."}
              </Empty>
            )}
          </div>
        </div>
      </Card>
      {upload && (
        <Dialog
          title="Tải ảnh / video lên"
          description="Có thể chọn nhiều tệp cùng lúc."
          onClose={() => setUpload(false)}
        >
          <Uploader
            kind="any"
            onDone={() => {
              setTick((n) => n + 1);
            }}
          />
        </Dialog>
      )}
      {open && (
        <AssetDetail
          key={open.id}
          asset={open}
          write={write}
          onClose={() => setOpen(null)}
          onChanged={() => {
            setTick((n) => n + 1);
            setOpen(null);
          }}
        />
      )}
    </>
  );
}

/** Library picker; resolves with the chosen (or freshly uploaded) image. */
export function MediaPicker({
  onPick,
  onClose,
  selected,
  kind = "image",
}: {
  onPick: (a: CmsAsset) => void;
  onClose: () => void;
  selected?: string;
  kind?: "image" | "video";
}) {
  const noun = kind === "video" ? "video" : "ảnh";
  const session = useSession(),
    write = !!session?.permissions.includes("cms.write"),
    [q, setQ] = useState(""),
    [search, setSearch] = useState(""),
    [tick, setTick] = useState(0),
    [tab, setTab] = useState<"library" | "upload">("library"),
    list = useAssets(search, false, tick, kind);
  useEffect(() => {
    const t = setTimeout(() => setSearch(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <Dialog
      title={`Chọn ${noun}`}
      description={`Chọn ${noun} có sẵn trong thư viện hoặc tải ${noun} mới.`}
      size="lg"
      onClose={onClose}
    >
      <Tabs
        label={`Chọn ${noun}`}
        value={tab}
        onChange={setTab}
        items={[
          { value: "library", label: "Thư viện", icon: "image" },
          ...(write
            ? [
                {
                  value: "upload" as const,
                  label: `Tải ${noun} mới`,
                  icon: "upload" as const,
                },
              ]
            : []),
        ]}
      />
      {tab === "upload" ? (
        <Uploader
          kind={kind}
          onDone={async (ids) => {
            setTick((n) => n + 1);
            const fresh = await collection<CmsAsset>(
              `admin/cms/assets?type=${kind}`,
            );
            const first = fresh.find((a) => a.id === ids[0]);
            if (first) onPick(first);
          }}
        />
      ) : (
        <div className="cms-stack-sm">
          <div className="cms-input-icon">
            <CmsIcon name="search" />
            <Input
              type="search"
              placeholder={`Tìm ${noun}…`}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Tìm ảnh"
            />
          </div>
          {list.loading && !list.data.length ? (
            <Loading />
          ) : list.data.length ? (
            <AssetGrid assets={list.data} selected={selected} onPick={onPick} />
          ) : (
            <Empty icon="image" title={`Chưa có ${noun} phù hợp`}>
              {write && `Chuyển sang tab “Tải ${noun} mới” để thêm ${noun}.`}
            </Empty>
          )}
        </div>
      )}
    </Dialog>
  );
}
