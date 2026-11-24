"use client";
import { useEffect, useState } from "react";
import { defaultCatalog, defaultVehicles } from "@/lib/cms-defaults";
import { DocumentEditor } from "../editor";
import { ImageField, Repeater } from "../fields";
import { Card, Field, Input, Textarea } from "../ui";
import { findDocument, type ImageValue } from "../data";

type Entry = { id: string; name: string };
type Brand = Entry & { logo?: ImageValue | null };
export type Catalog = { brands: Brand[]; categories: Entry[] };

// Ids never change after creation, so renaming keeps every product linked.
const newId = () => Math.random().toString(36).slice(2, 10);

/** Saved catalogue (or the built-in one); null while loading. */
export function useCatalog() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  useEffect(() => {
    findDocument("CATALOG", "accessories")
      .then((d) =>
        setCatalog((d?.revisions[0]?.payload as Catalog) || defaultCatalog),
      )
      .catch(() => setCatalog(defaultCatalog));
  }, []);
  return catalog;
}

export function CatalogEditor() {
  return (
    <DocumentEditor
      kind="CATALOG"
      docKey="accessories"
      title={() => "Thương hiệu & danh mục"}
      description="Danh sách để chọn khi thêm phụ kiện và làm bộ lọc ở trang Phụ kiện."
      defaults={defaultCatalog}
      hideToggle={false}
      previewPath={() => "/phu-kien"}
      render={({ payload, set, disabled }) => (
        <>
          <Card title="Thương hiệu">
            <Repeater
              label="Thương hiệu"
              help="Logo hiện ở bộ lọc trang Phụ kiện; nên dùng ảnh PNG nền trong suốt. Xóa một thương hiệu thì các sản phẩm của nó sẽ không còn thương hiệu."
              items={payload.brands}
              disabled={disabled}
              max={60}
              addLabel="Thêm thương hiệu"
              create={(): Brand => ({ id: newId(), name: "", logo: null })}
              title={(b: Brand) => b.name}
              onChange={(brands) => set({ brands })}
              render={(b: Brand, up) => (
                <>
                  <Field label="Tên thương hiệu" wide>
                    <Input
                      required
                      maxLength={80}
                      value={b.name}
                      onChange={(e) => up({ name: e.target.value })}
                    />
                  </Field>
                  <ImageField
                    label="Logo"
                    value={b.logo}
                    onChange={(logo) => up({ logo })}
                  />
                </>
              )}
            />
          </Card>
          <Card title="Danh mục sản phẩm">
            <Repeater
              label="Danh mục"
              help="Thứ tự ở đây là thứ tự bộ lọc trên website. Xóa một danh mục thì các sản phẩm thuộc danh mục đó sẽ không còn danh mục."
              items={payload.categories}
              disabled={disabled}
              max={60}
              addLabel="Thêm danh mục"
              create={(): Entry => ({ id: newId(), name: "" })}
              title={(c: Entry) => c.name}
              onChange={(categories) => set({ categories })}
              render={(c: Entry, up) => (
                <Field label="Tên danh mục" wide>
                  <Input
                    required
                    maxLength={80}
                    value={c.name}
                    onChange={(e) => up({ name: e.target.value })}
                  />
                </Field>
              )}
            />
          </Card>
        </>
      )}
    />
  );
}

type Make = { name: string; models: string[] };

/** Models typed one per line; the text is kept as typed so Enter works mid-edit. */
function ModelsField({
  value,
  disabled,
  onChange,
}: {
  value: string[];
  disabled: boolean;
  onChange: (models: string[]) => void;
}) {
  const [text, setText] = useState(value.join("\n"));
  return (
    <Field
      label="Dòng xe"
      help="Mỗi dòng một tên, theo thứ tự hiển thị trong form đặt lịch."
      wide
    >
      <Textarea
        rows={6}
        disabled={disabled}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(
            e.target.value
              .split(/\r?\n/)
              .map((m) => m.trim().slice(0, 60))
              .filter(Boolean),
          );
        }}
      />
    </Field>
  );
}

/** Car makes and their models offered in the website booking form. */
export function VehiclesEditor() {
  return (
    <DocumentEditor
      kind="CATALOG"
      docKey="vehicles"
      title={() => "Hãng & dòng xe"}
      description="Danh sách để khách chọn hãng xe và dòng xe trong form đặt lịch."
      defaults={defaultVehicles}
      hideToggle={false}
      render={({ payload, set, disabled }) => (
        <Card title="Hãng xe">
          <Repeater
            label="Hãng xe"
            help="Thứ tự ở đây là thứ tự trong ô chọn hãng xe."
            items={payload.brands}
            disabled={disabled}
            max={200}
            addLabel="Thêm hãng xe"
            create={(): Make => ({ name: "", models: [] })}
            title={(b: Make) =>
              b.name ? `${b.name} (${b.models?.length || 0} dòng)` : ""
            }
            onChange={(brands) => set({ brands })}
            render={(b: Make, up) => (
              <>
                <Field label="Tên hãng" wide>
                  <Input
                    required
                    maxLength={60}
                    value={b.name}
                    onChange={(e) => up({ name: e.target.value })}
                  />
                </Field>
                <ModelsField
                  value={b.models || []}
                  disabled={disabled}
                  onChange={(models) => up({ models })}
                />
              </>
            )}
          />
        </Card>
      )}
    />
  );
}
