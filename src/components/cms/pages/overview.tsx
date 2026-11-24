"use client";
import Link from "next/link";
import { defaultLists } from "@/lib/cms-defaults";
import { ActivityFeed, LineChart } from "../activity";
import { CmsIcon } from "../icon";
import {
  Alert,
  Badge,
  ButtonLink,
  Card,
  Empty,
  Loading,
  PageHeader,
  Stat,
  bytes,
  dateTime,
  timeAgo,
} from "../ui";
import {
  editPath,
  kindLabel,
  useApi,
  type DocSummary,
  type Overview as Data,
} from "../data";
import { collection } from "@/lib/api/client";
import { useEffect, useState } from "react";

/** Items on the website = built-in defaults + CMS documents with new keys. */
function useCounts() {
  const [docs, setDocs] = useState<DocSummary[] | null>(null);
  useEffect(() => {
    const a = new AbortController();
    collection<DocSummary>("admin/cms/documents", a.signal)
      .then(setDocs)
      .catch(() => setDocs([]));
    return () => a.abort();
  }, []);
  const count = (kind: keyof typeof defaultLists) => {
    const keys = new Set<string>(defaultLists[kind].map((d) => d.key));
    for (const d of docs || [])
      if (d.kind === kind && d.publishedRevisionId) keys.add(d.key);
    for (const d of docs || [])
      if (
        d.kind === kind &&
        (d.withdrawn || (d.hidden && d.publishedRevisionId))
      )
        keys.delete(d.key);
    return keys.size;
  };
  return { docs, count };
}

