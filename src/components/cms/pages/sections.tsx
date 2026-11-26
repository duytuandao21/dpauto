"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { homeDefaults, homeOrder, type HomeKey } from "@/lib/home-defaults";
import { legalHtml, pageDefaults, type PageKey } from "@/lib/page-defaults";
import { CmsIcon, type CmsIconName } from "../icon";
import { DocumentEditor, type EditorApi } from "../editor";
import { GalleryField, ImageField, LinkFields, Repeater } from "../fields";
import { RichText } from "../rich-text";
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  Field,
  Input,
  Loading,
  PageHeader,
  Select,
  Switch,
  Tabs,
  Textarea,
  TextLine,
  errorText,
  timeAgo,
  useToast,
} from "../ui";
import {
  api,
  findDocument,
  statusLabel,
  statusOf,
  useDocuments,
  type Payload,
} from "../data";

type Top =
  | "title"
  | "subtitle"
  | "description"
  | "note"
  | "image"
  | "photo2"
  | "images"
  | "videos"
  | "slides"
  | "cta"
  | "cta2"
  | "body"
  | "items";
type ItemField =
  "title" | "text" | "image" | "href" | "price" | "meta" | "author" | "label";
type Config = {
  label: string;
  icon: CmsIconName;
  hint: string;
  preview: string;
  fields: Top[];
  labels?: Partial<Record<Top, string>>;
  help?: Partial<Record<Top, string>>;
  items?: {
    label: string;
    add: string;
    fields: ItemField[];
    labels?: Partial<Record<ItemField, string>>;
    title: (i: Payload) => string;
    max?: number;
  };
  bodyHtml?: string;
  related?: { href: string; text: string };
};

