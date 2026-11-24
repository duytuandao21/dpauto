"use client";
import { useEffect, useState } from "react";
import {
  defaultAccessories,
  defaultArticles,
  defaultProjects,
  defaultServices,
} from "@/lib/cms-defaults";
import { DocumentEditor, type EditorApi } from "../editor";
import { GalleryField, ImageField, Repeater } from "../fields";
import { ContentList, type Row } from "../list";
import { useSession } from "@/components/admin/auth-gate";
import { RichText } from "../rich-text";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Select,
  Switch,
  Tabs,
  Textarea,
  TextLine,
  errorText,
  money,
  useToast,
} from "../ui";
import {
  api,
  findDocument,
  slugify,
  type ImageValue,
  type Payload,
} from "../data";
import { specIcons } from "@/components/ui/icon";
import { catalogEntry } from "@/lib/site-content";
import { request } from "@/lib/api/client";
import type { PublicCatalog } from "@/lib/api/types";
import { useCatalog } from "./catalog";

type Spec = {
  label: string;
  value: string;
  key?: boolean;
  icon?: (typeof specIcons)[number][0];
};

const find = (
  list: { key: string; payload: Payload; html: string }[],
  key: string | null,
) => (key ? list.find((d) => d.key === key) : undefined);
const num = (v: string) =>
  v.trim() === ""
    ? null
    : Math.max(0, Math.round(Number(v.replace(/\D/g, ""))));

