"use client";
import Link from "next/link";
import { CmsIcon, type CmsIconName } from "./icon";
import { Badge, Empty, timeAgo, dateTime, type Tone } from "./ui";
import { editPath, kindLabel, type Activity } from "./data";

export const actions: Record<
  string,
  { label: string; tone: Tone; icon: CmsIconName }
> = {
  CMS_DRAFT_SAVED: { label: "Lưu nội dung", tone: "info", icon: "save" },
  CMS_PUBLISHED: { label: "Cập nhật website", tone: "success", icon: "send" },
  CMS_WITHDRAWN: { label: "Gỡ khỏi website", tone: "danger", icon: "eyeOff" },
  CMS_REVERTED: { label: "Khôi phục mặc định", tone: "purple", icon: "revert" },
  CMS_MEDIA_CREATED: { label: "Tải ảnh lên", tone: "info", icon: "upload" },
  CMS_MEDIA_UPDATED: {
    label: "Sửa thông tin ảnh",
    tone: "warn",
    icon: "pencil",
  },
  CMS_MEDIA_DELETED: { label: "Xóa ảnh", tone: "danger", icon: "trash" },
  CMS_MEDIA_RESTORED: {
    label: "Khôi phục ảnh",
    tone: "success",
    icon: "revert",
  },
};
const toneLabel: Record<Tone, string> = {
  neutral: "",
  info: "đã lưu",
  success: "thành công",
  warn: "cập nhật",
  danger: "đã gỡ",
  purple: "mặc định",
};

export function ActivityFeed({
  items,
  full,
}: {
  items: Activity[];
  full?: boolean;
}) {
  if (!items.length)
    return (
      <Empty icon="history" title="Chưa có hoạt động">
        Các thao tác lưu nội dung và tải ảnh sẽ hiện ở đây.
      </Empty>
    );
  return (
    <div className="cms-feed">
      {items.map((a) => {
        const meta = actions[a.action] || {
          label: a.action,
          tone: "neutral" as Tone,
          icon: "file" as CmsIconName,
        };
        const doc =
          a.target.type === "document" && a.target.kind && a.target.key;
        return (
          <div className="cms-feed-item" key={a.id}>
            <span className="cms-feed-icon" data-tone={meta.tone}>
              <CmsIcon name={meta.icon} />
            </span>
            <div className="cms-feed-body">
              <div className="cms-feed-title">
                {meta.label}
                {toneLabel[meta.tone] && (
                  <Badge tone={meta.tone}>{toneLabel[meta.tone]}</Badge>
                )}
              </div>
              <div className="cms-feed-meta">
                {doc ? (
                  <Link
                    className="cms-link"
                    href={editPath(a.target.kind!, a.target.key!)}
                  >
                    {a.target.title || a.target.key}
                  </Link>
                ) : (
                  <Link className="cms-link" href="/admin/thu-vien-anh">
                    {a.target.title || "Ảnh"}
                  </Link>
                )}{" "}
                bởi {a.actor}
                {doc && (
                  <small>
                    <span className="cms-dot" />
                    {kindLabel[a.target.kind!]}
                  </small>
                )}
                {full && a.reason && !/^Revision /.test(a.reason) && (
                  <small>
                    <span className="cms-dot" />
                    {a.reason.replace(/; revision .*/, "")}
                  </small>
                )}
              </div>
            </div>
            <time
              className="cms-feed-time"
              dateTime={a.at}
              title={dateTime(a.at)}
            >
              {full ? dateTime(a.at) : timeAgo(a.at)}
            </time>
          </div>
        );
      })}
    </div>
  );
}

/** Minimal multi-series line chart in SVG, sized by its container. */
export function LineChart({
  labels,
  series,
}: {
  labels: string[];
  series: { name: string; color: string; values: number[] }[];
}) {
  const w = 760,
    h = 260,
    pad = { l: 36, r: 12, t: 12, b: 28 },
    max = Math.max(4, ...series.flatMap((s) => s.values)),
    top = Math.ceil(max / 4) * 4,
    x = (i: number) =>
      pad.l + (i * (w - pad.l - pad.r)) / Math.max(1, labels.length - 1),
    y = (v: number) => pad.t + (1 - v / top) * (h - pad.t - pad.b);
  return (
    <div className="cms-chart">
      <div className="cms-chart-legend">
        {series.map((s) => (
          <span key={s.name} style={{ color: s.color }}>
            <i />
            <b style={{ color: "var(--c-muted-strong)", fontWeight: 400 }}>
              {s.name}
            </b>
          </span>
        ))}
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label="Biểu đồ hoạt động nội dung theo tháng"
      >
        {[0, 1, 2, 3, 4].map((i) => {
          const v = (top / 4) * i;
          return (
            <g key={i}>
              <line
                x1={pad.l}
                x2={w - pad.r}
                y1={y(v)}
                y2={y(v)}
                stroke="var(--c-border)"
              />
              <text
                x={pad.l - 8}
                y={y(v) + 4}
                textAnchor="end"
                fontSize="11"
                fill="var(--c-muted)"
              >
                {v}
              </text>
            </g>
          );
        })}
        {labels.map((l, i) => (
          <g key={l}>
            <line
              x1={x(i)}
              x2={x(i)}
              y1={pad.t}
              y2={h - pad.b}
              stroke="var(--c-border)"
              strokeOpacity="0.6"
            />
            <text
              x={x(i)}
              y={h - 8}
              textAnchor="middle"
              fontSize="11"
              fill="var(--c-muted)"
            >
              {l}
            </text>
          </g>
        ))}
        {series.map((s) => (
          <g key={s.name}>
            <polyline
              fill="none"
              stroke={s.color}
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
            />
            {s.values.map((v, i) => (
              <circle
                key={i}
                cx={x(i)}
                cy={y(v)}
                r="3.5"
                fill="var(--c-bg)"
                stroke={s.color}
                strokeWidth="2"
              >
                <title>{`${s.name} ${labels[i]}: ${v}`}</title>
              </circle>
            ))}
          </g>
        ))}
      </svg>
    </div>
  );
}