export const homeConfig: Record<HomeKey, Config> = {
  "home.hero": {
    label: "Hero (đầu trang)",
    icon: "home",
    hint: "Ảnh đầu trang, tự chuyển khi có nhiều ảnh.",
    preview: "/",
    fields: ["title", "slides"],
    labels: {
      title: "Tiêu đề trang (không hiện trên ảnh)",
      slides: "Ảnh hero",
    },
    help: {
      title: "Dùng cho Google và trình đọc màn hình.",
      slides:
        "Tối đa 10 ảnh, tự chuyển sau 5 giây theo thứ tự trên. Nên dùng ảnh ngang khoảng 1920×840; trên điện thoại ảnh được cắt gọn hai bên theo tỉ lệ 3:2.",
    },
  },
  "home.services": {
    label: "Dịch vụ",
    icon: "wrench",
    hint: "Tiêu đề và mô tả khối dịch vụ.",
    preview: "/#services",
    fields: ["title", "description"],
    related: {
      href: "/admin/dich-vu",
      text: "Danh sách dịch vụ quản lý ở mục Dịch vụ.",
    },
  },
  "home.accessories": {
    label: "Phụ kiện nổi bật",
    icon: "package",
    hint: "Tiêu đề, mô tả và nút xem thêm.",
    preview: "/#accessories",
    fields: ["title", "description", "note", "cta"],
    labels: { note: "Câu hỏi dưới danh sách", cta: "Nút xem thêm" },
    related: {
      href: "/admin/phu-kien",
      text: "Chọn sản phẩm “nổi bật” ở mục Phụ kiện (tối đa 4 sản phẩm hiển thị).",
    },
  },
  "home.process": {
    label: "Quy trình",
    icon: "layers",
    hint: "Các bước chăm sóc xe và ảnh minh họa.",
    preview: "/#Our%20Service%20Process",
    fields: ["title", "image", "note", "items"],
    labels: { note: "Ghi chú trên ảnh" },
    items: {
      label: "Các bước",
      add: "Thêm bước",
      fields: ["title", "text"],
      title: (i) => i.title,
    },
  },
  "home.pricing": {
    label: "Bảng giá",
    icon: "file",
    hint: "Bảng giá tham khảo theo nhóm dịch vụ.",
    preview: "/#pricing",
    fields: ["title", "description", "subtitle", "note", "cta", "items"],
    labels: {
      subtitle: "Tiêu đề bảng giá",
      note: "Dòng chữ dưới bảng",
      cta: "Nút tư vấn",
    },
    help: { cta: "Để trống đường dẫn để gọi số điện thoại trong Cài đặt." },
    items: {
      label: "Dòng giá",
      add: "Thêm dòng giá",
      fields: ["meta", "title", "price", "href"],
      labels: {
        meta: "Nhóm (cột)",
        title: "Tên dịch vụ",
        price: "Giá",
        href: "Link (không bắt buộc)",
      },
      title: (i) =>
        `${i.meta ? `[${i.meta}] ` : ""}${i.title || ""}${i.price ? ` — ${i.price}` : ""}`,
    },
  },
  "home.work": {
    label: "Thành quả",
    icon: "award",
    hint: "Tiêu đề khối so sánh trước/sau.",
    preview: "/",
    fields: ["title", "description", "cta"],
    labels: { cta: "Nút xem thêm" },
    related: {
      href: "/admin/thanh-qua",
      text: "Ảnh trước/sau lấy từ mục Thành quả.",
    },
  },
  "home.gallery": {
    label: "Hình ảnh xưởng",
    icon: "image",
    hint: "4 ảnh và nút theo dõi mạng xã hội.",
    preview: "/",
    fields: ["title", "images", "videos", "cta", "cta2"],
    labels: {
      images: "Ảnh (4 ô)",
      videos: "Video (2 ô)",
      cta: "Nút Facebook",
      cta2: "Nút TikTok",
    },
    help: {
      images:
        "Bố cục có 4 ô ảnh xen kẽ 2 video; ảnh thứ 5 trở đi không hiển thị.",
      videos:
        "Video MP4 (H.264) hoặc WebM, tối đa 100 MB, nên quay dọc. Ô để trống sẽ dùng video mặc định.",
    },
  },
  "home.benefits": {
    label: "Vì sao chọn chúng tôi",
    icon: "star",
    hint: "Ảnh nền và các lý do.",
    preview: "/",
    fields: ["title", "image", "items"],
    items: {
      label: "Lý do",
      add: "Thêm lý do",
      fields: ["title", "text"],
      title: (i) => i.title,
      max: 12,
    },
  },
  "home.reviews": {
    label: "Đánh giá khách hàng",
    icon: "users",
    hint: "Các đánh giá chạy ngang trên trang chủ.",
    preview: "/",
    fields: ["title", "description", "items"],
    items: {
      label: "Đánh giá",
      add: "Thêm đánh giá",
      fields: ["author", "meta", "text", "image", "label"],
      labels: {
        author: "Tên khách hàng",
        meta: "Dịch vụ · dòng xe",
        text: "Nội dung",
        image: "Ảnh (không bắt buộc)",
        label: "Kiểu thẻ có ảnh",
      },
      title: (i) => `${i.author || ""}${i.meta ? ` · ${i.meta}` : ""}`,
    },
  },
  "home.brands": {
    label: "Thương hiệu",
    icon: "globe",
    hint: "Logo các thương hiệu.",
    preview: "/#brands",
    fields: ["title", "description", "images"],
    labels: { images: "Logo" },
    help: {
      images: "Nên dùng logo PNG nền trong suốt; mô tả ảnh là tên thương hiệu.",
    },
  },
  "home.news": {
    label: "Tin tức",
    icon: "newspaper",
    hint: "Tiêu đề khối tin mới.",
    preview: "/",
    fields: ["title"],
    related: {
      href: "/admin/tin-tuc",
      text: "Bài viết quản lý ở mục Tin tức (4 bài mới nhất hiển thị).",
    },
  },
  "home.faq": {
    label: "Câu hỏi thường gặp",
    icon: "help",
    hint: "Câu hỏi ở trang chủ và trang Liên hệ.",
    preview: "/",
    fields: ["title", "description", "items"],
    items: {
      label: "Câu hỏi",
      add: "Thêm câu hỏi",
      fields: ["title", "text"],
      labels: { title: "Câu hỏi", text: "Trả lời" },
      title: (i) => i.title,
    },
  },
  "home.location": {
    label: "Vị trí cửa hàng",
    icon: "phone",
    hint: "Tiêu đề khối bản đồ.",
    preview: "/",
    fields: ["title"],
    related: {
      href: "/admin/cai-dat",
      text: "Địa chỉ, điện thoại, giờ mở cửa và bản đồ lấy từ Cài đặt website.",
    },
  },
  "home.cta": {
    label: "Kêu gọi cuối trang",
    icon: "send",
    hint: "Khối liên hệ ở cuối trang chủ và nhiều trang khác.",
    preview: "/",
    fields: ["title", "description", "image", "cta2"],
    labels: { cta2: "Nút gọi điện" },
    help: {
      cta2: "Để trống đường dẫn để dùng số điện thoại trong Cài đặt. Nút chính luôn là “Đặt lịch ngay” (mở form đặt lịch).",
    },
  },
};
export const pageConfig: Record<PageKey, Config> = {
  about: {
    label: "Giới thiệu",
    icon: "users",
    hint: "Banner và các khối nội dung của trang giới thiệu.",
    preview: "/gioi-thieu",
    fields: ["title", "image"],
    labels: {
      title: "Tiêu đề banner",
      image: "Ảnh banner",
    },
  },
  contact: {
    label: "Liên hệ",
    icon: "phone",
    hint: "Banner và nội dung thêm dưới bản đồ.",
    preview: "/lien-he",
    fields: ["title", "image", "body"],
    labels: {
      title: "Tiêu đề banner",
      image: "Ảnh banner",
      body: "Nội dung thêm",
    },
    help: { body: "Không bắt buộc, hiển thị dưới bản đồ." },
    related: {
      href: "/admin/cai-dat",
      text: "Thông tin liên hệ lấy từ Cài đặt website.",
    },
  },
  services: {
    label: "Trang Dịch vụ",
    icon: "wrench",
    hint: "Banner đầu trang.",
    preview: "/dich-vu",
    fields: ["title", "image"],
    labels: { title: "Tiêu đề banner", image: "Ảnh banner" },
  },
  "our-work": {
    label: "Trang Thành quả",
    icon: "award",
    hint: "Banner đầu trang.",
    preview: "/thanh-qua",
    fields: ["title", "image"],
    labels: { title: "Tiêu đề banner", image: "Ảnh banner" },
  },
  news: {
    label: "Trang Tin tức",
    icon: "newspaper",
    hint: "Banner đầu trang.",
    preview: "/tin-tuc",
    fields: ["title", "image"],
    labels: { title: "Tiêu đề banner", image: "Ảnh banner" },
  },
  "phu-kien": {
    label: "Trang Phụ kiện",
    icon: "package",
    hint: "Tiêu đề, mô tả đầu trang và câu hỏi thường gặp.",
    preview: "/phu-kien",
    fields: ["title", "description", "items"],
    help: {
      items:
        "Hiển thị ở mục Câu hỏi thường gặp dưới danh sách sản phẩm. Xóa hết câu hỏi thì mục này ẩn.",
    },
    items: {
      label: "Câu hỏi thường gặp",
      add: "Thêm câu hỏi",
      fields: ["title", "text"],
      labels: { title: "Câu hỏi", text: "Trả lời" },
      title: (i) => i.title,
    },
  },
  privacy: {
    label: "Chính sách bảo mật",
    icon: "file",
    hint: "Nội dung chính sách.",
    preview: "/chinh-sach-bao-mat",
    fields: ["title", "body"],
    labels: { body: "Nội dung" },
    bodyHtml: legalHtml.privacy,
  },
  terms: {
    label: "Điều khoản sử dụng",
    icon: "file",
    hint: "Nội dung điều khoản.",
    preview: "/dieu-khoan-dich-vu",
    fields: ["title", "body"],
    labels: { body: "Nội dung" },
    bodyHtml: legalHtml.terms,
  },
};
/** Blocks of the About page, stored under `parts` of the "about" document. */
const aboutParts: Record<string, Config> = {
  story: {
    label: "Câu chuyện",
    icon: "users",
    hint: "Khối câu chuyện ngay dưới banner.",
    preview: "/gioi-thieu",
    fields: ["subtitle", "title", "description", "note", "images", "videos"],
    labels: {
      subtitle: "Nhãn nhỏ",
      description: "Đoạn mở đầu",
      note: "Đoạn mô tả",
      images: "Ảnh (3 ảnh)",
      videos: "Video",
    },
    help: {
      description: "Câu đầu tiên (đến dấu chấm) được in đậm.",
      images:
        "Thứ tự: ảnh nổi trên bên trái, ảnh nổi bên phải, ảnh giữa cạnh đoạn mô tả.",
      videos: "Dùng video đầu tiên.",
    },
  },
  approach: {
    label: "Cách làm việc",
    icon: "users",
    hint: "Các bước làm việc được đánh số 01, 02…",
    preview: "/gioi-thieu",
    fields: ["title", "items"],
    help: { title: "Phần sau dấu phẩy đầu tiên xuống dòng." },
    items: {
      label: "Các bước",
      add: "Thêm bước",
      fields: ["title", "text"],
      title: (i) => i.title,
    },
  },
  workshop: {
    label: "Xưởng",
    icon: "users",
    hint: "Ảnh xưởng lớn và các điểm nổi bật.",
    preview: "/gioi-thieu",
    fields: ["title", "description", "image", "items"],
    labels: { image: "Ảnh xưởng" },
    items: {
      label: "Điểm nổi bật",
      add: "Thêm điểm nổi bật",
      fields: ["title", "text"],
      title: (i) => i.title,
    },
  },
  team: {
    label: "Đội ngũ",
    icon: "users",
    hint: "Giới thiệu đội ngũ và ảnh toàn đội.",
    preview: "/gioi-thieu",
    fields: ["title", "description", "note", "image", "photo2"],
    labels: {
      description: "Đoạn mở đầu",
      note: "Đoạn mô tả",
      image: "Ảnh cạnh chữ",
      photo2: "Ảnh toàn đội (khổ lớn)",
    },
  },
};
const topLabel: Record<Top, string> = {
  title: "Tiêu đề",
  subtitle: "Tiêu đề phụ",
  description: "Mô tả",
  note: "Ghi chú",
  image: "Ảnh",
  photo2: "Ảnh phụ",
  images: "Ảnh",
  videos: "Video",
  slides: "Ảnh tự chuyển",
  cta: "Nút",
  cta2: "Nút thứ hai",
  body: "Nội dung",
  items: "Mục",
};
const itemLabel: Record<ItemField, string> = {
  title: "Tiêu đề",
  text: "Mô tả",
  image: "Ảnh",
  href: "Đường dẫn",
  price: "Giá",
  meta: "Nhóm",
  author: "Tác giả",
  label: "Kiểu",
};