/* ---------------- Services ---------------- */
export function ServicesList() {
  return (
    <ContentList
      kind="SERVICE"
      title="Dịch vụ"
      description="Các dịch vụ hiển thị ở trang chủ, trang Dịch vụ và trang chi tiết từng dịch vụ."
      basePath="/admin/dich-vu"
      icon="wrench"
      noun="dịch vụ"
      newLabel="Thêm dịch vụ"
      defaults={defaultServices}
      columns={[
        {
          label: "Thứ tự",
          cell: (r) => <span className="cms-row-index">{r.order + 1}</span>,
        },
      ]}
    />
  );
}
/** Operations services a website service can be booked as (public booking catalogue). */
function useOpServices() {
  const [list, setList] = useState<PublicCatalog["services"] | null>(null);
  useEffect(() => {
    request<PublicCatalog>("public/services")
      .then((r) => setList(r.data.services))
      .catch(() => setList([]));
  }, []);
  return list;
}
function ServiceForm({
  payload,
  set,
  disabled,
  defaultHtml,
  docKey,
}: EditorApi & { defaultHtml?: string; docKey?: string | null }) {
  const opServices = useOpServices();
  const [tab, setTab] = useState<
    "info" | "intro" | "process" | "benefits" | "faq" | "gallery"
  >("info");
  return (
    <Card pad>
      <Tabs
        label="Phần nội dung dịch vụ"
        value={tab}
        onChange={setTab}
        items={[
          { value: "info", label: "Thông tin" },
          { value: "intro", label: "Giới thiệu" },
          {
            value: "process",
            label: `Quy trình (${payload.process?.length || 0})`,
          },
          {
            value: "benefits",
            label: `Lợi ích (${payload.benefits?.length || 0})`,
          },
          { value: "faq", label: `FAQ (${payload.faq?.length || 0})` },
          {
            value: "gallery",
            label: `Thư viện ảnh (${payload.gallery?.length || 0})`,
          },
        ]}
      />
      <div className="cms-form-grid">
        {tab === "info" && (
          <>
            <Field label="Tên dịch vụ" wide>
              <TextLine
                required
                maxLength={180}
                disabled={disabled}
                value={payload.title || ""}
                onChange={(e) =>
                  set({
                    title: e.target.value,
                    // The slug follows the name until the admin types a different one.
                    ...(!payload.slug ||
                    payload.slug === slugify(String(payload.title || ""))
                      ? { slug: slugify(e.target.value) || undefined }
                      : {}),
                  })
                }
              />
            </Field>
            <Field
              label="Đường dẫn trên website"
              help={
                payload.slug
                  ? `Trang: /dich-vu/${payload.slug}. Tự đổi theo tên dịch vụ cho đến khi bạn sửa tay. Đổi đường dẫn sẽ làm link cũ đã chia sẻ không còn mở được.`
                  : "Chữ thường không dấu, số và dấu gạch ngang. Để trống sẽ dùng đường dẫn hiện tại của dịch vụ."
              }
              wide
            >
              <div style={{ display: "flex", gap: 8 }}>
                <Input
                  maxLength={120}
                  disabled={disabled}
                  value={payload.slug || ""}
                  placeholder={slugify(String(payload.title || ""))}
                  onChange={(e) =>
                    set({ slug: slugify(e.target.value, true) || undefined })
                  }
                  onBlur={() =>
                    payload.slug &&
                    set({ slug: payload.slug.replace(/-+$/, "") || undefined })
                  }
                />
                {!payload.slug && payload.title && (
                  <Button
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      set({ slug: slugify(String(payload.title)) || undefined })
                    }
                  >
                    Tạo từ tên
                  </Button>
                )}
              </div>
            </Field>
            <Field
              label="Mô tả ngắn"
              help="Hiện trên thẻ dịch vụ và đầu trang chi tiết."
              wide
            >
              <Textarea
                maxLength={1000}
                disabled={disabled}
                value={payload.description || ""}
                onChange={(e) => set({ description: e.target.value })}
              />
            </Field>
            <ImageField
              label="Ảnh đại diện"
              value={payload.image}
              disabled={disabled}
              onChange={(image) => set({ image })}
            />
            <Field
              label="Giá tham khảo"
              help="Ví dụ: Từ 1.500.000đ (để trống nếu không hiển thị)."
            >
              <Input
                maxLength={60}
                disabled={disabled}
                value={payload.priceFrom || ""}
                onChange={(e) =>
                  set({ priceFrom: e.target.value || undefined })
                }
              />
            </Field>
            <Field
              label="Thời gian làm (phút)"
              help="Dùng để tính giờ trống khi khách đặt lịch và hiện ở /co-van, /dieu-hanh."
            >
              <Input
                type="number"
                min={15}
                max={1440}
                step={15}
                disabled={disabled}
                value={
                  payload.durationMinutes ??
                  opServices?.find((o) => o.marketingSlug === docKey)
                    ?.estimatedDurationMinutes ??
                  60
                }
                onChange={(e) =>
                  set({
                    durationMinutes: e.target.value
                      ? Math.min(
                          1440,
                          Math.max(15, Math.round(+e.target.value)),
                        )
                      : undefined,
                  })
                }
              />
            </Field>
            <Field label="Thứ tự hiển thị" help="Số nhỏ hiện trước.">
              <Input
                type="number"
                min={0}
                disabled={disabled}
                value={payload.order ?? ""}
                onChange={(e) =>
                  set({
                    order: e.target.value === "" ? undefined : +e.target.value,
                  })
                }
              />
            </Field>
          </>
        )}
        {tab === "intro" && (
          <>
            <RichText
              label="Bài giới thiệu dịch vụ"
              help="Hiển thị ở phần “Tổng quan” của trang chi tiết dịch vụ."
              initial={payload.body || defaultHtml}
              disabled={disabled}
              onChange={(body) => set({ body })}
            />
            <GalleryField
              label="Ảnh minh họa phần giới thiệu"
              value={payload.overviewImages}
              disabled={disabled}
              max={20}
              onChange={(overviewImages) => set({ overviewImages })}
            />
          </>
        )}
        {tab === "process" && (
          <>
            <Field label="Giới thiệu quy trình" wide>
              <Textarea
                maxLength={1000}
                disabled={disabled}
                value={payload.processIntroduction || ""}
                onChange={(e) => set({ processIntroduction: e.target.value })}
              />
            </Field>
            <Repeater
              label="Các bước"
              items={payload.process}
              disabled={disabled}
              addLabel="Thêm bước"
              create={() => ({ title: "", text: "" })}
              title={(s: { title: string; text: string }) => s.title}
              onChange={(process) => set({ process })}
              render={(s: { title: string; text: string }, up) => (
                <>
                  <Field label="Tên bước" wide>
                    <TextLine
                      maxLength={200}
                      value={s.title}
                      onChange={(e) => up({ title: e.target.value })}
                    />
                  </Field>
                  <Field label="Mô tả" wide>
                    <Textarea
                      maxLength={3000}
                      value={s.text}
                      onChange={(e) => up({ text: e.target.value })}
                    />
                  </Field>
                </>
              )}
            />
          </>
        )}
        {tab === "benefits" && (
          <>
            <Field label="Tiêu đề phần lợi ích">
              <TextLine
                maxLength={180}
                disabled={disabled}
                value={payload.benefitsTitle || ""}
                onChange={(e) => set({ benefitsTitle: e.target.value })}
              />
            </Field>
            <Field label="Giới thiệu" wide>
              <Textarea
                maxLength={1000}
                disabled={disabled}
                value={payload.benefitsIntroduction || ""}
                onChange={(e) => set({ benefitsIntroduction: e.target.value })}
              />
            </Field>
            <Repeater
              label="Lợi ích"
              items={payload.benefits}
              disabled={disabled}
              addLabel="Thêm lợi ích"
              create={() => ({ title: "", text: "" })}
              title={(s: { title: string; text: string }) => s.title}
              onChange={(benefits) => set({ benefits })}
              render={(s: { title: string; text: string }, up) => (
                <>
                  <Field label="Tiêu đề" wide>
                    <TextLine
                      maxLength={200}
                      value={s.title}
                      onChange={(e) => up({ title: e.target.value })}
                    />
                  </Field>
                  <Field label="Mô tả" wide>
                    <Textarea
                      maxLength={3000}
                      value={s.text}
                      onChange={(e) => up({ text: e.target.value })}
                    />
                  </Field>
                </>
              )}
            />
          </>
        )}
        {tab === "faq" && (
          <>
            <Field label="Giới thiệu phần câu hỏi" wide>
              <Textarea
                maxLength={1000}
                disabled={disabled}
                value={payload.faqIntroduction || ""}
                onChange={(e) => set({ faqIntroduction: e.target.value })}
              />
            </Field>
            <Repeater
              label="Câu hỏi thường gặp"
              items={payload.faq}
              disabled={disabled}
              addLabel="Thêm câu hỏi"
              create={() => ({ question: "", answer: "" })}
              title={(s: { question: string; answer: string }) => s.question}
              onChange={(faq) => set({ faq })}
              render={(s: { question: string; answer: string }, up) => (
                <>
                  <Field label="Câu hỏi" wide>
                    <TextLine
                      maxLength={300}
                      value={s.question}
                      onChange={(e) => up({ question: e.target.value })}
                    />
                  </Field>
                  <Field label="Trả lời" wide>
                    <Textarea
                      maxLength={3000}
                      value={s.answer}
                      onChange={(e) => up({ answer: e.target.value })}
                    />
                  </Field>
                </>
              )}
            />
          </>
        )}
        {tab === "gallery" && (
          <>
            <GalleryField
              label="Thư viện ảnh dịch vụ"
              help="Hiển thị ở cuối trang chi tiết dịch vụ."
              value={payload.gallery}
              disabled={disabled}
              onChange={(gallery) => set({ gallery })}
            />
            <GalleryField
              kind="video"
              max={2}
              label="Video dịch vụ"
              help="Tối đa 2 video, hiển thị cùng thư viện ảnh. MP4 (H.264) hoặc WebM, tối đa 100 MB."
              value={payload.videos}
              disabled={disabled}
              onChange={(videos) => set({ videos })}
            />
          </>
        )}
      </div>
    </Card>
  );
}
export function ServiceEditor({ slug }: { slug: string | null }) {
  const d = find(defaultServices, slug);
  return (
    <DocumentEditor
      kind="SERVICE"
      docKey={slug}
      takenKeys={defaultServices.map((x) => x.key)}
      basePath="/admin/dich-vu"
      back={{ href: "/admin/dich-vu", label: "Dịch vụ" }}
      title={(p) => p.title}
      description="Nội dung trang chi tiết dịch vụ: thông tin, bài giới thiệu, quy trình, lợi ích, câu hỏi và thư viện ảnh."
      defaults={d?.payload || null}
      defaultHtml={d?.html}
      previewPath={(k, p) => `/dich-vu/${p.slug || k}`}
      render={(e) => <ServiceForm {...e} docKey={slug} />}
    />
  );
}

