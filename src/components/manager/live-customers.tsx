"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { request } from "@/lib/api/client";
import type { ApiBooking } from "@/lib/api/types";
import { stationTime } from "@/lib/api/types";
import { type ApiCustomer, type ApiVehicle } from "@/lib/api/booking-adapter";
import { PageHeading, AdminLoading } from "@/components/admin/primitives";
import {
  ManagerPanel,
  ManagerTable,
  ManagerSearch,
  ManagerEmpty,
} from "./manager-ui";
import { ManagerModal } from "./manager-modal";
import { useManager } from "./manager-provider";
import { LiveManagerVisits } from "./live-visits";
import { PageButtons } from "./live-stock";
import { AdminIcon } from "@/components/admin/admin-icon";
import { LegacyHistory } from "@/components/advisor/legacy-history";

type CustomerRow = ApiCustomer & { vehicleCount: number; bookingCount: number };
type Detail = ApiCustomer & {
  vehicles: ApiVehicle[];
  bookings: ApiBooking[];
  related: { bookingsHasMore: boolean };
};
export function LiveManagerCustomers() {
  const { theme } = useManager();
  const [tab, setTab] = useState("customers"),
    [query, setQuery] = useState(""),
    [cursor, setCursor] = useState(""),
    [previous, setPrevious] = useState<string[]>([]);
  const [rows, setRows] = useState<(CustomerRow | ApiVehicle)[]>([]),
    [next, setNext] = useState<string | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(""),
    [detail, setDetail] = useState<Detail | null>(null),
    [detailError, setDetailError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      request<(CustomerRow | ApiVehicle)[]>(
        `admin/${tab}?limit=20${query ? "&q=" + encodeURIComponent(query) : ""}${cursor ? "&cursor=" + encodeURIComponent(cursor) : ""}`,
        { signal: c.signal },
      )
        .then((r) => {
          if (c.signal.aborted) return;
          setRows(r.data);
          setNext(r.page?.nextCursor || null);
          setError("");
        })
        .catch((e) => {
          if (e.name !== "AbortError") setError(e.message);
        })
        .finally(() => {
          if (!c.signal.aborted) setLoading(false);
        });
    }, 250);
    return () => {
      c.abort();
      clearTimeout(timer);
    };
  }, [tab, query, cursor]);
  useEffect(() => {
    if (!selected) return;
    const c = new AbortController();
    setDetail(null);
    setDetailError("");
    request<Detail>("admin/customers/" + selected, { signal: c.signal })
      .then((r) => {
        if (!c.signal.aborted) setDetail(r.data);
      })
      .catch((e) => {
        if (!c.signal.aborted) setDetailError(e.message);
      });
    return () => c.abort();
  }, [selected]);
  const changeTab = (t: string) => {
    setTab(t);
    setCursor("");
    setPrevious([]);
  };
  return (
    <>
      <PageHeading
        title="Khách hàng & phương tiện"
        description="Tra cứu hồ sơ và lịch sử đặt lịch của trạm."
      />
      <ManagerPanel
        title="Tra cứu"
        action={
          <div className="mgr-tabs">
            <button
              aria-pressed={tab === "customers"}
              onClick={() => changeTab("customers")}
            >
              Khách hàng
            </button>
            <button
              aria-pressed={tab === "vehicles"}
              onClick={() => changeTab("vehicles")}
            >
              Phương tiện
            </button>
          </div>
        }
      >
        <div className="mgr-toolbar">
          <ManagerSearch
            value={query}
            onChange={(v) => {
              setQuery(v);
              setCursor("");
              setPrevious([]);
            }}
            placeholder="Tìm tên, số điện thoại, biển số…"
          />
        </div>
        {error && (
          <p className="adm-error-text" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <AdminLoading />
        ) : !rows.length ? (
          !error && (
            <ManagerEmpty
              message={
                tab === "customers"
                  ? "Chưa có khách hàng phù hợp"
                  : "Chưa có phương tiện phù hợp"
              }
            />
          )
        ) : (
          <div className="mgr-table-scroll">
            <ManagerTable className="mgr-table">
              <thead>
                <tr>
                  <th>{tab === "customers" ? "Khách hàng" : "Phương tiện"}</th>
                  <th>{tab === "customers" ? "Liên hệ" : "Biển số"}</th>
                  <th>
                    {tab === "customers" ? "Lịch hẹn / Xe" : "Khách liên hệ"}
                  </th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) =>
                  "phone" in row ? (
                    <tr key={row.id}>
                      <td>
                        <div className="mgr-person-cell">
                          <span className="adm-feature-icon">
                            <AdminIcon name="customers" />
                          </span>
                          <strong>{row.name}</strong>
                        </div>
                      </td>
                      <td>
                        <a href={`tel:${row.phone}`}>{row.phone}</a>
                      </td>
                      <td>
                        {row.bookingCount} lịch · {row.vehicleCount} xe
                      </td>
                      <td>
                        <button
                          className="adm-btn"
                          onClick={() => setSelected(row.id)}
                        >
                          Chi tiết
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={row.id}>
                      <td>{row.model || "Chưa có dòng xe"}</td>
                      <td>{row.plate || "Chưa có biển số"}</td>
                      <td>
                        {row.customerContacts.map((c) => c.name).join(", ")}
                      </td>
                      <td>
                        {row.customerContacts.map((c) => (
                          <button
                            key={c.customerId}
                            className="adm-btn"
                            onClick={() => setSelected(c.customerId)}
                          >
                            {c.name}
                          </button>
                        ))}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </ManagerTable>
          </div>
        )}
        <PageButtons
          manager
          page={{
            loading,
            canPrevious: !!previous.length,
            canNext: !!next && !error,
            data: rows,
            back: () => {
              setCursor(previous.at(-1) || "");
              setPrevious(previous.slice(0, -1));
            },
            forward: () => {
              setPrevious([...previous, cursor]);
              setCursor(next || "");
            },
          }}
        />
      </ManagerPanel>
      {selected && (
        <ManagerModal
          title="Hồ sơ khách hàng"
          theme={theme}
          onClose={() => setSelected("")}
          drawer
        >
          {detail ? (
            <>
              <div className="mgr-detail-section">
                <span className="adm-avatar adm-avatar-lg">
                  {detail.name.split(" ").at(-1)?.slice(0, 1)}
                </span>
                <h2>{detail.name}</h2>
                <a className="adm-phone" href={`tel:${detail.phone}`}>
                  {detail.phone}
                </a>
              </div>
              <section className="mgr-detail-section">
                <h3>Phương tiện</h3>
                {detail.vehicles.map((v) => (
                  <p key={v.id}>
                    {v.model} · {v.plate || "Chưa có biển số"}
                  </p>
                ))}
              </section>
              <LiveManagerVisits customerId={detail.id} />
              <LegacyHistory id={detail.id} />
              <LegacyHistory id={detail.id} financial />
              <section className="mgr-detail-section">
                <h3>Lịch hẹn gần đây</h3>
                {detail.bookings.map((b) => (
                  <p key={b.id}>
                    <Link
                      className="adm-text-link"
                      href={`/dieu-hanh/lich-hen?selected=${b.id}&date=${stationTime(b.scheduledStartAt).slice(0, 10)}`}
                    >
                      {b.code} ·{" "}
                      {stationTime(b.scheduledStartAt)
                        .slice(0, 16)
                        .replace("T", " ")}
                    </Link>
                  </p>
                ))}
                {!detail.bookings.length && (
                  <p className="adm-muted">Chưa có lịch hẹn.</p>
                )}
              </section>
            </>
          ) : detailError ? (
            <p role="alert" className="adm-error-text">
              {detailError}
            </p>
          ) : (
            <AdminLoading />
          )}
        </ManagerModal>
      )}
    </>
  );
}
