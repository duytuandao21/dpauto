"use client";
import Link from "next/link";
import { formatMoney } from "@/lib/advisor/seed";
import {
  operationStages,
  orderAmounts,
  staffWorkload,
} from "@/lib/manager/operations";
import { useManager } from "./manager-provider";
import { ManagerPanel } from "./manager-ui";
export function ManagerOperationalOverview({
  report = false,
  start,
  end,
}: {
  report?: boolean;
  start: string;
  end: string;
}) {
  const { data, now } = useManager();
  const orders = data.orders.filter(
    (o) => o.openedAt.slice(0, 10) >= start && o.openedAt.slice(0, 10) <= end,
  );
  const overdue = orders.filter(
    (o) => o.stage !== "done" && o.work.dueAt && Date.parse(o.work.dueAt) < now,
  );
  const complete = orders.filter((o) => o.stage === "done");
  const timed = complete.filter(
    (o) =>
      o.acceptance.checkedAt &&
      Date.parse(o.acceptance.checkedAt) >= Date.parse(o.openedAt),
  );
  const kpis = [
    ...Object.entries(operationStages).map(([stage, label]) => ({
      label,
      value: orders.filter((o) => o.stage === stage).length,
      href: `/dieu-hanh/phieu-dich-vu?stage=${stage}`,
      tone: stage === "done" ? "success" : stage === "work" ? "blue" : "brand",
    })),
    {
      label: "Xe quá thời gian dự kiến",
      value: overdue.length,
      href: "/dieu-hanh/phieu-dich-vu?urgency=overdue",
      tone: "danger",
    },
    {
      label: "Khung giờ gần đầy / đầy",
      value: data.capacity.filter(
        (s) => s.date === end && s.reserved >= s.total * 0.8 && !s.locked,
      ).length,
      href: `/dieu-hanh/nang-luc?date=${end}`,
      tone: "warning",
    },
  ];
  return (
    <>
      <ManagerPanel
        title="Vận hành dịch vụ"
        description={`${orders.length} xe tiếp nhận trong kỳ · Trạng thái xe độc lập với thanh toán`}
      >
        <div className="mgr-kpis mgr-kpis-operations">
          {kpis.map((k) => (
            <Link
              href={`${k.href}&from=${start}&to=${end}`}
              className="adm-panel mgr-kpi mgr-kpi-link"
              data-tone={k.tone}
              key={k.label}
            >
              <div>{k.label}</div>
              <strong>{k.value}</strong>
              <p>Xem danh sách ↗</p>
            </Link>
          ))}
        </div>
      </ManagerPanel>
      {report && (
        <>
          <div className="mgr-settings-grid">
            <ManagerPanel title="Hiệu quả xử lý trong kỳ">
              <div className="mgr-summary-row">
                <span>Tỷ lệ hoàn tất trên xe tiếp nhận</span>
                <strong>
                  {orders.length
                    ? `${Math.round((complete.length / orders.length) * 100)}%`
                    : "Chưa có dữ liệu"}
                </strong>
              </div>
              <div className="mgr-summary-row">
                <span>Thời gian tiếp nhận → nghiệm thu trung bình</span>
                <strong>
                  {timed.length
                    ? `${Math.round(timed.reduce((n, o) => n + (Date.parse(o.acceptance.checkedAt) - Date.parse(o.openedAt)) / 60000, 0) / timed.length)} phút (${timed.length} xe)`
                    : "Chưa đủ mốc thời gian"}
                </strong>
              </div>
              <div className="mgr-summary-row">
                <span>Xe quá deadline</span>
                <strong>{overdue.length}</strong>
              </div>
              <div className="mgr-summary-row">
                <span>Tỷ lệ khách đến theo lịch trong kỳ</span>
                <strong>
                  {(() => {
                    const bookings = data.bookings.filter(
                      (b) => b.date >= start && b.date <= end,
                    );
                    return bookings.length
                      ? `${Math.round((bookings.filter((b) => ["arrived", "completed"].includes(b.status)).length / bookings.length) * 100)}%`
                      : "Chưa có dữ liệu";
                  })()}
                </strong>
              </div>
            </ManagerPanel>
            <ManagerPanel title="Giá trị báo giá đã chốt theo ngày">
              {[...new Set(orders.map((o) => o.openedAt.slice(0, 10)))].map(
                (date) => (
                  <div className="mgr-summary-row" key={date}>
                    <span>{date}</span>
                    <strong>
                      {formatMoney(
                        orders
                          .filter(
                            (o) =>
                              o.openedAt.startsWith(date) &&
                              o.quote.status === "confirmed",
                          )
                          .reduce((n, o) => n + orderAmounts(o).total, 0),
                      )}
                    </strong>
                  </div>
                ),
              )}
              <Link className="adm-text-link" href="/dieu-hanh/tai-chinh">
                Xem tiền cọc, đã thu và công nợ ↗
              </Link>
            </ManagerPanel>
          </div>
          <ManagerPanel title="Khối lượng CVDV / KTV">
            <div className="mgr-table-scroll">
              <table className="mgr-table mgr-record-table">
                <thead>
                  <tr>
                    <th>Nhân viên</th>
                    <th>Xe đang xử lý</th>
                    <th>Việc chưa xong</th>
                    <th>Xe quá hạn</th>
                  </tr>
                </thead>
                <tbody>
                  {data.staff
                    .filter((s) => s.role !== "manager")
                    .map((s) => {
                      const w = staffWorkload(data, s.id, now);
                      return (
                        <tr key={s.id}>
                          <td data-label="Nhân viên">
                            {s.name}
                            <small>
                              {s.role === "advisor" ? "CVDV" : "KTV"}
                            </small>
                          </td>
                          <td data-label="Xe đang xử lý">{w.orders.length}</td>
                          <td data-label="Việc chưa xong">{w.tasks}</td>
                          <td data-label="Xe quá hạn">{w.overdue}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </ManagerPanel>
        </>
      )}
    </>
  );
}
