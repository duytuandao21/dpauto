"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useSession } from "@/components/admin/auth-gate";
import { canProvisionCmsAccounts } from "@/lib/api/cms";
import { command, request, type Envelope } from "@/lib/api/client";
import { ActivityFeed, actions } from "../activity";
import { CmsIcon } from "../icon";
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  Input,
  Loading,
  PageHeader,
  Select,
  Switch,
  errorText,
  useToast,
} from "../ui";
import type { Activity } from "../data";

export function ActivityPage() {
  const [items, setItems] = useState<Activity[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [more, setMore] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [filter, setFilter] = useState("");
  async function load(after?: string | null) {
    setLoading(true);
    try {
      const r: Envelope<Activity[]> = await request<Activity[]>(
        `admin/cms/activity?limit=50${after ? `&cursor=${encodeURIComponent(after)}` : ""}`,
      );
      setItems((all) => (after ? [...all, ...r.data] : r.data));
      setCursor(r.page?.nextCursor || null);
      setMore(!!r.page?.hasMore);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const shown = filter ? items.filter((a) => a.action === filter) : items;
  return (
    <>
      <PageHeader
        title="Lịch sử hoạt động"
        description="Mọi thao tác lưu, khôi phục và quản lý ảnh trên website."
      />
      {error && <Alert tone="danger">{error}</Alert>}
      <Card
        title="Nhật ký"
        action={
          <Select
            className="cms-select-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Lọc theo thao tác"
          >
            <option value="">Mọi thao tác</option>
            {Object.entries(actions).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </Select>
        }
        footer={
          <>
            <span>{shown.length} hoạt động đã tải</span>
            {more && (
              <Button
                size="sm"
                disabled={loading}
                onClick={() => void load(cursor)}
              >
                Tải thêm
              </Button>
            )}
          </>
        }
      >
        {loading && !items.length ? (
          <Loading rows={6} />
        ) : (
          <ActivityFeed items={shown} full />
        )}
      </Card>
    </>
  );
}

export function AccountsPage() {
  const session = useSession(),
    toast = useToast(),
    [busy, setBusy] = useState(false),
    [write, setWrite] = useState(true),
    [publish, setPublish] = useState(true),
    [error, setError] = useState("");
  const provision = canProvisionCmsAccounts(session);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const f = e.currentTarget,
      d = new FormData(f);
    setBusy(true);
    setError("");
    try {
      await command("admin/staff", {
        name: d.get("name"),
        phone: d.get("phone"),
        email: d.get("email"),
        jobRole: "MANAGER",
        active: true,
        account: {
          email: d.get("email"),
          temporaryPassword: d.get("password"),
          role: "CMS_ADMIN",
          permissions: [
            "cms.read",
            ...(write ? ["cms.write"] : []),
            ...(publish ? ["cms.publish"] : []),
          ],
        },
      });
      f.reset();
      toast(
        "success",
        "Đã tạo tài khoản. Người dùng cần đổi mật khẩu ở lần đăng nhập đầu tiên.",
      );
    } catch (err) {
      setError(errorText(err, "Không thể tạo tài khoản."));
    } finally {
      setBusy(false);
    }
  }
  const perms = session?.permissions.filter((p) => p.startsWith("cms.")) || [];
  return (
    <>
      <PageHeader
        title="Tài khoản"
        description="Tài khoản đang đăng nhập và tài khoản quản trị nội dung website."
      />
      <div className="cms-grid-main">
        <div className="cms-stack">
          {provision ? (
            <Card
              title="Tạo tài khoản quản trị nội dung"
              description="Tài khoản chỉ dùng được trang /admin, không truy cập được khu vực vận hành."
            >
              <form onSubmit={save}>
                <fieldset
                  disabled={busy}
                  style={{ border: 0, padding: 0, margin: 0 }}
                >
                  <div className="cms-form-grid">
                    <Field label="Họ tên">
                      <Input name="name" required maxLength={100} />
                    </Field>
                    <Field label="Số điện thoại">
                      <Input name="phone" required type="tel" />
                    </Field>
                    <Field label="Email đăng nhập">
                      <Input
                        name="email"
                        required
                        type="email"
                        autoComplete="off"
                      />
                    </Field>
                    <Field
                      label="Mật khẩu tạm"
                      help="Tối thiểu 15 ký tự. Người dùng sẽ đổi khi đăng nhập lần đầu."
                    >
                      <Input
                        name="password"
                        required
                        type="password"
                        minLength={15}
                        maxLength={128}
                        autoComplete="new-password"
                      />
                    </Field>
                    <div className="cms-field cms-span-2">
                      <span>Quyền</span>
                      <Switch
                        label="Xem nội dung (luôn có)"
                        checked
                        disabled
                        onChange={() => {}}
                      />
                      <Switch
                        label="Biên tập nội dung và tải ảnh"
                        checked={write}
                        onChange={setWrite}
                      />
                      <Switch
                        label="Áp dụng lên website, gỡ và khôi phục nội dung"
                        checked={publish}
                        onChange={setPublish}
                      />
                    </div>
                  </div>
                  {error && (
                    <div style={{ marginTop: 16 }}>
                      <Alert tone="danger">{error}</Alert>
                    </div>
                  )}
                  <div className="cms-actions" style={{ marginTop: 20 }}>
                    <Button
                      variant="primary"
                      type="submit"
                      icon="plus"
                      disabled={busy}
                    >
                      Tạo tài khoản
                    </Button>
                  </div>
                </fieldset>
              </form>
            </Card>
          ) : (
            <Card title="Tạo tài khoản">
              <Alert tone="info">
                Chỉ quản lý có quyền quản lý nhân sự mới tạo được tài khoản quản
                trị nội dung.
              </Alert>
            </Card>
          )}
          {provision && (
            <Card title="Quản lý tài khoản hiện có">
              <p className="cms-help">
                Đổi quyền, khóa tài khoản hoặc đặt lại mật khẩu ở trang{" "}
                <a className="cms-link" href="/dieu-hanh/nhan-su">
                  Nhân sự
                </a>{" "}
                của khu điều hành.
              </p>
            </Card>
          )}
        </div>
        <Card title="Đang đăng nhập">
          <div className="cms-stack-sm">
            <div className="cms-section-box">
              <span className="cms-avatar">
                <CmsIcon name="users" />
              </span>
              <div>
                <strong>{session?.staff.name}</strong>
                <p className="cms-help">{session?.user.email}</p>
              </div>
            </div>
            <span className="cms-label">Quyền website</span>
            <div className="cms-actions">
              {perms.length ? (
                perms.map((p) => (
                  <Badge key={p} tone="info">
                    {{
                      "cms.read": "Xem",
                      "cms.write": "Biên tập",
                      "cms.publish": "Áp dụng lên website",
                    }[p] || p}
                  </Badge>
                ))
              ) : (
                <Badge tone="warn">Chưa có quyền CMS</Badge>
              )}
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

export function HelpPage() {
  const steps = [
    [
      "Sửa nội dung",
      "Mở mục cần sửa ở menu bên trái. Form luôn điền sẵn nội dung đang hiển thị trên website.",
    ],
    [
      "Xem trước",
      "Bấm “Xem trước” để mở website với thay đổi trong tab mới, chưa áp dụng cho khách. Link xem trước có hiệu lực 30 phút.",
    ],
    [
      "Lưu",
      "Bấm “Lưu” để áp dụng thay đổi lên website ngay. Hệ thống không giữ phiên bản cũ.",
    ],
    [
      "Khôi phục mặc định",
      "Menu “⋯” → “Khôi phục nội dung mặc định” để website dùng lại nội dung gốc.",
    ],
    [
      "Ẩn / gỡ",
      "Bật “Ẩn khỏi website” rồi bấm Lưu để tạm ẩn một mục. “Xóa khỏi website” ẩn hoàn toàn cho đến khi lưu lại.",
    ],
    [
      "Ảnh",
      "Tải ảnh ở Thư viện ảnh. Hệ thống tự tạo nhiều kích thước; nên điền mô tả (alt) và chọn điểm lấy nét.",
    ],
  ];
  return (
    <>
      <PageHeader
        title="Trợ giúp"
        description="Hướng dẫn nhanh cách quản lý nội dung website."
      />
      <div className="cms-grid-2">
        <Card title="Quy trình chỉnh sửa">
          <div className="cms-feed">
            {steps.map(([t, d], i) => (
              <div className="cms-feed-item" key={t}>
                <span className="cms-row-index">{i + 1}</span>
                <div className="cms-feed-body">
                  <div className="cms-feed-title">{t}</div>
                  <div className="cms-feed-meta">{d}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <div className="cms-stack">
          <Card title="Trạng thái nội dung">
            <div className="cms-stack-sm">
              {[
                ["Mặc định", "neutral", "Website đang dùng nội dung gốc."],
                [
                  "Đang hiển thị",
                  "success",
                  "Website đang hiển thị nội dung bạn đã sửa.",
                ],
                [
                  "Chưa áp dụng",
                  "warn",
                  "Có thay đổi đã lưu (khi xem trước) nhưng chưa lên website. Bấm Lưu để áp dụng.",
                ],
                ["Đang ẩn", "neutral", "Mục đã ẩn khỏi website."],
                ["Đã gỡ", "danger", "Mục bị gỡ khỏi website."],
              ].map(([t, tone, d]) => (
                <div className="cms-row-card" key={t}>
                  <Badge tone={tone as "neutral"}>{t}</Badge>
                  <span className="cms-help">{d}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Lối tắt">
            <div className="cms-stack-sm">
              <Link className="cms-link" href="/admin/trang-chu">
                Sửa trang chủ →
              </Link>
              <Link className="cms-link" href="/admin/cai-dat">
                Cập nhật thông tin cửa hàng →
              </Link>
              <Link className="cms-link" href="/admin/thu-vien-anh">
                Tải ảnh lên →
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