export function OverviewPage() {
  const o = useApi<Data>("admin/cms/overview"),
    { docs, count } = useCounts();
  const d = o.data;
  const months = Array.from({ length: 12 }, (_, i) => {
    const t = new Date();
    t.setDate(1);
    t.setMonth(t.getMonth() - 11 + i);
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
  });
  const by = (m: string) => d?.months.find((x) => x.month === m);
  const drafts = d
    ? Object.values(d.kinds).reduce((n, k) => n + (k?.drafts || 0), 0)
    : 0;
  const settingsLive = docs?.some(
    (x) => x.kind === "SETTINGS" && x.publishedRevisionId && !x.withdrawn,
  );
  const warnings = [
    !settingsLive && {
      text: "Thông tin cửa hàng (tên, địa chỉ, email) vẫn đang dùng dữ liệu mẫu ở footer và trang liên hệ.",
      href: "/admin/cai-dat",
      action: "Cập nhật",
    },
    drafts > 0 && {
      text: `${drafts} nội dung có thay đổi chưa áp dụng lên website.`,
      href: "#drafts",
      action: "Xem",
    },
    (d?.media.trash || 0) > 0 && {
      text: `${d!.media.trash} ảnh trong thùng rác sẽ bị xóa vĩnh viễn sau 30 ngày.`,
      href: "/admin/thu-vien-anh?trash=1",
      action: "Mở thùng rác",
    },
    docs &&
      !docs.some((x) => x.kind === "SEO") && {
        text: "Chưa có trang nào được tùy chỉnh SEO (tiêu đề và mô tả trên Google).",
        href: "/admin/seo",
        action: "Thiết lập",
      },
  ].filter(Boolean) as { text: string; href: string; action: string }[];
  return (
    <>
      <PageHeader
        title="Tổng quan nội dung"
        description="Chào mừng quay lại — đây là tình hình nội dung website hôm nay."
        actions={
          <>
            <ButtonLink variant="primary" href="/admin/tin-tuc/moi" icon="plus">
              Viết bài mới
            </ButtonLink>
            <ButtonLink href="/admin/thu-vien-anh" icon="upload">
              Tải ảnh lên
            </ButtonLink>
          </>
        }
      />
      {o.error && <Alert tone="danger">{o.error}</Alert>}
      <div className="cms-stats">
        <Stat
          icon="wrench"
          value={docs ? count("SERVICE") : "…"}
          label="Dịch vụ"
          note="Đang hiển thị trên website"
          href="/admin/dich-vu"
        />
        <Stat
          icon="newspaper"
          value={docs ? count("NEWS") : "…"}
          label="Tin tức"
          note="Bài viết công khai"
          href="/admin/tin-tuc"
        />
        <Stat
          icon="package"
          value={docs ? count("ACCESSORY") : "…"}
          label="Phụ kiện"
          note="Sản phẩm trong danh mục"
          href="/admin/phu-kien"
        />
        <Stat
          icon="award"
          value={docs ? count("PROJECT") : "…"}
          label="Thành quả"
          note="Dự án trước / sau"
          href="/admin/thanh-qua"
        />
        <Stat
          icon="image"
          value={d ? d.media.count.toLocaleString("vi-VN") : "…"}
          label="Ảnh trong thư viện"
          note={d ? `Dung lượng gốc ${bytes(d.media.bytes)}` : undefined}
          href="/admin/thu-vien-anh"
        />
        <Stat
          icon="file"
          value={d ? drafts : "…"}
          label="Chưa áp dụng"
          note="Đã lưu, chưa lên website"
          trend={drafts ? { text: "Cần xử lý", tone: "warn" } : undefined}
        />
      </div>
      <Card
        title="Hoạt động nội dung"
        action={<Badge>12 tháng gần nhất</Badge>}
        className="cms-chart-card"
      >
        {o.loading && !d ? (
          <Loading rows={3} />
        ) : (
          <LineChart
            labels={months.map((m) => `T${+m.slice(5)}`)}
            series={[
              {
                name: "Cập nhật website",
                color: "#3b82f6",
                values: months.map((m) => by(m)?.published || 0),
              },
              {
                name: "Lưu nội dung",
                color: "#10b981",
                values: months.map((m) => by(m)?.saved || 0),
              },
              {
                name: "Tải ảnh",
                color: "#f59e0b",
                values: months.map((m) => by(m)?.uploaded || 0),
              },
            ]}
          />
        )}
      </Card>
      <div className="cms-grid-2" style={{ marginTop: 24 }}>
        <Card
          title="Hoạt động gần đây"
          action={
            <Link className="cms-link" href="/admin/lich-su">
              Xem tất cả
            </Link>
          }
          footer={
            <>
              <span>
                Cập nhật {d ? timeAgo(new Date().toISOString()) : "…"}
              </span>
              <Link className="cms-link" href="/admin/lich-su">
                Nhật ký đầy đủ
              </Link>
            </>
          }
        >
          {d ? <ActivityFeed items={d.recent} /> : <Loading />}
        </Card>
        <div className="cms-stack">
          <Card title="Cần chú ý">
            {warnings.length ? (
              <div className="cms-stack-sm">
                {warnings.map((w) => (
                  <div className="cms-row-card" data-tone="warn" key={w.text}>
                    <CmsIcon name="alert" />
                    <div className="cms-row-main">
                      <span style={{ fontSize: 14, color: "inherit" }}>
                        {w.text}
                      </span>
                    </div>
                    <Link
                      className="cms-btn cms-btn-outline cms-btn-sm"
                      href={w.href}
                    >
                      {w.action}
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <Empty icon="check" title="Mọi thứ đều ổn">
                Không có cảnh báo nào.
              </Empty>
            )}
          </Card>
          <Card title="Thao tác nhanh">
            <div className="cms-stack-sm">
              {[
                [
                  "/admin/trang-chu",
                  "home",
                  "Sửa trang chủ",
                  "Hero, dịch vụ nổi bật, đánh giá, FAQ…",
                ],
                [
                  "/admin/dich-vu/moi",
                  "wrench",
                  "Thêm dịch vụ",
                  "Bài giới thiệu, quy trình, bảng giá",
                ],
                [
                  "/admin/phu-kien/moi",
                  "package",
                  "Thêm phụ kiện",
                  "Giá, ảnh, thương hiệu",
                ],
                [
                  "/admin/cai-dat",
                  "settings",
                  "Thông tin cửa hàng",
                  "Địa chỉ, giờ mở cửa, mạng xã hội",
                ],
              ].map(([href, icon, title, sub]) => (
                <Link className="cms-row-card" href={href} key={href}>
                  <span className="cms-feed-icon">
                    <CmsIcon name={icon as "home"} />
                  </span>
                  <div className="cms-row-main">
                    <strong>{title}</strong>
                    <span>{sub}</span>
                  </div>
                  <CmsIcon name="chevronRight" />
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>
      <div className="cms-grid-2">
        <Card
          title="Thay đổi chưa áp dụng"
          className=""
          action={<Badge tone="warn">{drafts}</Badge>}
        >
          <div id="drafts" className="cms-stack-sm">
            {!d ? (
              <Loading rows={3} />
            ) : d.drafts.length ? (
              d.drafts.map((x) => (
                <div className="cms-row-card" key={x.id}>
                  <div className="cms-row-main">
                    <strong>{x.title}</strong>
                    <span>
                      <Badge tone="info">{kindLabel[x.kind]}</Badge>
                      <span className="cms-dot" />
                      <CmsIcon name="clock" size={12} />
                      {timeAgo(x.updatedAt)}
                    </span>
                  </div>
                  <Badge tone="warn">chưa áp dụng</Badge>
                  <ButtonLink
                    size="sm"
                    variant="ghost"
                    icon="pencil"
                    href={editPath(x.kind, x.key)}
                  />
                </div>
              ))
            ) : (
              <Empty icon="check" title="Mọi thay đổi đã lên website" />
            )}
          </div>
        </Card>
        <Card
          title="Lịch đăng bài"
          action={
            <Link className="cms-link" href="/admin/tin-tuc/moi">
              Lên lịch bài mới
            </Link>
          }
        >
          <div className="cms-stack-sm">
            {!d ? (
              <Loading rows={3} />
            ) : d.scheduled.length ? (
              d.scheduled.map((s) => (
                <div className="cms-row-card" key={s.id}>
                  <div className="cms-row-main">
                    <strong>{s.title}</strong>
                    <span>
                      <CmsIcon name="calendar" size={12} />
                      {dateTime(s.publishAt)}
                    </span>
                  </div>
                  <Badge tone="info">đã lên lịch</Badge>
                  <ButtonLink
                    size="sm"
                    variant="ghost"
                    icon="pencil"
                    href={`/admin/tin-tuc/${s.key}`}
                  />
                </div>
              ))
            ) : (
              <Empty icon="calendar" title="Chưa có bài hẹn giờ">
                Khi viết bài, chọn “Hẹn giờ đăng” để bài tự xuất hiện vào thời
                điểm đã chọn.
              </Empty>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
