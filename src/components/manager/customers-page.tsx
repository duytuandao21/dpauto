"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AdminLoading,
  PageHeading,
  StatusBadge,
} from "@/components/admin/primitives";
import { ManagerOrderDrawer } from "./order-drawer";
import { AdminIcon } from "@/components/admin/admin-icon";
import { formatDate } from "@/lib/booking/logic";
import { useManager } from "./manager-provider";
import {
  ManagerPanel,
  ManagerTable,
  ManagerPager,
  ManagerSearch,
  ManagerEmpty,
} from "./manager-ui";
import { ManagerModal } from "./manager-modal";
import { ManagerBookingDetail } from "./booking-list";

export function ManagerCustomersPage() {
  return (
    <Suspense fallback={<AdminLoading />}>
      <CustomersContent />
    </Suspense>
  );
}
function CustomersContent() {
  const params = useSearchParams();
  const { data, theme } = useManager();
  const [tab, setTab] = useState("customers");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(params.get("selected") || "");
  const [orderId, setOrderId] = useState("");
  const [booking, setBooking] = useState("");
  const filtered = data.customers.filter((item) =>
    `${item.name} ${item.phone} ${item.plate} ${item.model}`
      .toLocaleLowerCase("vi")
      .includes(query.toLocaleLowerCase("vi")),
  );
  const customer = data.customers.find((item) => item.id === selected);
  const history = data.bookings
    .filter((item) => item.customerId === selected)
    .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <PageHeading
        title="Khách hàng & phương tiện"
        description="Hồ sơ và lịch sử đặt lịch trong phạm vi toàn trạm."
      />
      <ManagerPanel
        title={`${filtered.length} ${tab === "customers" ? "khách hàng" : "phương tiện"}`}
        action={
          <div className="mgr-tabs">
            <button
              aria-pressed={tab === "customers"}
              onClick={() => setTab("customers")}
            >
              Khách hàng
            </button>
            <button
              aria-pressed={tab === "vehicles"}
              onClick={() => setTab("vehicles")}
            >
              Phương tiện
            </button>
          </div>
        }
      >
        <div className="mgr-toolbar">
          <ManagerSearch
            value={query}
            onChange={(value) => {
              setQuery(value);
              setPage(1);
            }}
            placeholder="Tìm tên, SĐT, biển số, dòng xe…"
          />
        </div>
        <div className="mgr-table-scroll">
          <ManagerTable className="mgr-table">
            <thead>
              <tr>
                <th>{tab === "customers" ? "Khách hàng" : "Phương tiện"}</th>
                <th>{tab === "customers" ? "Liên hệ" : "Khách liên hệ"}</th>
                <th>{tab === "customers" ? "Phương tiện" : "Biển số"}</th>
                <th>Lượt đặt lịch</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice((page - 1) * 6, page * 6).map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="mgr-person-cell">
                      <span className="adm-feature-icon">
                        <AdminIcon
                          name={tab === "customers" ? "customers" : "car"}
                        />
                      </span>
                      <div>
                        <strong>
                          {tab === "customers" ? item.name : item.model}
                        </strong>
                        <small>{item.id}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span>{tab === "customers" ? item.phone : item.name}</span>
                    {tab === "vehicles" && <small>{item.phone}</small>}
                  </td>
                  <td>
                    <span>{tab === "customers" ? item.model : item.plate}</span>
                    {tab === "customers" && <small>{item.plate}</small>}
                  </td>
                  <td>
                    {
                      data.bookings.filter(
                        (booking) => booking.customerId === item.id,
                      ).length
                    }
                  </td>
                  <td>
                    <button
                      className="adm-btn"
                      onClick={() => setSelected(item.id)}
                    >
                      Xem hồ sơ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </ManagerTable>
        </div>
        {!filtered.length && <ManagerEmpty onReset={() => setQuery("")} />}
        <ManagerPager page={page} total={filtered.length} onChange={setPage} />
      </ManagerPanel>
      {customer && (
        <ManagerModal
          title="Hồ sơ khách hàng"
          theme={theme}
          drawer
          onClose={() => setSelected("")}
        >
          <div className="mgr-detail-section">
            <span className="adm-avatar adm-avatar-lg">KH</span>
            <h2>{customer.name}</h2>
            <p>{customer.phone}</p>
            <div className="mgr-vehicle">
              <AdminIcon name="car" />
              <div>
                <strong>{customer.model}</strong>
                <span>{customer.plate}</span>
              </div>
            </div>
          </div>
          <section className="mgr-detail-section">
            <h3>Lịch sử đặt lịch ({history.length})</h3>
            <p className="adm-muted">
              Gồm lịch hủy và không đến; không đồng nghĩa lịch sử dịch vụ đã
              thực hiện.
            </p>
            <div className="mgr-history-list">
              {history.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setSelected("");
                    setBooking(item.id);
                  }}
                >
                  <div>
                    <strong>{item.id}</strong>
                    <small>
                      {item.time} · {formatDate(item.date)}
                    </small>
                  </div>
                  <StatusBadge status={item.status} />
                  <AdminIcon name="arrow" />
                </button>
              ))}
            </div>
          </section>
          <section className="mgr-detail-section">
            <h3>Phiếu dịch vụ thực tế</h3>
            <div className="mgr-history-list">
              {data.orders
                .filter((o) => o.customerId === selected)
                .map((o) => (
                  <button
                    key={o.id}
                    onClick={() => {
                      setSelected("");
                      setOrderId(o.id);
                    }}
                  >
                    <div>
                      <strong>{o.id}</strong>
                      <small>
                        {formatDate(o.openedAt)} ·{" "}
                        {o.stage === "done" ? "Đã hoàn tất" : "Đang phục vụ"}
                      </small>
                    </div>
                    <AdminIcon name="arrow" />
                  </button>
                ))}
              {!data.orders.some((o) => o.customerId === selected) && (
                <p>Chưa có phiếu dịch vụ.</p>
              )}
            </div>
          </section>
        </ManagerModal>
      )}
      {booking && (
        <ManagerBookingDetail id={booking} onClose={() => setBooking("")} />
      )}
      {orderId && (
        <ManagerOrderDrawer id={orderId} onClose={() => setOrderId("")} />
      )}
    </>
  );
}
