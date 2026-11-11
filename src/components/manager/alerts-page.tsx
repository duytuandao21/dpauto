"use client";
import Link from "next/link";
import { useState } from "react";
import { PageHeading } from "@/components/admin/primitives";
import { operationAlerts } from "@/lib/manager/operations";
import { useManager } from "./manager-provider";
import { FilterSelect, ManagerEmpty, ManagerPanel } from "./manager-ui";
import { OperationTime } from "./order-drawer";

export function ManagerAlertList({ limit }: { limit?: number }) {
  const { data, now } = useManager();
  const [priority, setPriority] = useState("");
  const [type, setType] = useState("");
  const alerts = operationAlerts(data, now).filter(
    (a) => (!priority || a.priority === priority) && (!type || a.type === type),
  );
  return (
    <>
      {!limit && (
        <div className="mgr-toolbar">
          <FilterSelect
            label="Mức ưu tiên"
            value={priority}
            onChange={setPriority}
          >
            <option value="">Tất cả</option>
            <option value="danger">Khẩn cấp</option>
            <option value="warning">Cần xử lý</option>
            <option value="blue">Theo dõi</option>
          </FilterSelect>
          <FilterSelect label="Loại cảnh báo" value={type} onChange={setType}>
            <option value="">Tất cả</option>
            {Object.entries({
              booking: "Lịch hẹn",
              capacity: "Năng lực",
              deadline: "Quá hạn",
              assignment: "Phân công",
              work: "Thi công",
              quote: "Báo giá",
              acceptance: "Nghiệm thu",
              stock: "Tồn kho",
            }).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </FilterSelect>
          <span className="adm-muted">{alerts.length} cảnh báo</span>
        </div>
      )}
      <div className="mgr-alerts">
        {alerts.slice(0, limit || alerts.length).map((a) => (
          <Link
            className="mgr-alert"
            data-tone={a.priority}
            href={a.href}
            key={a.id}
          >
            <div>
              <span className={`mgr-pill mgr-pill-${a.priority}`}>
                {a.priority === "danger"
                  ? "⚠ Khẩn cấp"
                  : a.priority === "warning"
                    ? "! Cần xử lý"
                    : "ⓘ Theo dõi"}
              </span>
              <strong>{a.title}</strong>
              <small>
                {a.target} · {a.detail}
              </small>
              {a.at && (
                <small>
                  <OperationTime value={a.at} />
                </small>
              )}
            </div>
            <span className="mgr-alert-link">Xem chi tiết ↗</span>
          </Link>
        ))}
      </div>
      {!alerts.length && <ManagerEmpty message="Không có cảnh báo phù hợp" />}
      {limit && (
        <Link className="adm-text-link" href="/dieu-hanh/canh-bao">
          Xem tất cả {alerts.length} cảnh báo ↗
        </Link>
      )}
    </>
  );
}
export function ManagerAlertsPage() {
  return (
    <>
      <PageHeading
        title="Cảnh báo điều hành"
        description="Ưu tiên xử lý lịch hẹn, tiến độ xe và nguồn lực toàn trạm."
      />
      <ManagerPanel title="Công việc cần chú ý">
        <ManagerAlertList />
      </ManagerPanel>
    </>
  );
}
