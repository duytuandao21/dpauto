"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useBookings } from "@/components/admin/booking-provider";
import { quoteTotals } from "@/lib/advisor/seed";
import { useAdvisor } from "./advisor-provider";
import { apiEnabled, collection } from "@/lib/api/client";
import { visitFollowUp, type Visit } from "@/lib/api/visits";
import { EmptyState } from "@/components/admin/primitives";
import { ServiceTicketsTable } from "./service-tickets-table";
import {
  localTicketStage,
  ticketAmount,
  ticketStage,
  type ServiceTicketRow,
} from "@/lib/advisor/service-tickets";

interface Task {
  id: string;
  label: string;
  code: string;
  customer: string;
  phone?: string;
  priorityAt: number;
  tab: string;
  badge: string;
  tone: "pending" | "confirmed" | "arrived" | "cancelled" | "completed";
  priority: number;
}

export function OverviewTasks() {
  const { data } = useBookings();
  const { orders } = useAdvisor();
  const [visits, setVisits] = useState<Visit[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(apiEnabled),
    [reload, setReload] = useState(0);
  useEffect(() => {
    if (!apiEnabled) return;
    const a = new AbortController();
    setLoading(true);
    collection<Visit>("admin/service-visits?activeOnly=true", a.signal)
      .then((values) => {
        if (!a.signal.aborted) {
          setVisits(values);
          setError("");
        }
      })
      .catch((e) => {
        if (!a.signal.aborted) {
          setVisits([]);
          setError(e.message);
        }
      })
      .finally(() => {
        if (!a.signal.aborted) setLoading(false);
      });
    return () => a.abort();
  }, [reload]);
  useEffect(() => {
    if (!apiEnabled) return;
    const update = () => setReload((n) => n + 1);
    window.addEventListener("focus", update);
    window.addEventListener("dpauto-data-updated", update);
    return () => {
      window.removeEventListener("focus", update);
      window.removeEventListener("dpauto-data-updated", update);
    };
  }, []);
  const now = Date.now();
  const tasks: Task[] = [];
  for (const visit of visits) {
    const task = visitFollowUp(visit, now);
    if (task)
      tasks.push({
        ...task,
        id: visit.id,
        code: visit.code,
        customer: visit.customer.name,
        phone: visit.customer.phone,
        priorityAt: new Date(
          task.priority === 0 && visit.work?.dueAt
            ? visit.work.dueAt
            : visit.receivedAt,
        ).getTime(),
      });
  }
  for (const order of orders) {
    const customer = data.customers.find(
      (item) => item.id === order.customerId,
    );
    const context = {
      id: order.id,
      code: order.id,
      customer: customer?.name || "Chưa có tên khách",
      phone: customer?.phone,
      priorityAt: new Date(
        order.stage === "work" && order.work.dueAt
          ? order.work.dueAt
          : order.openedAt,
      ).getTime(),
    };
    if (order.stage === "quote")
      tasks.push({
        ...context,
        label:
          order.quote.status === "waiting"
            ? "Báo giá chờ xác nhận"
            : "Lập báo giá",
        tab: "bao-gia",
        badge: order.quote.status === "waiting" ? "Theo dõi" : "Báo giá",
        tone: "pending",
        priority: 3,
      });
    if (
      order.stage === "work" &&
      order.work.dueAt &&
      new Date(order.work.dueAt).getTime() < now
    )
      tasks.push({
        ...context,
        label: "Xe quá hạn hoàn thành",
        tab: "thi-cong",
        badge: "Quá hạn",
        tone: "cancelled",
        priority: 0,
      });
    if (order.stage === "acceptance")
      tasks.push({
        ...context,
        label: "Xe chờ nghiệm thu",
        tab: "nghiem-thu",
        badge: "Nghiệm thu",
        tone: "arrived",
        priority: 4,
      });
    if (
      order.stage === "done" &&
      quoteTotals(order.quote.lines, order.quote.discount).total >
        order.finance.deposit + order.finance.collected
    )
      tasks.push({
        ...context,
        label: "Xe chờ bàn giao",
        tab: "doi-soat",
        badge: "Hoàn tất",
        tone: "confirmed",
        priority: 5,
      });
  }
  tasks.sort(
    (a, b) =>
      a.priority - b.priority ||
      a.priorityAt - b.priorityAt ||
      a.id.localeCompare(b.id),
  );
  const rows: ServiceTicketRow[] = tasks.slice(0, 5).map((task) => {
    const visit = visits.find((value) => value.id === task.id);
    const order = orders.find((value) => value.id === task.id)!;
    const vehicle =
      visit?.vehicle ||
      data.vehicles.find((value) => value.id === order.vehicleId);
    return {
      id: task.id,
      code: task.code,
      customer: task.customer,
      phone: task.phone || "",
      plate: vehicle?.plate || "",
      model: vehicle?.model || "",
      stage: visit ? ticketStage(visit) : localTicketStage(order),
      label: task.badge,
      tone: task.tone,
      amount: visit
        ? ticketAmount(visit)
        : {
            value: quoteTotals(
              order.quote.lines,
              order.quote.discount,
            ).total.toString(),
            label:
              order.quote.status === "confirmed"
                ? "Báo giá đã duyệt"
                : "Dự kiến",
          },
      action: {
        label: task.priority === 0 ? "Xử lý quá hạn" : task.label,
        tab: task.tab,
      },
    };
  });
  return (
    <section className="adv-tasks" aria-labelledby="service-tasks-heading">
      <div className="adm-schedule-header">
        <div className="adm-task-heading">
          <h2 id="service-tasks-heading">Phiếu dịch vụ cần xử lý</h2>
          <span className="adm-muted">{tasks.length} phiếu</span>
        </div>
      </div>
      <div className="adm-search-row adm-task-search">
        <span className="adm-muted">
          Ưu tiên phiếu quá hạn, sau đó theo bước xử lý và thời gian tiếp nhận
        </span>
      </div>
      {loading && (
        <p className="adm-muted" role="status">
          Đang cập nhật công việc…
        </p>
      )}
      {error && (
        <p className="adm-error-text" role="alert">
          {error}{" "}
          <button
            className="adm-btn adm-btn-sm"
            onClick={() => setReload((n) => n + 1)}
          >
            Tải lại công việc
          </button>
        </p>
      )}
      {!loading && !error && (
        <div>
          {tasks.length ? (
            <ServiceTicketsTable rows={rows} />
          ) : (
            <EmptyState
              title="Chưa có phiếu cần xử lý"
              description="Các phiếu cần xử lý sẽ hiển thị tại đây."
              create={false}
            />
          )}
        </div>
      )}
      <div className="adm-task-heading adv-overview-footer">
        <span className="adm-muted">
          {tasks.length > 5 ? `Hiển thị 5 / ${tasks.length} phiếu ưu tiên` : ""}
        </span>
        <Link className="adm-text-link" href="/co-van/phieu-dich-vu">
          Xem tất cả phiếu dịch vụ
        </Link>
      </div>
    </section>
  );
}
