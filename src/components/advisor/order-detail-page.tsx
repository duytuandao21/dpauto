"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AdminIcon } from "@/components/admin/admin-icon";
import { useBookings } from "@/components/admin/booking-provider";
import {
  AdminLoading,
  EmptyState,
  PageHeading,
} from "@/components/admin/primitives";
import { advisors } from "@/lib/booking/seed";
import { formatDate } from "@/lib/booking/logic";
import { useAdvisor } from "./advisor-provider";
import { AcceptanceEditor } from "./acceptance-editor";
import {
  OrderHistory,
  OrderPerson,
  OrderSummary,
  StageBadge,
} from "./order-common";
import { QuoteEditor } from "./quote-editor";
import { WorkEditor } from "./work-editor";

const tabs = [
  { id: "tong-quan", label: "Tổng quan" },
  { id: "bao-gia", label: "Báo giá" },
  { id: "thi-cong", label: "Thi công" },
  { id: "nghiem-thu", label: "Nghiệm thu" },
] as const;

export function OrderDetailPage({ id }: { id: string }) {
  const { orders, ready } = useAdvisor();
  const { data } = useBookings();
  const params = useSearchParams();
  const tab =
    tabs.find((item) => item.id === params.get("tab"))?.id || "tong-quan";
  const order = orders.find((item) => item.id === id);
  if (!ready) return <AdminLoading />;
  if (!order)
    return (
      <div className="adv-page">
        <EmptyState
          title="Không tìm thấy phiếu dịch vụ"
          description="Phiếu này không có trong dữ liệu trên trình duyệt."
          create={false}
        />
        <Link className="adm-btn" href="/co-van/phieu-dich-vu">
          Về danh sách phiếu
        </Link>
      </div>
    );
  const vehicle = data.vehicles.find((item) => item.id === order.vehicleId);
  const advisor = advisors.find((item) => item.id === order.advisorId);
  return (
    <div className="adv-page adv-order-detail">
      <Link
        href="/co-van/phieu-dich-vu"
        className="adm-mobile-back adm-text-link"
      >
        <AdminIcon name="back" />
        Xe dịch vụ
      </Link>
      <PageHeading
        eyebrow="CỐ VẤN / PHIẾU DỊCH VỤ"
        title={order.id}
        description={`${vehicle?.plate || "Xe chưa có biển số"} · Tiếp nhận ${formatDate(order.openedAt)} · ${advisor?.name || "Chưa phân công"}`}
      >
        <StageBadge stage={order.stage} />
      </PageHeading>
      <nav className="adv-tabs" aria-label="Nội dung phiếu dịch vụ">
        {tabs.map((item) => (
          <Link
            key={item.id}
            href={`/co-van/phieu-dich-vu/${order.id}?tab=${item.id}`}
            className={tab === item.id ? "is-active" : ""}
            aria-current={tab === item.id ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {tab === "tong-quan" && (
        <div className="adv-stack">
          <OrderPerson order={order} />
          <OrderSummary order={order} />
          <section className="adm-panel">
            <div className="adm-section-line">
              <h2>Thông tin tiếp nhận</h2>
              <Link
                className="adm-text-link"
                href={`/co-van/lich-hen/${order.bookingId}`}
              >
                Xem lịch hẹn
              </Link>
            </div>
            <dl className="adm-info-grid">
              <div>
                <dt>Yêu cầu khách</dt>
                <dd>{order.request}</dd>
              </div>
              <div>
                <dt>ODO</dt>
                <dd>{order.odo ? `${order.odo} km` : "Chưa ghi"}</dd>
              </div>
              <div>
                <dt>Ngoại thất</dt>
                <dd>{order.exterior || "Chưa ghi"}</dd>
              </div>
              <div>
                <dt>Nội thất</dt>
                <dd>{order.interior || "Chưa ghi"}</dd>
              </div>
              <div>
                <dt>Động cơ</dt>
                <dd>{order.engine || "Chưa ghi"}</dd>
              </div>
              <div>
                <dt>Đèn taplo</dt>
                <dd>{order.dashboard || "Chưa ghi"}</dd>
              </div>
              <div>
                <dt>Lốp xe</dt>
                <dd>{order.tires || "Chưa ghi"}</dd>
              </div>
              <div>
                <dt>Ghi chú</dt>
                <dd>{order.receptionNote || "Chưa ghi"}</dd>
              </div>
            </dl>
            {order.operation.length > 0 && (
              <div className="adm-service-tags adv-tags">
                {order.operation.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            )}
            {order.photos?.length > 0 && (
              <div className="adv-photo-grid">
                {order.photos.map((photo) => (
                  <figure key={photo.id}>
                    <img src={photo.dataUrl} alt={photo.name} />
                  </figure>
                ))}
              </div>
            )}
          </section>
          <div className="adv-actions">
            <Link
              className="adm-btn adm-primary"
              href={`/co-van/phieu-dich-vu/${order.id}?tab=${order.stage === "quote" ? "bao-gia" : order.stage === "work" ? "thi-cong" : "nghiem-thu"}`}
            >
              Tiếp tục xử lý
            </Link>
          </div>
          <OrderHistory order={order} />
        </div>
      )}
      {tab === "bao-gia" && (
        <QuoteEditor key={`${order.id}-${order.quote.status}`} order={order} />
      )}
      {tab === "thi-cong" && (
        <WorkEditor key={`${order.id}-${order.stage}`} order={order} />
      )}
      {tab === "nghiem-thu" && (
        <AcceptanceEditor key={`${order.id}-${order.stage}`} order={order} />
      )}
    </div>
  );
}