function SectionForm({
  config,
  payload,
  set,
  disabled,
}: EditorApi & { config: Config }) {
  const L = (f: Top) => config.labels?.[f] || topLabel[f],
    H = (f: Top) => config.help?.[f];
  const text = config.fields.filter((f) =>
    ["title", "subtitle", "description", "note"].includes(f),
  );
  const media = config.fields.filter((f) =>
    ["image", "photo2", "images", "videos", "slides"].includes(f),
  );
  const buttons = config.fields.filter((f) => f === "cta" || f === "cta2");
  return (
    <>
      {config.related && (
        <Alert tone="info">
          {config.related.text}{" "}
          <Link className="cms-link" href={config.related.href}>
            Mở →
          </Link>
        </Alert>
      )}
      {text.length > 0 && (
        <Card title="Nội dung chữ">
          <div className="cms-form-grid">
            {text.map((f) =>
              f === "description" || f === "note" ? (
                <Field key={f} label={L(f)} help={H(f)} wide>
                  <Textarea
                    maxLength={f === "note" ? 600 : 1000}
                    disabled={disabled}
                    value={payload[f] || ""}
                    onChange={(e) => set({ [f]: e.target.value })}
                  />
                </Field>
              ) : (
                <Field key={f} label={L(f)} help={H(f)} wide>
                  <TextLine
                    maxLength={f === "subtitle" ? 200 : 180}
                    disabled={disabled}
                    value={payload[f] || ""}
                    onChange={(e) => set({ [f]: e.target.value })}
                  />
                </Field>
              ),
            )}
          </div>
        </Card>
      )}
      {media.length > 0 && (
        <Card title="Hình ảnh">
          <div className="cms-form-grid">
            {media.map((f) =>
              f === "videos" ? (
                <GalleryField
                  key={f}
                  kind="video"
                  max={2}
                  label={L(f)}
                  help={H(f)}
                  value={payload.videos}
                  disabled={disabled}
                  onChange={(videos) => set({ videos })}
                />
              ) : f === "slides" ? (
                <GalleryField
                  key={f}
                  max={10}
                  label={L(f)}
                  help={H(f)}
                  value={payload.slides}
                  disabled={disabled}
                  onChange={(slides) => set({ slides })}
                />
              ) : f === "images" ? (
                <GalleryField
                  key={f}
                  label={L(f)}
                  help={H(f)}
                  value={payload.images}
                  disabled={disabled}
                  onChange={(images) => set({ images })}
                />
              ) : f === "photo2" ? (
                <ImageField
                  key={f}
                  label={L(f)}
                  help={H(f)}
                  value={payload.images?.[0]}
                  disabled={disabled}
                  onChange={(img) =>
                    set({
                      images: img
                        ? [img, ...(payload.images || []).slice(1)]
                        : (payload.images || []).slice(1),
                    })
                  }
                />
              ) : (
                <ImageField
                  key={f}
                  label={L(f)}
                  help={H(f)}
                  value={payload.image}
                  disabled={disabled}
                  onChange={(image) => set({ image })}
                />
              ),
            )}
          </div>
        </Card>
      )}
      {buttons.length > 0 && (
        <Card title="Nút bấm">
          <div className="cms-form-grid">
            {buttons.map((f) => (
              <LinkFields
                key={f}
                label={L(f)}
                value={payload[f]}
                disabled={disabled}
                onChange={(v) => set({ [f]: v })}
              />
            ))}
            {buttons.some((f) => H(f)) && (
              <p className="cms-help cms-span-2">
                {buttons.map(H).filter(Boolean).join(" ")}
              </p>
            )}
          </div>
        </Card>
      )}
      {config.fields.includes("body") && (
        <Card title={L("body")}>
          <RichText
            label={L("body")}
            help={H("body")}
            initial={payload.body || config.bodyHtml}
            disabled={disabled}
            onChange={(body) => set({ body })}
          />
        </Card>
      )}
      {config.items && (
        <Card title={config.items.label}>
          <div className="cms-form-grid">
            <Repeater
              label={config.items.label}
              items={payload.items}
              disabled={disabled}
              max={config.items.max}
              addLabel={config.items.add}
              create={() => ({})}
              title={(i: Payload) => config.items!.title(i)}
              onChange={(items) => set({ items })}
              render={(i: Payload, up) =>
                config.items!.fields.map((f) => {
                  const label = config.items!.labels?.[f] || itemLabel[f];
                  if (f === "image")
                    return (
                      <ImageField
                        key={f}
                        label={label}
                        value={i.image}
                        onChange={(image) => up({ image })}
                      />
                    );
                  if (f === "text")
                    return (
                      <Field key={f} label={label} wide>
                        <Textarea
                          maxLength={3000}
                          value={i.text || ""}
                          onChange={(e) => up({ text: e.target.value })}
                        />
                      </Field>
                    );
                  if (f === "label")
                    return (
                      <Field
                        key={f}
                        label={label}
                        help="Chỉ áp dụng khi có ảnh."
                      >
                        <Select
                          value={i.label || ""}
                          onChange={(e) =>
                            up({ label: e.target.value || undefined })
                          }
                        >
                          <option value="">Ảnh nhỏ</option>
                          <option value="wide">Thẻ rộng</option>
                        </Select>
                      </Field>
                    );
                  // Item titles may span lines; links and prices stay single-line.
                  const Comp = f === "title" ? TextLine : Input;
                  return (
                    <Field
                      key={f}
                      label={label}
                      wide={
                        f === "title" && !config.items!.fields.includes("meta")
                      }
                    >
                      <Comp
                        maxLength={
                          f === "href" ? 600 : f === "price" ? 60 : 200
                        }
                        value={i[f] || ""}
                        onChange={(e) =>
                          up({ [f]: e.target.value || undefined })
                        }
                      />
                    </Field>
                  );
                })
              }
            />
          </div>
        </Card>
      )}
    </>
  );
}

