"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useBookings } from "@/components/admin/booking-provider";
import { bookingTime, localDate } from "@/lib/booking/logic";
import { quoteTotals } from "@/lib/advisor/seed";
import { useAdvisor } from "./advisor-provider";
import { apiEnabled, collection } from "@/lib/api/client";
import { visitFollowUp, type Visit } from "@/lib/api/visits";

interface Task {
  id: string;
  label: string;
  detail: string;
  href: string;
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
  const today = localDate();
  const now = Date.now();
  const tasks: Task[] = [];
  for (const booking of data.bookings) {
    if (bookingTime(booking).slice(0, 10) !== today) continue;
    const customer =
      booking.customerSnapshot ||
      data.customers.find((item) => item.id === booking.customerId);
    const vehicle =
      booking.vehicleSnapshot ||
      data.vehicles.find((item) => item.id === booking.vehicleId);
    const difference =
      new Date(bookingTime(booking) + "+07:00").getTime() - now;
    if (booking.status === "pending")
      tasks.push({
        id: booking.id,
        label: "Xác nhận lịch hẹn",
        detail: `${bookingTime(booking).slice(11, 16)} · ${customer?.name} · ${vehicle?.plate}`,
        href: `/co-van/lich-hen/${booking.id}`,
        badge: "Chờ xác nhận",
        tone: "pending",
        priority: 1,
      });
    if (booking.status === "confirmed" && difference < 0)
      tasks.push({
        id: booking.id,
        label: "Khách chưa đến",
        detail: `${bookingTime(booking).slice(11, 16)} · ${customer?.name} · ${vehicle?.plate}`,
        href: `/co-van/lich-hen/${booking.id}`,
        badge: "Quá giờ hẹn",
        tone: "cancelled",
        priority: 0,
      });
    else if (booking.status === "confirmed" && difference <= 2 * 60 * 60 * 1000)
      tasks.push({
        id: booking.id,
        label: "Khách sắp đến",
        detail: `${bookingTime(booking).slice(11, 16)} · ${customer?.name} · ${vehicle?.plate}`,
        href: `/co-van/tiep-nhan/${booking.id}`,
        badge: "Tiếp nhận xe",
        tone: "confirmed",
        priority: 2,
      });
  }
  for (const visit of visits) {
    const task = visitFollowUp(visit, now);
    if (task)
      tasks.push({
        ...task,
        id: visit.id,
        detail: `${visit.vehicle.plate || visit.vehicle.model || visit.code} · ${visit.code}`,
        href: `/co-van/phieu-dich-vu/${visit.id}?tab=${task.tab}`,
      });
  }
  for (const order of orders) {
    const vehicle = data.vehicles.find((item) => item.id === order.vehicleId);
    const detail = `${vehicle?.plate || order.id} · ${order.id}`;
    if (order.stage === "quote")
      tasks.push({
        id: order.id,
        label:
          order.quote.status === "waiting"
            ? "Báo giá chờ xác nhận"
            : "Lập báo giá",
        detail,
        href: `/co-van/phieu-dich-vu/${order.id}?tab=bao-gia`,
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
        id: order.id,
        label: "Xe quá hạn hoàn thành",
        detail,
        href: `/co-van/phieu-dich-vu/${order.id}?tab=thi-cong`,
        badge: "Quá hạn",
        tone: "cancelled",
        priority: 0,
      });
    if (order.stage === "acceptance")
      tasks.push({
        id: order.id,
        label: "Xe chờ nghiệm thu",
        detail,
        href: `/co-van/phieu-dich-vu/${order.id}?tab=nghiem-thu`,
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
        id: order.id,
        label: "Xe chờ bàn giao",
        detail,
        href: `/co-van/phieu-dich-vu/${order.id}`,
        badge: "Hoàn tất",
        tone: "confirmed",
        priority: 5,
      });
  }
  tasks.sort((a, b) => a.priority - b.priority);
  return (
    <section className="adm-panel adv-tasks">
      <div className="adm-section-line">
        <h2>Cần xử lý</h2>
        <span className="adm-muted">{tasks.length} công việc</span>
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
      <div className="adv-task-list">
        {tasks.length ? (
          tasks.slice(0, 8).map((task) => (
            <Link key={task.id} href={task.href}>
              <span>
                <strong>{task.label}</strong>
                <small>{task.detail}</small>
              </span>
              <span className={`adm-badge adm-status-${task.tone}`}>
                {task.badge}
              </span>
            </Link>
          ))
        ) : (
          <p className="adm-muted" style={{ padding: 16 }}>
            {loading
              ? "Đang tải danh sách công việc."
              : error
                ? "Chưa tải được công việc từ phiếu dịch vụ."
                : "Chưa có công việc cần xử lý."}
          </p>
        )}
      </div>
      {tasks.length > 8 && (
        <p className="adm-field-help">
          Hiển thị 8 công việc ưu tiên. Xem thêm trong Lịch hẹn và Xe dịch vụ.
        </p>
      )}
    </section>
  );
}
