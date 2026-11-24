"use client";
import { useState, type ReactNode } from "react";
import { CmsIcon } from "./icon";
import { Button, Field, Input } from "./ui";
import { AssetPreview, MediaPicker } from "./media";
import { imageFromAsset, type ImageValue } from "./data";

/** Single image: preview, pick from the library, edit alt text, remove. */
export function ImageField({
  label,
  value,
  onChange,
  help,
  disabled,
}: {
  label: string;
  value: ImageValue | null | undefined;
  onChange: (v: ImageValue | null) => void;
  help?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="cms-field cms-span-2">
      <span>{label}</span>
      <div className="cms-image-field">
        <div className="cms-image-preview">
          {value?.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value.src} alt="" />
          ) : (
            <CmsIcon name="image" size={24} />
          )}
        </div>
        <div className="cms-stack-sm" style={{ flex: 1, minWidth: 0 }}>
          <div className="cms-actions">
            <Button
              size="sm"
              icon="image"
              disabled={disabled}
              onClick={() => setOpen(true)}
            >
              {value?.src ? "Đổi ảnh" : "Chọn ảnh"}
            </Button>
            {value?.src && (
              <Button
                size="sm"
                variant="ghost"
                icon="x"
                disabled={disabled}
                onClick={() => onChange(null)}
              >
                Bỏ ảnh
              </Button>
            )}
          </div>
          {value?.src && (
            <Input
              aria-label={`Mô tả ảnh: ${label}`}
              placeholder="Mô tả ảnh (alt)"
              maxLength={240}
              disabled={disabled}
              value={value.alt}
              onChange={(e) => onChange({ ...value, alt: e.target.value })}
            />
          )}
          {help && <small className="cms-help">{help}</small>}
        </div>
      </div>
      {open && (
        <MediaPicker
          selected={value?.assetId}
          onClose={() => setOpen(false)}
          onPick={(a) => {
            onChange(imageFromAsset(a));
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

/** Ordered set of images (gallery), or of uploaded videos with `kind="video"`. */
export function GalleryField({
  label,
  value,
  onChange,
  help,
  disabled,
  max = 60,
  kind = "image",
}: {
  label: string;
  value: ImageValue[] | undefined;
  onChange: (v: ImageValue[]) => void;
  help?: string;
  disabled?: boolean;
  max?: number;
  kind?: "image" | "video";
}) {
  const noun = kind === "video" ? "video" : "ảnh";
  const [open, setOpen] = useState(false),
    list = value || [];
  const move = (i: number, d: number) => {
    const next = [...list];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  return (
    <div className="cms-field cms-span-2">
      <span>
        {label}{" "}
        <small className="cms-help">
          ({list.length}
          {kind === "video" ? `/${max}` : ""} {noun})
        </small>
      </span>
      {help && <small className="cms-help">{help}</small>}
      <div className="cms-gallery">
        {list.map((img, i) => (
          <div className="cms-gallery-item" key={img.src + i}>
            <div className="cms-image-preview">
              <AssetPreview src={img.src} video={kind === "video"} />
            </div>
            <footer>
              <span title={img.alt}>{img.alt || "Chưa có mô tả"}</span>
              <Button
                size="sm"
                variant="ghost"
                icon="chevronLeft"
                aria-label="Lên trước"
                disabled={disabled || i === 0}
                onClick={() => move(i, -1)}
              />
              <Button
                size="sm"
                variant="ghost"
                icon="chevronRight"
                aria-label="Xuống sau"
                disabled={disabled || i === list.length - 1}
                onClick={() => move(i, 1)}
              />
              <Button
                size="sm"
                variant="ghost"
                icon="trash"
                aria-label={`Xóa ${noun}`}
                disabled={disabled}
                onClick={() => onChange(list.filter((_, n) => n !== i))}
              />
            </footer>
          </div>
        ))}
        {list.length < max && (
          <button
            type="button"
            className="cms-gallery-item cms-dropzone"
            style={{ padding: 16 }}
            disabled={disabled}
            onClick={() => setOpen(true)}
          >
            <CmsIcon name="plus" size={20} />
            Thêm {noun}
          </button>
        )}
      </div>
      {open && (
        <MediaPicker
          kind={kind}
          onClose={() => setOpen(false)}
          onPick={(a) => {
            onChange([...list, imageFromAsset(a)]);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

/** Editable list of items with add, remove, reorder and collapse. */
export function Repeater<T>({
  label,
  items,
  onChange,
  create,
  title,
  render,
  disabled,
  max = 60,
  addLabel = "Thêm mục",
  help,
}: {
  label: string;
  items: T[] | undefined;
  onChange: (v: T[]) => void;
  create: () => T;
  title: (item: T, index: number) => string;
  render: (
    item: T,
    update: (patch: Partial<T>) => void,
    index: number,
  ) => ReactNode;
  disabled?: boolean;
  max?: number;
  addLabel?: string;
  help?: string;
}) {
  const list = items || [],
    [open, setOpen] = useState<number | null>(null);
  const set = (i: number, patch: Partial<T>) =>
    onChange(list.map((x, n) => (n === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: number) => {
    const next = [...list];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
    setOpen(open === i ? i + d : open);
  };
  return (
    <div className="cms-field cms-span-2">
      <span>
        {label} <small className="cms-help">({list.length})</small>
      </span>
      {help && <small className="cms-help">{help}</small>}
      <div className="cms-repeater">
        {list.map((item, i) => (
          <div className="cms-repeater-item" key={i} data-open={open === i}>
            <div className="cms-repeater-head">
              <span className="cms-row-index">{i + 1}</span>
              <strong>{title(item, i) || "(chưa có tiêu đề)"}</strong>
              <Button
                size="sm"
                variant="ghost"
                icon="arrowUp"
                aria-label="Chuyển lên"
                disabled={disabled || i === 0}
                onClick={() => move(i, -1)}
              />
              <Button
                size="sm"
                variant="ghost"
                icon="arrowDown"
                aria-label="Chuyển xuống"
                disabled={disabled || i === list.length - 1}
                onClick={() => move(i, 1)}
              />
              <Button
                size="sm"
                variant="ghost"
                icon="trash"
                aria-label="Xóa mục"
                disabled={disabled}
                onClick={() => onChange(list.filter((_, n) => n !== i))}
              />
              <Button
                size="sm"
                variant="ghost"
                icon={open === i ? "chevronDown" : "chevronRight"}
                aria-label={open === i ? "Thu gọn" : "Mở rộng"}
                aria-expanded={open === i}
                onClick={() => setOpen(open === i ? null : i)}
              />
            </div>
            {open === i && (
              <div className="cms-repeater-body">
                <div className="cms-form-grid">
                  {render(item, (p) => set(i, p), i)}
                </div>
              </div>
            )}
          </div>
        ))}
        {list.length < max && (
          <div>
            <Button
              size="sm"
              icon="plus"
              disabled={disabled}
              onClick={() => {
                onChange([...list, create()]);
                setOpen(list.length);
              }}
            >
              {addLabel}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function LinkFields({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: { label: string; href: string } | undefined;
  onChange: (v: { label: string; href: string }) => void;
  disabled?: boolean;
}) {
  const v = value || { label: "", href: "" };
  return (
    <>
      <Field label={`${label}: chữ trên nút`}>
        <Input
          maxLength={80}
          disabled={disabled}
          value={v.label}
          onChange={(e) => onChange({ ...v, label: e.target.value })}
        />
      </Field>
      <Field
        label={`${label}: đường dẫn`}
        help="Ví dụ /services, #pricing, tel:0772584279 hoặc https://…"
      >
        <Input
          maxLength={600}
          disabled={disabled}
          value={v.href}
          onChange={(e) => onChange({ ...v, href: e.target.value })}
        />
      </Field>
    </>
  );
}