export function SectionEditor({
  kind,
  sectionKey,
  back,
}: {
  kind: "home" | "page";
  sectionKey: string;
  back: { href: string; label: string };
}) {
  const config = (kind === "home" ? homeConfig : pageConfig)[
    sectionKey as never
  ] as Config | undefined;
  const defaults = (kind === "home" ? homeDefaults : pageDefaults)[
    sectionKey as never
  ] as Payload | undefined;
  if (!config || !defaults)
    return <Alert tone="danger">Không tìm thấy phần nội dung này.</Alert>;
  return (
    <DocumentEditor
      kind="PAGE"
      docKey={sectionKey}
      back={back}
      title={() => config.label}
      description={config.hint}
      defaults={defaults}
      previewPath={() => config.preview}
      render={(e) =>
        kind === "page" && sectionKey === "about" ? (
          <AboutForm {...e} config={config} defaults={defaults} />
        ) : (
          <SectionForm {...e} config={config} />
        )
      }
    />
  );
}

/** About page: the banner plus every block, one tab each, saved as a single document. */
function AboutForm({
  config,
  defaults,
  payload,
  set,
  disabled,
}: EditorApi & { config: Config; defaults: Payload }) {
  const [tab, setTab] = useState("banner");
  const parts = { ...defaults.parts, ...payload.parts } as Record<
    string,
    Payload
  >;
  const part = parts[tab];
  return (
    <>
      <Tabs
        label="Khối nội dung"
        value={tab}
        onChange={setTab}
        items={[
          { value: "banner", label: "Banner" },
          ...Object.entries(aboutParts).map(([value, c]) => ({
            value,
            label: c.label,
          })),
        ]}
      />
      {tab === "banner" || !part ? (
        <SectionForm
          config={config}
          payload={payload}
          set={set}
          disabled={disabled}
        />
      ) : (
        <>
          <Card
            title={aboutParts[tab].label}
            description={aboutParts[tab].hint}
          >
            <Switch
              label="Hiển thị khối này trên website"
              checked={!part.hidden}
              disabled={disabled}
              onChange={(on) =>
                set({
                  parts: {
                    ...parts,
                    [tab]: { ...part, hidden: on ? undefined : true },
                  },
                })
              }
            />
          </Card>
          <SectionForm
            config={aboutParts[tab]}
            payload={part}
            disabled={disabled}
            set={(patch) =>
              set({ parts: { ...parts, [tab]: { ...part, ...patch } } })
            }
          />
        </>
      )}
    </>
  );
}

