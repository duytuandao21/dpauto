"use client";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSession } from "@/components/admin/auth-gate";
import { ApiFailure } from "@/lib/api/client";
import { CmsIcon } from "./icon";
import {
  Alert,
  Badge,
  Button,
  Card,
  Dialog,
  Field,
  Input,
  Loading,
  Menu,
  PageHeader,
  Switch,
  errorText,
  timeAgo,
  useToast,
} from "./ui";
import {
  api,
  findDocument,
  slugify,
  statusLabel,
  type DocDetail,
  type Kind,
  type Payload,
} from "./data";

const clean = (p: Payload): Payload => {
  const out = JSON.parse(JSON.stringify(p));
  // Old saves kept a bare `imageId` beside the image field the form edits now; that image may
  // since have been deleted, which would make every save fail on an image the admin cannot see.
  if (out.image?.assetId && "imageId" in out) delete out.imageId;
  return out;
};
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const fieldNames: Record<string, string> = {
  title: "Tiêu đề",
  name: "Tên",
  description: "Mô tả",
  href: "Đường dẫn",
  src: "Ảnh",
  body: "Nội dung",
  date: "Ngày đăng",
  email: "Email",
  phone: "Điện thoại",
  mapEmbed: "Link nhúng bản đồ",
};
function failure(e: unknown) {
  if (e instanceof ApiFailure && e.fields.length)
    return `${e.message} Kiểm tra: ${[
      ...new Set(
        e.fields.map((f) =>
          f.path
            .split(".")
            .map((p) => fieldNames[p] || (/^\d+$/.test(p) ? `#${+p + 1}` : p))
            .join(" › "),
        ),
      ),
    ].join("; ")}.`;
  return errorText(e);
}

export type EditorApi = {
  payload: Payload;
  set: (patch: Payload) => void;
  disabled: boolean;
};

export function DocumentEditor({
  kind,
  docKey,
  title,
  description,
  back,
  defaults,
  defaultHtml,
  render,
  previewPath,
  basePath,
  slugFrom = "title",
  takenKeys,
  hideToggle = true,
  side,
  tabs,
}: {
  kind: Kind;
  /** Existing key, or null to create a new item (a slug field is shown). */
  docKey: string | null;
  title: (payload: Payload) => string;
  description?: ReactNode;
  back?: { href: string; label: string };
  /** Built-in content for this key; null when the item exists only in the CMS. */
  defaults: Payload | null;
  defaultHtml?: string;
  render: (
    e: EditorApi & { defaultHtml?: string; doc: DocDetail | null },
  ) => ReactNode;
  previewPath?: (key: string, payload: Payload) => string;
  /** List page, used to open the new item's own URL after creation. */
  basePath?: string;
  slugFrom?: string;
  /** Keys of built-in items, rejected when creating a new one. */
  takenKeys?: string[];
  hideToggle?: boolean;
  side?: (e: EditorApi) => ReactNode;
  /** Rendered between the page header and the form, e.g. section tabs. */
  tabs?: ReactNode;
}) {
  const session = useSession(),
    write = !!session?.permissions.includes("cms.write"),
    publishable = !!session?.permissions.includes("cms.publish"),
    toast = useToast(),
    router = useRouter();
  const [doc, setDoc] = useState<DocDetail | null | undefined>(undefined),
    [payload, setPayload] = useState<Payload>(defaults || {}),
    [base, setBase] = useState<Payload>(defaults || {}),
    [slug, setSlug] = useState(""),
    [slugTouched, setSlugTouched] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState<null | "revert" | "withdraw">(null);
  const load = useCallback(async () => {
    if (!docKey) return setDoc(null);
    try {
      const d = await findDocument(kind, docKey);
      setDoc(d);
      const p = d?.revisions[0]?.payload || defaults || {};
      setPayload(p);
      setBase(p);
    } catch (e) {
      setError(errorText(e, "Không tải được nội dung."));
      setDoc(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, docKey]);
  useEffect(() => {
    void load();
  }, [load]);
  const dirty = !same(clean(payload), clean(base)) || (!docKey && !!slug);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    if (!docKey && !slugTouched)
      setSlug(slugify(String(payload[slugFrom] || "")));
  }, [payload, slugFrom, docKey, slugTouched]);
  const set = (patch: Payload) => setPayload((p) => ({ ...p, ...patch }));
  const key = docKey || slug.replace(/-+$/, "");
  // Built-in items are not stored until edited, so the server cannot see them as taken.
  const slugTaken = !docKey && !!key && !!takenKeys?.includes(key);
  const latest = doc?.revisions[0];
  const live = doc?.revisions.find((r) => r.id === doc.publishedRevisionId);
  const status = useMemo(() => {
    if (!doc) return defaults ? "default" : "new";
    if (doc.withdrawn) return "withdrawn";
    // Nothing published: the website shows the built-in content, whatever drafts exist.
    if (!doc.publishedRevisionId && defaults) return "default";
    if (latest && latest.id !== doc.publishedRevisionId) return "draft";
    if (live?.payload.hidden) return "hidden";
    return doc.publishedRevisionId ? "live" : defaults ? "default" : "new";
  }, [doc, latest, live, defaults]) as keyof typeof statusLabel;

  /** Saves a new revision when the form differs from the latest one; returns it. */
  async function save(quiet = false) {
    if (!key) throw new Error("Nhập đường dẫn (slug) cho nội dung mới.");
    if (slugTaken)
      throw new Error("Đường dẫn này đã được dùng. Hãy chọn đường dẫn khác.");
    const body = clean(payload);
    let current = doc;
    if (current && latest && same(body, latest.payload) && !dirty)
      return { doc: current, revisionId: latest.id };
    const r = current
      ? await api.save(current.id, current.version, body)
      : await api.create(kind, key, body, !!docKey);
    current = await findDocument(kind, key);
    setDoc(current);
    setBase(body);
    setPayload(body);
    if (!quiet)
      toast("success", "Đã lưu. Người có quyền xuất bản cần bấm Lưu để áp dụng lên website.");
    if (!docKey && basePath) router.replace(`${basePath}/${key}`);
    return { doc: current!, revisionId: r.data.revisionId };
  }
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      const m = failure(e);
      setError(m);
      toast("danger", m);
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }
  // Saving applies straight to the website; the server keeps no older versions.
  const publish = () =>
    run(async () => {
      const saved = await save(true);
      await api.publish(saved.doc.id, saved.doc.version, saved.revisionId);
      toast("success", "Đã lưu và cập nhật lên website.");
      if (docKey) await load();
    });
  const revert = () =>
    run(async () => {
      await api.revert(doc!.id, doc!.version);
      toast("success", "Website đã quay về nội dung mặc định.");
      await load();
      setPayload(defaults || {});
      setBase(defaults || {});
    });
  // Services, news, accessories and projects are deleted outright; fixed sections are only hidden.
  const deletes = ["SERVICE", "NEWS", "ACCESSORY", "PROJECT"].includes(kind);
  const withdraw = () =>
    run(async () => {
      await api.withdraw(doc!.id, doc!.version);
      if (deletes) {
        toast("success", "Đã xóa vĩnh viễn mục này và ảnh của nó.");
        if (back) router.replace(back.href);
        return;
      }
      toast("success", "Đã xóa khỏi website và xóa ảnh của mục này.");
      await load();
    });
  const preview = () =>
    run(async () => {
      if (dirty || !doc) await save(true);
      const t = await api.preview();
      const path = previewPath?.(key, payload) || "/";
      window.open(
        `/api/preview?token=${encodeURIComponent(t.data.token)}&path=${encodeURIComponent(path)}`,
        "_blank",
        "noopener",
      );
    });
  const disabled = !write || busy;
  if (doc === undefined) return <Loading rows={6} />;
  const s = statusLabel[status];
  return (
    <>
      <PageHeader
        back={back}
        title={
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            {title(payload) || "Nội dung mới"}
            <Badge tone={s.tone}>{s.text}</Badge>
            {dirty && <Badge tone="warn">chưa lưu</Badge>}
          </span>
        }
        description={description}
        actions={
          <>
            {previewPath && (
              <Button icon="eye" disabled={busy || !write} onClick={preview}>
                Xem trước
              </Button>
            )}
            {write && (
              <Button
                variant="primary"
                icon="save"
                disabled={busy || (!dirty && (status === "live" || status === "hidden"))}
                onClick={() =>
                  publishable
                    ? void publish()
                    : void run(async () => void (await save()))
                }
              >
                Lưu
              </Button>
            )}
            {publishable && doc && (
              <Menu label="Thao tác khác">
                {(close) => (
                  <>
                    {defaults && (
                      <button
                        type="button"
                        disabled={!doc.publishedRevisionId && !doc.withdrawn}
                        onClick={() => (close(), setConfirm("revert"))}
                      >
                        <CmsIcon name="revert" />
                        Khôi phục nội dung mặc định
                      </button>
                    )}
                    {kind !== "CATALOG" && (
                    <button
                      type="button"
                      data-tone="danger"
                      disabled={doc.withdrawn && !deletes}
                      onClick={() => (close(), setConfirm("withdraw"))}
                    >
                      <CmsIcon name={deletes ? "trash" : "eyeOff"} />
                      {deletes ? "Xóa vĩnh viễn" : "Xóa khỏi website"}
                    </button>
                    )}
                  </>
                )}
              </Menu>
            )}
          </>
        }
      />
      {tabs}
      {!write && <Alert tone="info">Bạn chỉ có quyền xem nội dung này.</Alert>}
      {error && (
        <div style={{ marginBottom: 16 }}>
          <Alert tone="danger">{error}</Alert>
        </div>
      )}
      {doc?.withdrawn && (
        <div style={{ marginBottom: 16 }}>
          <Alert tone="warn">
            Nội dung đang bị gỡ khỏi website. Bấm <strong>Lưu</strong> để hiển
            thị lại
            {defaults ? ", hoặc Khôi phục mặc định để dùng nội dung gốc" : ""}.
          </Alert>
        </div>
      )}
      <div className="cms-grid-main">
        <div className="cms-stack">
          {!docKey && (
            <Card title="Đường dẫn">
              <Field
                label="Slug (đường dẫn trên website)"
                error={
                  slugTaken
                    ? "Đường dẫn này đã được dùng. Hãy chọn đường dẫn khác."
                    : undefined
                }
                help={
                  basePath
                    ? `Chỉ dùng chữ thường không dấu, số và dấu gạch ngang. Không đổi được sau khi tạo.`
                    : undefined
                }
              >
                <Input
                  value={slug}
                  required
                  maxLength={120}
                  disabled={disabled}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(slugify(e.target.value, true));
                  }}
                  placeholder="vi-du-duong-dan"
                />
              </Field>
            </Card>
          )}
          {render({ payload, set, disabled, defaultHtml, doc })}
        </div>
        <div className="cms-stack">
          <Card title="Trạng thái">
            <div className="cms-stack-sm">
              <div className="cms-section-box">
                <CmsIcon
                  name={
                    status === "live"
                      ? "check"
                      : status === "draft"
                        ? "clock"
                        : status === "withdrawn"
                          ? "eyeOff"
                          : "layers"
                  }
                />
                <div>
                  <strong>{s.text}</strong>
                  <p className="cms-help">
                    {status === "default"
                      ? "Website đang dùng nội dung gốc. Sửa rồi bấm Lưu để thay thế."
                      : status === "new"
                        ? "Nội dung chưa có trên website."
                        : status === "draft"
                          ? "Có thay đổi chưa áp dụng lên website. Bấm Lưu để áp dụng."
                          : status === "hidden"
                            ? "Đã ẩn khỏi website."
                            : status === "withdrawn"
                              ? "Đã gỡ khỏi website."
                              : "Website đang hiển thị nội dung này."}
                  </p>
                </div>
              </div>
              {doc && (
                <p className="cms-help">Cập nhật {timeAgo(doc.updatedAt)}</p>
              )}
              {hideToggle && (
                <Switch
                  label="Ẩn khỏi website"
                  checked={!!payload.hidden}
                  disabled={disabled}
                  onChange={(v) => set({ hidden: v || undefined })}
                />
              )}
            </div>
          </Card>
          {side?.({ payload, set, disabled })}
        </div>
      </div>
      {confirm === "revert" && (
        <Dialog
          title="Khôi phục nội dung mặc định?"
          description="Website sẽ hiển thị lại nội dung gốc. Nội dung đã sửa sẽ bị xóa, không thể khôi phục."
          onClose={() => setConfirm(null)}
          footer={
            <>
              <Button onClick={() => setConfirm(null)}>Hủy</Button>
              <Button
                variant="primary"
                icon="revert"
                disabled={busy}
                onClick={() => void revert()}
              >
                Khôi phục
              </Button>
            </>
          }
        >
          <p className="cms-help">
            Ảnh đã tải lên vẫn còn trong thư viện ảnh.
          </p>
        </Dialog>
      )}
      {confirm === "withdraw" && (
        <Dialog
          title={deletes ? "Xóa vĩnh viễn mục này?" : "Xóa khỏi website?"}
          description={
            deletes
              ? "Mục này sẽ bị xóa khỏi website và khỏi trang quản trị, cùng mọi ảnh của nó trên kho lưu trữ (R2) (trừ ảnh nội dung khác vẫn đang dùng). Không thể khôi phục."
              : (defaults
              ? "Phần nội dung này sẽ bị ẩn hoàn toàn khỏi website (kể cả nội dung gốc)."
              : "Nội dung sẽ không còn hiển thị trên website.") +
              " Mọi ảnh đã tải lên cho mục này sẽ bị xóa vĩnh viễn khỏi kho lưu trữ (R2), trừ ảnh nội dung khác vẫn đang dùng."
          }
          onClose={() => setConfirm(null)}
          footer={
            <>
              <Button onClick={() => setConfirm(null)}>Hủy</Button>
              <Button
                variant="danger"
                icon="eyeOff"
                disabled={busy}
                onClick={() => void withdraw()}
              >
                {deletes ? "Xóa vĩnh viễn" : "Xóa khỏi website"}
              </Button>
            </>
          }
        >
          <p className="cms-help">
            {defaults
              ? "Nếu chỉ muốn quay về nội dung gốc, hãy dùng “Khôi phục nội dung mặc định”."
              : deletes
                ? "Đường dẫn (slug) của mục này sẽ được giải phóng để dùng lại."
                : "Bấm Lưu để hiển thị lại nội dung, nhưng cần chọn lại ảnh."}
          </p>
        </Dialog>
      )}
    </>
  );
}
