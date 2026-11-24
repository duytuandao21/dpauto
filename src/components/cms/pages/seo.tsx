"use client";
import { localPath } from "@/lib/public-paths";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { defaultArticles, defaultServices } from "@/lib/cms-defaults";
import { CmsIcon } from "../icon";
import { DocumentEditor } from "../editor";
import { ImageField } from "../fields";
import {
  Alert,
  Badge,
  ButtonLink,
  Card,
  Field,
  Input,
  Loading,
  PageHeader,
  Stat,
  Switch,
  Textarea,
} from "../ui";
import { statusLabel, statusOf, useDocuments } from "../data";

const fixed: [string, string][] = [
  ["/", "Trang chủ"],
  ["/services", "Dịch vụ"],
  ["/phu-kien", "Phụ kiện"],
  ["/our-work", "Thành quả"],
  ["/news", "Tin tức"],
  ["/about", "Giới thiệu"],
  ["/contact", "Liên hệ"],
  ["/privacy", "Chính sách bảo mật"],
  ["/terms", "Điều khoản sử dụng"],
  ["/chinh-sach-dat-lich", "Chính sách đặt lịch"],
];
/** Rough quality check that mirrors common search snippet limits. */
function score(title?: string, description?: string) {
  const issues: string[] = [];
  if (!title) issues.push("Chưa có tiêu đề SEO");
  else if (title.length < 30 || title.length > 60)
    issues.push(`Tiêu đề ${title.length} ký tự (nên 30–60)`);
  if (!description) issues.push("Chưa có mô tả");
  else if (description.length < 70 || description.length > 160)
    issues.push(`Mô tả ${description.length} ký tự (nên 70–160)`);
  return issues;
}
function Serp({
  path,
  title,
  description,
}: {
  path: string;
  title?: string;
  description?: string;
}) {
  return (
    <div className="cms-serp">
      <small>
        dpauto.vn
        {path === "/" ? "" : path.replace(/\//g, " › ").replace(/^ › /, " › ")}
      </small>
      <strong>{title || "Tiêu đề trang"}</strong>
      <p>
        {(
          description ||
          "Mô tả ngắn của trang sẽ hiện ở đây trên kết quả tìm kiếm Google."
        ).slice(0, 160)}
      </p>
    </div>
  );
}

function SeoEditor({ path }: { path: string }) {
  return (
    <DocumentEditor
      kind="SEO"
      docKey={path}
      hideToggle={false}
      back={{ href: "/admin/seo", label: "SEO" }}
      title={() => `SEO ${localPath(path)}`}
      description="Tiêu đề và mô tả hiển thị trên Google, Facebook, Zalo khi chia sẻ link."
      defaults={null}
      previewPath={() => localPath(path)}
      side={({ payload }) => (
        <Card title="Xem trước trên Google">
          <Serp
            path={path}
            title={payload.title}
            description={payload.description}
          />
          <div className="cms-stack-sm" style={{ marginTop: 12 }}>
            {score(payload.title, payload.description).map((i) => (
              <Badge key={i} tone="warn">
                {i}
              </Badge>
            ))}
            {!score(payload.title, payload.description).length && (
              <Badge tone="success">Độ dài phù hợp</Badge>
            )}
          </div>
        </Card>
      )}
      render={({ payload, set, disabled }) => (
        <Card title="Thông tin SEO">
          <div className="cms-form-grid">
            <Field
              label={`Tiêu đề SEO (${(payload.title || "").length}/60)`}
              wide
            >
              <Input
                required
                maxLength={180}
                disabled={disabled}
                value={payload.title || ""}
                onChange={(e) => set({ title: e.target.value })}
              />
            </Field>
            <Field
              label={`Mô tả (${(payload.description || "").length}/160)`}
              wide
            >
              <Textarea
                maxLength={500}
                disabled={disabled}
                value={payload.description || ""}
                onChange={(e) => set({ description: e.target.value })}
              />
            </Field>
            <ImageField
              label="Ảnh khi chia sẻ (Facebook, Zalo)"
              help="Nên dùng ảnh ngang; hệ thống tự tạo bản 1200×630."
              value={payload.image}
              disabled={disabled}
              onChange={(image) => set({ image })}
            />
            <Field label="Lập chỉ mục" wide>
              <Switch
                label="Ẩn trang này khỏi Google (noindex)"
                checked={!!payload.noindex}
                disabled={disabled}
                onChange={(noindex) => set({ noindex })}
              />
            </Field>
          </div>
        </Card>
      )}
    />
  );
}

export function SeoPage() {
  const path = useSearchParams().get("path");
  const docs = useDocuments("SEO"),
    services = useDocuments("SERVICE"),
    news = useDocuments("NEWS"),
    [q, setQ] = useState("");
  const rows = useMemo(() => {
    const paths = new Map<string, string>(fixed);
    for (const s of defaultServices)
      paths.set(`/services/${s.key}`, `Dịch vụ: ${s.payload.title}`);
    for (const s of services.data)
      paths.set(`/services/${s.key}`, `Dịch vụ: ${s.title}`);
    for (const a of defaultArticles)
      paths.set(`/news/${a.key}`, `Tin: ${a.payload.title}`);
    for (const a of news.data) paths.set(`/news/${a.key}`, `Tin: ${a.title}`);
    return [...paths].map(([p, label]) => {
      const doc = docs.data.find((d) => d.key === p);
      return {
        path: p,
        label,
        doc,
        issues: doc ? score(doc.title, doc.summary?.description) : [],
      };
    });
  }, [docs.data, services.data, news.data]);
  if (path) return <SeoEditor key={path} path={path} />;
  const shown = rows.filter(
    (r) => !q || `${r.path} ${r.label}`.toLowerCase().includes(q.toLowerCase()),
  );
  const custom = rows.filter((r) => r.doc?.publishedRevisionId).length;
  return (
    <>
      <PageHeader
        title="SEO"
        description="Tiêu đề, mô tả và ảnh chia sẻ của từng trang. Trang chưa thiết lập dùng tiêu đề mặc định của website."
      />
      <div className="cms-stats" data-count="4">
        <Stat icon="globe" value={rows.length} label="Trang công khai" />
        <Stat icon="check" value={custom} label="Đã tùy chỉnh SEO" />
        <Stat
          icon="alert"
          value={rows.filter((r) => r.issues.length).length}
          label="Cần cải thiện"
        />
        <Stat
          icon="clock"
          value={docs.data.filter((d) => d.hasDraft).length}
          label="Chưa áp dụng"
        />
      </div>
      {docs.error && <Alert tone="danger">{docs.error}</Alert>}
      <Card pad={false}>
        <div className="cms-toolbar">
          <div className="cms-input-icon">
            <CmsIcon name="search" />
            <Input
              type="search"
              placeholder="Tìm trang…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Tìm trang"
            />
          </div>
        </div>
        {docs.loading ? (
          <div className="cms-card-body">
            <Loading />
          </div>
        ) : (
          <div className="cms-table-wrap">
            <table className="cms-table">
              <thead>
                <tr>
                  <th>Trang</th>
                  <th>Tiêu đề SEO</th>
                  <th>Kiểm tra</th>
                  <th>Trạng thái</th>
                  <th className="cms-cell-actions">
                    <span className="cms-sr-only">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const st = statusOf(r.doc, false);
                  return (
                    <tr key={r.path}>
                      <td>
                        <Link
                          className="cms-cell-title"
                          href={`/admin/seo?path=${encodeURIComponent(r.path)}`}
                        >
                          <span>
                            <strong>{r.label}</strong>
                            <small>{localPath(r.path)}</small>
                          </span>
                        </Link>
                      </td>
                      <td>
                        {r.doc?.title || (
                          <span className="cms-help">Mặc định</span>
                        )}
                      </td>
                      <td>
                        {!r.doc ? (
                          <span className="cms-help">—</span>
                        ) : r.issues.length ? (
                          <Badge tone="warn">{r.issues[0]}</Badge>
                        ) : (
                          <Badge tone="success">Tốt</Badge>
                        )}
                      </td>
                      <td>
                        <Badge tone={r.doc ? statusLabel[st].tone : "neutral"}>
                          {r.doc ? statusLabel[st].text : "Mặc định"}
                        </Badge>
                      </td>
                      <td className="cms-cell-actions">
                        <ButtonLink
                          size="sm"
                          variant="ghost"
                          icon="pencil"
                          href={`/admin/seo?path=${encodeURIComponent(r.path)}`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