/** Saves and publishes the section with its visibility flipped. */
function useQuickHide(reload: () => void) {
  const toast = useToast(),
    [busy, setBusy] = useState<string | null>(null);
  return {
    busy,
    async toggle(key: string, defaults: Payload, hide: boolean) {
      setBusy(key);
      try {
        const doc = await findDocument("PAGE", key);
        const payload = {
          ...(doc?.revisions[0]?.payload || defaults),
          hidden: hide || undefined,
        };
        const saved = doc
          ? await api.save(doc.id, doc.version, payload)
          : await api.create("PAGE", key, payload);
        await api.publish(
          saved.data.id,
          saved.data.version,
          saved.data.revisionId,
          hide ? "Ẩn khối" : "Hiện khối",
        );
        toast(
          "success",
          hide ? "Đã ẩn khối khỏi website." : "Đã hiển thị lại khối.",
        );
        reload();
      } catch (e) {
        toast("danger", errorText(e));
      } finally {
        setBusy(null);
      }
    },
  };
}

function SectionList({
  title,
  description,
  keys,
  config,
  defaults,
  base,
  numbered,
}: {
  title: string;
  description: string;
  keys: string[];
  config: Record<string, Config>;
  defaults: Record<string, Payload>;
  base: string;
  numbered?: boolean;
}) {
  const docs = useDocuments("PAGE"),
    quick = useQuickHide(docs.reload);
  const byKey = useMemo(
    () => new Map(docs.data.map((d) => [d.key, d])),
    [docs.data],
  );
  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={
          <ButtonLink href="/" external icon="external">
            Xem website
          </ButtonLink>
        }
      />
      {docs.error && <Alert tone="danger">{docs.error}</Alert>}
      <Card pad={false}>
        <div className="cms-card-body">
          {docs.loading ? (
            <Loading rows={8} />
          ) : (
            <div className="cms-stack-sm">
              {keys.map((key, i) => {
                const c = config[key],
                  doc = byKey.get(key),
                  status = statusOf(doc),
                  hidden = status === "hidden" || status === "withdrawn";
                return (
                  <div className="cms-row-card" key={key} data-hidden={hidden}>
                    {numbered && <span className="cms-row-index">{i + 1}</span>}
                    <span className="cms-feed-icon">
                      <CmsIcon name={c.icon} />
                    </span>
                    <div className="cms-row-main">
                      <Link href={`${base}/${key.replace(/^home\./, "")}`}>
                        <strong>{c.label}</strong>
                      </Link>
                      <span>
                        {c.hint}
                        {doc && (
                          <>
                            <span className="cms-dot" />
                            {timeAgo(doc.updatedAt)}
                          </>
                        )}
                      </span>
                    </div>
                    <Badge tone={statusLabel[status].tone}>
                      {statusLabel[status].text}
                    </Badge>
                    {numbered && (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={hidden ? "eye" : "eyeOff"}
                        aria-label={
                          hidden ? `Hiện khối ${c.label}` : `Ẩn khối ${c.label}`
                        }
                        title={hidden ? "Hiện khối" : "Ẩn khối"}
                        disabled={quick.busy === key || status === "withdrawn"}
                        onClick={() =>
                          void quick.toggle(key, defaults[key], !hidden)
                        }
                      />
                    )}
                    <ButtonLink
                      size="sm"
                      icon="pencil"
                      href={`${base}/${key.replace(/^home\./, "")}`}
                    >
                      Sửa
                    </ButtonLink>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    </>
  );
}

export function HomeSectionsPage() {
  return (
    <SectionList
      title="Trang chủ"
      description="Các khối của trang chủ theo đúng thứ tự hiển thị. Bấm biểu tượng con mắt để ẩn/hiện nhanh một khối."
      keys={homeOrder}
      config={homeConfig}
      defaults={homeDefaults}
      base="/admin/trang-chu"
      numbered
    />
  );
}
export function PagesPage() {
  return (
    <SectionList
      title="Các trang"
      description="Banner và nội dung của các trang con."
      keys={Object.keys(pageConfig)}
      config={pageConfig}
      defaults={pageDefaults}
      base="/admin/trang"
    />
  );
}