/* ---------------- News ---------------- */
export function NewsList() {
  return (
    <ContentList
      kind="NEWS"
      title="Tin tức"
      description="Bài viết, tin mới và ưu đãi hiển thị ở trang Tin tức và trang chủ."
      basePath="/admin/tin-tuc"
      icon="newspaper"
      noun="bài viết"
      newLabel="Viết bài mới"
      defaults={defaultArticles}
      columns={[
        {
          label: "Chuyên mục",
          cell: (r) =>
            r.meta.category ? (
              <Badge tone="info">{r.meta.category}</Badge>
            ) : (
              "—"
            ),
          filter: (r) => r.meta.category || "",
        },
        {
          label: "Ngày đăng",
          cell: (r) =>
            r.meta.publishAt && new Date(r.meta.publishAt) > new Date() ? (
              <Badge tone="purple">
                Hẹn {new Date(r.meta.publishAt).toLocaleString("vi-VN")}
              </Badge>
            ) : r.meta.date ? (
              new Date(r.meta.date).toLocaleDateString("vi-VN")
            ) : (
              "—"
            ),
        },
      ]}
    />
  );
}
const categories = [
  ...new Set(defaultArticles.map((a) => a.payload.category).filter(Boolean)),
];
const toLocal = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(+d - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
export function NewsEditor({ slug }: { slug: string | null }) {
  const d = find(defaultArticles, slug);
  return (
    <DocumentEditor
      kind="NEWS"
      docKey={slug}
      takenKeys={defaultArticles.map((x) => x.key)}
      basePath="/admin/tin-tuc"
      back={{ href: "/admin/tin-tuc", label: "Tin tức" }}
      title={(p) => p.title}
      defaults={d?.payload || null}
      defaultHtml={d?.html}
      previewPath={(k) => `/tin-tuc/${k}`}
      render={({ payload, set, disabled, defaultHtml }) => (
        <>
          <Card title="Thông tin bài viết">
            <div className="cms-form-grid">
              <Field label="Tiêu đề" wide>
                <TextLine
                  required
                  maxLength={180}
                  disabled={disabled}
                  value={payload.title || ""}
                  onChange={(e) => set({ title: e.target.value })}
                />
              </Field>
              <Field
                label="Mô tả ngắn"
                help="Hiện trên thẻ bài viết và kết quả tìm kiếm."
                wide
              >
                <Textarea
                  maxLength={1000}
                  disabled={disabled}
                  value={payload.description || ""}
                  onChange={(e) => set({ description: e.target.value })}
                />
              </Field>
              <Field label="Chuyên mục">
                <Input
                  list="cms-news-categories"
                  maxLength={80}
                  disabled={disabled}
                  value={payload.category || ""}
                  onChange={(e) => set({ category: e.target.value })}
                />
                <datalist id="cms-news-categories">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
              <Field label="Tác giả">
                <Input
                  maxLength={120}
                  disabled={disabled}
                  value={payload.author || ""}
                  onChange={(e) => set({ author: e.target.value || undefined })}
                />
              </Field>
              <Field label="Ngày đăng">
                <Input
                  type="date"
                  required
                  disabled={disabled}
                  value={payload.date || ""}
                  onChange={(e) => set({ date: e.target.value })}
                />
              </Field>
              <Field label="Hẹn giờ đăng" help="Để trống để đăng ngay khi lưu.">
                <Input
                  type="datetime-local"
                  disabled={disabled}
                  value={toLocal(payload.publishAt)}
                  onChange={(e) =>
                    set({
                      publishAt: e.target.value
                        ? new Date(e.target.value).toISOString()
                        : undefined,
                    })
                  }
                />
              </Field>
              <ImageField
                label="Ảnh đại diện (bắt buộc)"
                value={payload.image}
                disabled={disabled}
                onChange={(image) => set({ image })}
              />
            </div>
          </Card>
          <Card title="Nội dung bài viết">
            <RichText
              label="Nội dung"
              initial={payload.body || defaultHtml}
              disabled={disabled}
              onChange={(body) => set({ body })}
            />
          </Card>
        </>
      )}
    />
  );
}

/* ---------------- Accessories ---------------- */
export function AccessoriesList() {
  const catalog = useCatalog();
  const name = (list: { id: string; name: string }[] | undefined, v: unknown) =>
    (list && catalogEntry(list, v)?.name) || String(v || "");
  return (
    <ContentList
      kind="ACCESSORY"
      title="Phụ kiện"
      description="Sản phẩm ở trang Phụ kiện; sản phẩm “nổi bật” hiện ở trang chủ."
      basePath="/admin/phu-kien"
      icon="package"
      noun="sản phẩm"
      newLabel="Thêm sản phẩm"
      defaults={defaultAccessories}
      columns={[
        {
          label: "Thương hiệu",
          cell: (r) => name(catalog?.brands, r.meta.brand) || "—",
          filter: (r) => name(catalog?.brands, r.meta.brand),
        },
        {
          label: "Danh mục",
          cell: (r) =>
            r.meta.category ? (
              <Badge tone="info">
                {name(catalog?.categories, r.meta.category)}
              </Badge>
            ) : (
              "—"
            ),
        },
        { label: "Giá", cell: (r) => <strong>{money(r.meta.price)}</strong> },
        {
          label: "Trang chủ (tối đa 4)",
          cell: (r, list) => <FeaturedToggle row={r} {...list} />,
        },
      ]}
    />
  );
}
const FEATURED_MAX = 4;
/** Toggles "featured on the homepage" straight from the list: saves and applies at once. */
function FeaturedToggle({
  row,
  rows,
  reload,
}: {
  row: Row;
  rows: Row[];
  reload: () => void;
}) {
  const session = useSession(),
    toast = useToast(),
    [busy, setBusy] = useState(false);
  const on = !!row.meta.featured,
    count = rows.filter((r) => r.meta.featured).length,
    full = !on && count >= FEATURED_MAX;
  const toggle = async (featured: boolean) => {
    setBusy(true);
    try {
      const doc = await findDocument("ACCESSORY", row.key);
      const payload = {
        ...(doc?.revisions[0]?.payload ||
          find(defaultAccessories, row.key)?.payload),
        featured: featured || undefined,
      };
      const saved = doc
        ? await api.save(doc.id, doc.version, payload)
        : await api.create("ACCESSORY", row.key, payload, row.isDefault);
      await api.publish(
        saved.data.id,
        saved.data.version,
        saved.data.revisionId,
        featured ? "Hiện ở trang chủ" : "Bỏ khỏi trang chủ",
      );
      toast(
        "success",
        featured ? "Đã hiện ở trang chủ." : "Đã bỏ khỏi trang chủ.",
      );
      reload();
    } catch (e) {
      toast("danger", errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <span
      title={
        full
          ? `Trang chủ chỉ hiện ${FEATURED_MAX} sản phẩm. Tắt một sản phẩm khác trước.`
          : undefined
      }
    >
      <Switch
        label={on ? "Đang hiện" : "Ẩn"}
        checked={on}
        disabled={busy || full || !session?.permissions.includes("cms.publish")}
        onChange={(v) => void toggle(v)}
      />
    </span>
  );
}
/** Select over the admin catalogue; a value no longer in it stays selectable until changed. */
function CatalogSelect({
  list,
  value,
  empty,
  disabled,
  onChange,
}: {
  list: { id: string; name: string }[] | undefined;
  value: unknown;
  empty: string;
  disabled: boolean;
  onChange: (id: string) => void;
}) {
  const v = String(value || ""),
    match = list && catalogEntry(list, v);
  return (
    <Select
      required
      disabled={disabled || !list}
      value={match ? match.id : v}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{list ? empty : "Đang tải…"}</option>
      {list && v && !match && (
        <option value={v}>{v} (không còn trong danh sách)</option>
      )}
      {list?.map((x) => (
        <option key={x.id} value={x.id}>
          {x.name}
        </option>
      ))}
    </Select>
  );
}
export function AccessoryEditor({ slug }: { slug: string | null }) {
  const d = find(defaultAccessories, slug);
  const catalog = useCatalog();
  return (
    <DocumentEditor
      kind="ACCESSORY"
      docKey={slug}
      takenKeys={defaultAccessories.map((x) => x.key)}
      basePath="/admin/phu-kien"
      back={{ href: "/admin/phu-kien", label: "Phụ kiện" }}
      title={(p) => p.name}
      slugFrom="name"
      defaults={d?.payload || null}
      previewPath={(key) => "/phu-kien/" + key}
      render={({ payload, set, disabled }) => (
        <>
          <Card title="Thông tin sản phẩm">
            <div className="cms-form-grid">
              <Field label="Tên sản phẩm" wide>
                <TextLine
                  required
                  maxLength={180}
                  disabled={disabled}
                  value={payload.name || ""}
                  onChange={(e) => set({ name: e.target.value })}
                />
              </Field>
              <Field
                label="Thương hiệu"
                help="Thêm hoặc sửa ở mục “Thương hiệu & danh mục”."
              >
                <CatalogSelect
                  list={catalog?.brands}
                  value={payload.brand}
                  empty="Chọn thương hiệu"
                  disabled={disabled}
                  onChange={(brand) => set({ brand })}
                />
              </Field>
              <Field label="Danh mục">
                <CatalogSelect
                  list={catalog?.categories}
                  value={payload.category}
                  empty="Chọn danh mục"
                  disabled={disabled}
                  onChange={(category) => set({ category })}
                />
              </Field>
              <Field label="Giá bán (đ)" help="Để trống sẽ hiển thị “Liên hệ”.">
                <Input
                  inputMode="numeric"
                  disabled={disabled}
                  value={
                    payload.price == null
                      ? ""
                      : payload.price.toLocaleString("vi-VN")
                  }
                  onChange={(e) => set({ price: num(e.target.value) })}
                />
              </Field>
              <Field label="Giá khuyến mãi (đ)" help="Không bắt buộc.">
                <Input
                  inputMode="numeric"
                  disabled={disabled}
                  value={
                    payload.salePrice == null
                      ? ""
                      : payload.salePrice.toLocaleString("vi-VN")
                  }
                  onChange={(e) => set({ salePrice: num(e.target.value) })}
                />
              </Field>
              <Field label="Mô tả" wide>
                <Textarea
                  maxLength={2000}
                  disabled={disabled}
                  value={payload.description || ""}
                  onChange={(e) => set({ description: e.target.value })}
                />
              </Field>
              <Field label="Thứ tự hiển thị">
                <Input
                  type="number"
                  min={0}
                  disabled={disabled}
                  value={payload.order ?? ""}
                  onChange={(e) =>
                    set({
                      order:
                        e.target.value === "" ? undefined : +e.target.value,
                    })
                  }
                />
              </Field>
              <Field label="Trang chủ">
                <Switch
                  label="Hiện ở mục phụ kiện nổi bật trang chủ (tối đa 4 sản phẩm, bật/tắt nhanh ở danh sách)"
                  checked={!!payload.featured}
                  disabled={disabled}
                  onChange={(featured) =>
                    set({ featured: featured || undefined })
                  }
                />
              </Field>
              <Field
                label="Link tham khảo của hãng"
                help="Không hiển thị cho khách."
                wide
              >
                <Input
                  maxLength={600}
                  disabled={disabled}
                  value={payload.source || ""}
                  onChange={(e) => set({ source: e.target.value || undefined })}
                />
              </Field>
            </div>
          </Card>
          <Card title="Ảnh sản phẩm">
            <div className="cms-form-grid">
              <GalleryField
                label="Ảnh"
                help="Ảnh đầu tiên là ảnh chính trên thẻ sản phẩm."
                value={payload.images}
                disabled={disabled}
                max={20}
                onChange={(images) => set({ images })}
              />
            </div>
          </Card>
          <Card title="Trang chi tiết sản phẩm">
            <div className="cms-form-grid">
              <Repeater
                label="Điểm nổi bật"
                help="3–5 dòng ngắn, hiện cạnh giá với dấu ✓."
                items={payload.highlights}
                disabled={disabled}
                max={8}
                addLabel="Thêm điểm nổi bật"
                create={() => ({ text: "" })}
                title={(h: { text: string }) => h.text}
                onChange={(highlights) => set({ highlights })}
                render={(h: { text: string }, up) => (
                  <Field label="Nội dung" wide>
                    <TextLine
                      maxLength={200}
                      value={h.text}
                      onChange={(e) => up({ text: e.target.value })}
                    />
                  </Field>
                )}
              />
              <RichText
                label="Giới thiệu sản phẩm"
                help="Chữ, ảnh, video YouTube. Hiện ở mục “Giới thiệu” trên trang chi tiết."
                initial={payload.body}
                disabled={disabled}
                onChange={(body) => set({ body })}
              />
              <Repeater
                label="Thông số kỹ thuật"
                help="Bật “Hiện dưới ảnh” cho tối đa 4 thông số chính; sản phẩm không bật thông số nào thì dải này không hiện."
                items={payload.specs}
                disabled={disabled}
                max={40}
                addLabel="Thêm thông số"
                create={(): Spec => ({ label: "", value: "" })}
                title={(x: Spec) =>
                  (x.key ? "★ " : "") +
                  [x.label, x.value].filter(Boolean).join(": ")
                }
                onChange={(specs) => set({ specs })}
                render={(x: Spec, up) => (
                  <>
                    <Field label="Hiện dưới ảnh sản phẩm" wide>
                      <Switch
                        label="Thông số chính"
                        checked={!!x.key}
                        disabled={
                          disabled ||
                          (!x.key &&
                            ((payload.specs || []) as Spec[]).filter(
                              (s) => s.key,
                            ).length >= 4)
                        }
                        onChange={(v) => up({ key: v || undefined })}
                      />
                    </Field>
                    <Field label="Icon" help="Hiện cạnh thông số dưới ảnh.">
                      <Select
                        value={x.icon || ""}
                        disabled={disabled}
                        onChange={(e) =>
                          up({
                            icon: (e.target.value || undefined) as Spec["icon"],
                          })
                        }
                      >
                        <option value="">Không có icon</option>
                        {specIcons.map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Tên thông số" help="Ví dụ: Độ phân giải">
                      <Input
                        maxLength={80}
                        value={x.label}
                        onChange={(e) => up({ label: e.target.value })}
                      />
                    </Field>
                    <Field
                      label="Giá trị"
                      help="Ví dụ: 4K 3840×2160. Thông số chính nên ngắn, ví dụ: 4K"
                    >
                      <Input
                        maxLength={200}
                        value={x.value}
                        onChange={(e) => up({ value: e.target.value })}
                      />
                    </Field>
                  </>
                )}
              />
              <Repeater
                label="Trong hộp có gì"
                help="Không bắt buộc. Để trống thì khối này không hiện."
                items={payload.inBox}
                disabled={disabled}
                max={20}
                addLabel="Thêm món"
                create={() => ({ title: "", image: null })}
                title={(x: { title: string; image?: ImageValue | null }) =>
                  x.title
                }
                onChange={(inBox) => set({ inBox })}
                render={(
                  x: { title: string; image?: ImageValue | null },
                  up,
                ) => (
                  <>
                    <Field label="Tên món" wide>
                      <Input
                        maxLength={120}
                        value={x.title}
                        onChange={(e) => up({ title: e.target.value })}
                      />
                    </Field>
                    <ImageField
                      label="Ảnh"
                      value={x.image}
                      onChange={(image) => up({ image })}
                    />
                  </>
                )}
              />
              <Repeater
                label="Câu hỏi thường gặp"
                help="Không bắt buộc. Để trống thì khối này không hiện."
                items={payload.faq}
                disabled={disabled}
                max={40}
                addLabel="Thêm câu hỏi"
                create={() => ({ question: "", answer: "" })}
                title={(x: { question: string; answer: string }) => x.question}
                onChange={(faq) => set({ faq })}
                render={(x: { question: string; answer: string }, up) => (
                  <>
                    <Field label="Câu hỏi" wide>
                      <TextLine
                        maxLength={300}
                        value={x.question}
                        onChange={(e) => up({ question: e.target.value })}
                      />
                    </Field>
                    <Field label="Trả lời" wide>
                      <Textarea
                        maxLength={3000}
                        value={x.answer}
                        onChange={(e) => up({ answer: e.target.value })}
                      />
                    </Field>
                  </>
                )}
              />
            </div>
          </Card>
        </>
      )}
    />
  );
}

/* ---------------- Projects ---------------- */
export function ProjectsList() {
  return (
    <ContentList
      kind="PROJECT"
      title="Thành quả"
      description="Dự án trước / sau hiển thị ở trang Thành quả."
      basePath="/admin/thanh-qua"
      icon="award"
      noun="dự án"
      newLabel="Thêm dự án"
      defaults={defaultProjects}
      columns={[{ label: "Xe", cell: (r) => r.meta.vehicle || "—" }]}
    />
  );
}
export function ProjectEditor({ slug }: { slug: string | null }) {
  const d = find(defaultProjects, slug);
  return (
    <DocumentEditor
      kind="PROJECT"
      docKey={slug}
      takenKeys={defaultProjects.map((x) => x.key)}
      basePath="/admin/thanh-qua"
      back={{ href: "/admin/thanh-qua", label: "Thành quả" }}
      title={(p) => p.title}
      defaults={d?.payload || null}
      previewPath={() => "/thanh-qua"}
      render={({ payload, set, disabled }) => (
        <>
          <Card title="Thông tin dự án">
            <div className="cms-form-grid">
              <Field label="Tiêu đề" wide>
                <TextLine
                  required
                  maxLength={180}
                  disabled={disabled}
                  value={payload.title || ""}
                  onChange={(e) => set({ title: e.target.value })}
                />
              </Field>
              <Field label="Dòng xe">
                <Input
                  maxLength={180}
                  disabled={disabled}
                  value={payload.vehicle || ""}
                  onChange={(e) => set({ vehicle: e.target.value })}
                />
              </Field>
              <Field label="Thời gian thực hiện">
                <Input
                  maxLength={80}
                  disabled={disabled}
                  value={payload.duration || ""}
                  onChange={(e) => set({ duration: e.target.value })}
                />
              </Field>
              <Field label="Dịch vụ đã làm" wide>
                <Input
                  maxLength={300}
                  disabled={disabled}
                  value={payload.services || ""}
                  onChange={(e) => set({ services: e.target.value })}
                />
              </Field>
              <Field label="Mô tả" wide>
                <Textarea
                  maxLength={2000}
                  disabled={disabled}
                  value={payload.description || ""}
                  onChange={(e) => set({ description: e.target.value })}
                />
              </Field>
              <Field label="Thứ tự hiển thị">
                <Input
                  type="number"
                  min={0}
                  disabled={disabled}
                  value={payload.order ?? ""}
                  onChange={(e) =>
                    set({
                      order:
                        e.target.value === "" ? undefined : +e.target.value,
                    })
                  }
                />
              </Field>
            </div>
          </Card>
          <Card title="Ảnh trước / sau">
            <div className="cms-form-grid">
              <ImageField
                label="Ảnh trước khi làm"
                value={payload.before}
                disabled={disabled}
                onChange={(before) => set({ before })}
              />
              <ImageField
                label="Ảnh sau khi làm"
                value={payload.after}
                disabled={disabled}
                onChange={(after) => set({ after })}
              />
            </div>
          </Card>
        </>
      )}
    />
  );
}
