"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { defaultNavigation, defaultSettings } from "@/lib/cms-defaults";
import { DocumentEditor } from "../editor";
import { ImageField, Repeater } from "../fields";
import { Alert, Card, Field, Input, Tabs, Textarea } from "../ui";

type Tab = "store" | "hours" | "social" | "menu";
type Link = { label: string; href: string };

export function SettingsPage() {
  const params = useSearchParams(),
    router = useRouter(),
    tab = (
      ["store", "hours", "social", "menu"].includes(params.get("tab") || "")
        ? params.get("tab")
        : "store"
    ) as Tab;
  const tabs = (
    <Tabs<Tab>
      label="Cài đặt website"
      value={tab}
      onChange={(t) =>
        router.replace(`/admin/cai-dat?tab=${t}`, { scroll: false })
      }
      items={[
        { value: "store", label: "Thông tin cửa hàng", icon: "settings" },
        { value: "hours", label: "Giờ mở cửa", icon: "clock" },
        { value: "social", label: "Mạng xã hội", icon: "globe" },
        { value: "menu", label: "Menu", icon: "menuList" },
      ]}
    />
  );
  if (tab === "menu")
    return (
      <DocumentEditor
        key="menu"
        kind="NAVIGATION"
        docKey="main"
        hideToggle={false}
        title={() => "Cài đặt website"}
        description="Menu điều hướng ở đầu trang (header) và các cột liên kết cuối trang (footer)."
        defaults={defaultNavigation}
        previewPath={() => "/"}
        tabs={tabs}
        render={({ payload, set, disabled }) => (
          <>
            <Card
              title="Menu đầu trang"
              description="Hiển thị trên thanh điều hướng và menu điện thoại. Mục “Dịch vụ” luôn có danh sách dịch vụ xổ xuống."
            >
              <div className="cms-form-grid">
                <LinksRepeater
                  label="Liên kết"
                  items={payload.header}
                  disabled={disabled}
                  onChange={(header) => set({ header })}
                  max={12}
                />
              </div>
            </Card>
            <Card title="Liên kết cuối trang">
              <div className="cms-form-grid">
                <Repeater
                  label="Cột liên kết"
                  items={payload.footer}
                  disabled={disabled}
                  max={6}
                  addLabel="Thêm cột"
                  create={() => ({ title: "", links: [] })}
                  title={(c: { title: string; links: Link[] }) => c.title}
                  onChange={(footer) => set({ footer })}
                  render={(c: { title: string; links: Link[] }, up) => (
                    <>
                      <Field label="Tên cột" wide>
                        <Input
                          maxLength={80}
                          value={c.title}
                          onChange={(e) => up({ title: e.target.value })}
                        />
                      </Field>
                      <LinksRepeater
                        label="Liên kết trong cột"
                        items={c.links}
                        onChange={(links) => up({ links })}
                        max={12}
                      />
                    </>
                  )}
                />
              </div>
            </Card>
          </>
        )}
      />
    );
  return (
    <DocumentEditor
      key="settings"
      kind="SETTINGS"
      docKey="site"
      hideToggle={false}
      title={() => "Cài đặt website"}
      description="Thông tin hiển thị ở header, footer, trang Liên hệ, khối Vị trí và nút gọi điện trên toàn website."
      defaults={defaultSettings}
      previewPath={() => "/lien-he"}
      tabs={tabs}
      render={({ payload, set, disabled, doc }) => (
        <>
          {!doc?.publishedRevisionId && (
            <Alert tone="warn">
              Website đang dùng thông tin mẫu ở một số nơi (footer, trang liên
              hệ). Kiểm tra các trường bên dưới, đặc biệt là{" "}
              <strong>email</strong> và <strong>mạng xã hội</strong>, rồi bấm{" "}
              <strong>Lưu</strong> để áp dụng cho toàn website.
            </Alert>
          )}
          {tab === "store" && (
            <>
              <Card
                title="Thông tin cửa hàng"
                description="Tên, liên hệ và địa chỉ của gara."
              >
                <div className="cms-form-grid">
                  <Field label="Tên cửa hàng" wide>
                    <Input
                      required
                      maxLength={120}
                      disabled={disabled}
                      value={payload.name || ""}
                      onChange={(e) => set({ name: e.target.value })}
                    />
                  </Field>
                  <Field label="Khẩu hiệu" wide>
                    <Input
                      maxLength={200}
                      disabled={disabled}
                      value={payload.tagline || ""}
                      onChange={(e) => set({ tagline: e.target.value })}
                    />
                  </Field>
                  <Field
                    label="Số điện thoại"
                    help="Dùng cho nút “Gọi ngay” trên toàn website."
                  >
                    <Input
                      type="tel"
                      maxLength={40}
                      disabled={disabled}
                      value={payload.phone || ""}
                      onChange={(e) => set({ phone: e.target.value })}
                    />
                  </Field>
                  <Field label="Email">
                    <Input
                      type="email"
                      maxLength={160}
                      disabled={disabled}
                      value={payload.email || ""}
                      onChange={(e) => set({ email: e.target.value })}
                    />
                  </Field>
                  <Field label="Địa chỉ (số nhà, đường)">
                    <Input
                      maxLength={300}
                      disabled={disabled}
                      value={payload.address || ""}
                      onChange={(e) => set({ address: e.target.value })}
                    />
                  </Field>
                  <Field label="Phường / Quận / Thành phố">
                    <Input
                      maxLength={200}
                      disabled={disabled}
                      value={payload.city || ""}
                      onChange={(e) => set({ city: e.target.value })}
                    />
                  </Field>
                  <Field
                    label="Link chỉ đường Google Maps"
                    help="Link “Chia sẻ” của Google Maps, ví dụ https://maps.app.goo.gl/…"
                    wide
                  >
                    <Input
                      maxLength={600}
                      disabled={disabled}
                      value={payload.directions || ""}
                      onChange={(e) => set({ directions: e.target.value })}
                    />
                  </Field>
                  <Field
                    label="Link nhúng bản đồ"
                    help="Google Maps → Chia sẻ → Nhúng bản đồ → sao chép phần src=”https://www.google.com/maps/embed?…”. Để trống sẽ dùng bản đồ hiện tại."
                    wide
                  >
                    <Input
                      maxLength={2000}
                      disabled={disabled}
                      value={payload.mapEmbed || ""}
                      onChange={(e) => set({ mapEmbed: e.target.value })}
                    />
                  </Field>
                  <ImageField
                    label="Logo"
                    value={payload.logo}
                    disabled={disabled}
                    onChange={(logo) => set({ logo })}
                  />
                  <ImageField
                    label="Biểu tượng trang (favicon)"
                    help="Icon nhỏ trên tab trình duyệt. Nên dùng ảnh vuông, PNG nền trong suốt, từ 192×192px. Để trống sẽ dùng logo."
                    value={payload.favicon}
                    disabled={disabled}
                    onChange={(favicon) => set({ favicon })}
                  />
                  <Field
                    label="Dòng chữ cuối trang"
                    help="Không bắt buộc, hiển thị ở footer."
                    wide
                  >
                    <Textarea
                      maxLength={500}
                      disabled={disabled}
                      value={payload.footerText || ""}
                      onChange={(e) => set({ footerText: e.target.value })}
                    />
                  </Field>
                </div>
              </Card>
            </>
          )}
          {tab === "hours" && (
            <Card
              title="Giờ mở cửa"
              description="Hiển thị ở footer, trang chủ (khối vị trí) và trang liên hệ."
            >
              <div className="cms-form-grid">
                <Repeater
                  label="Khung giờ"
                  items={payload.hours}
                  disabled={disabled}
                  max={14}
                  addLabel="Thêm dòng"
                  create={() => ({ label: "", value: "" })}
                  title={(h: { label: string; value: string }) =>
                    `${h.label}${h.value ? `: ${h.value}` : ""}`
                  }
                  onChange={(hours) => set({ hours })}
                  render={(h: { label: string; value: string }, up) => (
                    <>
                      <Field label="Ngày" help="Ví dụ: Thứ Hai – Thứ Sáu">
                        <Input
                          maxLength={80}
                          value={h.label}
                          onChange={(e) => up({ label: e.target.value })}
                        />
                      </Field>
                      <Field
                        label="Giờ"
                        help="Ví dụ: 08:00 – 18:00, hoặc “Nghỉ”"
                      >
                        <Input
                          maxLength={120}
                          value={h.value}
                          onChange={(e) => up({ value: e.target.value })}
                        />
                      </Field>
                    </>
                  )}
                />
              </div>
            </Card>
          )}
          {tab === "social" && (
            <Card
              title="Mạng xã hội"
              description="Để trống mục nào thì biểu tượng đó không hiển thị."
            >
              <div className="cms-form-grid">
                {(
                  [
                    ["facebook", "Facebook"],
                    ["zalo", "Zalo"],
                    ["youtube", "YouTube"],
                    ["tiktok", "TikTok"],
                    ["instagram", "Instagram"],
                  ] as const
                ).map(([k, label]) => (
                  <Field key={k} label={label}>
                    <Input
                      maxLength={600}
                      disabled={disabled}
                      placeholder="https://"
                      value={payload.socials?.[k] || ""}
                      onChange={(e) =>
                        set({
                          socials: {
                            ...payload.socials,
                            [k]: e.target.value || undefined,
                          },
                        })
                      }
                    />
                  </Field>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    />
  );
}

function LinksRepeater({
  label,
  items,
  onChange,
  disabled,
  max,
}: {
  label: string;
  items: Link[] | undefined;
  onChange: (v: Link[]) => void;
  disabled?: boolean;
  max: number;
}) {
  return (
    <Repeater
      label={label}
      items={items}
      disabled={disabled}
      max={max}
      addLabel="Thêm liên kết"
      create={() => ({ label: "", href: "" })}
      title={(l: Link) => `${l.label}${l.href ? ` → ${l.href}` : ""}`}
      onChange={onChange}
      render={(l: Link, up) => (
        <>
          <Field label="Chữ hiển thị">
            <Input
              maxLength={80}
              value={l.label}
              onChange={(e) => up({ label: e.target.value })}
            />
          </Field>
          <Field
            label="Đường dẫn"
            help="Ví dụ /services, /#pricing hoặc https://…"
          >
            <Input
              maxLength={600}
              value={l.href}
              onChange={(e) => up({ href: e.target.value })}
            />
          </Field>
        </>
      )}
    />
  );
}
