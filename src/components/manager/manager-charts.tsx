"use client";

import { useState } from "react";
import { shiftDate, statuses } from "@/lib/booking/logic";
import { StatusBadge } from "@/components/admin/primitives";
import type { BookingStatus } from "@/lib/booking/types";
import type { ManagerBooking, CapacitySlot } from "@/lib/manager/mock";

export function BookingTrend({
  bookings,
  today,
  days,
}: {
  bookings: ManagerBooking[];
  today: string;
  days: number;
}) {
  const [metric, setMetric] = useState<"all" | "confirmed">("all");
  const count = days === 1 ? 7 : days;
  const points = Array.from({ length: count }, (_, i) => {
    const date = shiftDate(today, i - count + 1);
    return {
      date,
      count: bookings.filter(
        (item) =>
          item.date === date &&
          (metric === "all" || item.status === "confirmed"),
      ).length,
    };
  });
  const max = Math.max(4, ...points.map((point) => point.count));
  const coords = points.map((point, i) => ({
    ...point,
    x: 40 + (i * 600) / (points.length - 1),
    y: 175 - (point.count / max) * 145,
  }));
  return (
    <figure className="mgr-chart">
      <div className="mgr-chart-control">
        <button
          aria-pressed={metric === "all"}
          onClick={() => setMetric("all")}
        >
          <i />
          Tổng lịch hẹn
        </button>
        <button
          aria-pressed={metric === "confirmed"}
          onClick={() => setMetric("confirmed")}
        >
          <i className="mgr-blue" />
          Đã xác nhận
        </button>
        <span>{points.length} ngày gần nhất</span>
      </div>
      <svg
        viewBox="0 0 680 220"
        role="img"
        aria-label={`Biểu đồ ${metric === "all" ? "tổng lịch hẹn" : "lịch đã xác nhận"} trong ${points.length} ngày`}
      >
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <line
              className="mgr-chart-grid"
              x1="40"
              y1={30 + i * 48}
              x2="650"
              y2={30 + i * 48}
            />
            <text x="8" y={34 + i * 48}>
              {Math.round(max * (1 - i / 3))}
            </text>
          </g>
        ))}
        <path
          className="mgr-chart-fill"
          d={`M40,175 ${coords.map((point) => `L${point.x},${point.y}`).join(" ")} L640,175 Z`}
        />
        <polyline
          className={`mgr-chart-line ${metric === "confirmed" ? "mgr-blue-line" : ""}`}
          points={coords.map((point) => `${point.x},${point.y}`).join(" ")}
        />
        {coords.map((point, i) => (
          <g key={point.date}>
            <circle
              cx={point.x}
              cy={point.y}
              r={points.length > 10 ? 3 : 4}
              tabIndex={0}
            >
              <title>
                {point.date.split("-").reverse().join("/")}: {point.count} lịch
              </title>
            </circle>
            {(points.length <= 7 || i % 5 === 0 || i === points.length - 1) && (
              <text x={point.x} y="207" textAnchor="middle">
                {point.date.slice(8)}/{point.date.slice(5, 7)}
              </text>
            )}
          </g>
        ))}
      </svg>
      <figcaption>
        Tổng {points.reduce((sum, point) => sum + point.count, 0)}{" "}
        {metric === "confirmed" ? "lịch đã xác nhận." : "lịch hẹn."}
      </figcaption>
    </figure>
  );
}

export function BookingDistribution({
  bookings,
}: {
  bookings: ManagerBooking[];
}) {
  const entries = (Object.keys(statuses) as BookingStatus[]).map((status) => ({
    status,
    count: bookings.filter((booking) => booking.status === status).length,
  }));
  const total = Math.max(1, bookings.length);
  let offset = 0;
  return (
    <div className="mgr-distribution">
      <div className="mgr-donut">
        <svg
          viewBox="0 0 120 120"
          role="img"
          aria-label={`Phân bố ${bookings.length} lịch hẹn theo trạng thái`}
        >
          <circle cx="60" cy="60" r="46" className="mgr-donut-base" />
          {entries.map((entry) => {
            const start = offset;
            offset += (entry.count / total) * 100;
            return (
              <circle
                key={entry.status}
                cx="60"
                cy="60"
                r="46"
                pathLength="100"
                className={`mgr-stroke-${entry.status}`}
                strokeDasharray={`${(entry.count / total) * 100} 100`}
                strokeDashoffset={-start}
                transform="rotate(-90 60 60)"
              >
                <title>
                  {statuses[entry.status]}: {entry.count}
                </title>
              </circle>
            );
          })}
        </svg>
        <div>
          <strong>{bookings.length}</strong>
          <span>Lịch hẹn</span>
        </div>
      </div>
      <div className="mgr-distribution-legend">
        {entries.map((entry) => (
          <div key={entry.status}>
            <StatusBadge status={entry.status} />
            <strong>{entry.count}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CapacityBars({ slots }: { slots: CapacitySlot[] }) {
  return (
    <div className="mgr-capacity-bars">
      {slots.map((slot) => (
        <div key={slot.id}>
          <div>
            <strong>{slot.time}</strong>
            <span>
              {slot.total > 0
                ? `${Math.round((slot.reserved / slot.total) * 100)}%`
                : "Ngừng nhận"}
            </span>
          </div>
          <progress
            value={Math.min(slot.reserved, slot.total)}
            max={slot.total || 1}
            aria-label={`${slot.time}, ${slot.reserved}/${slot.total} ${slot.unit}`}
            data-state={slot.state}
          />
          <small>{slot.resource}</small>
        </div>
      ))}
    </div>
  );
}
