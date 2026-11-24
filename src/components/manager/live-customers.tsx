"use client";
import { formatPhone } from "@/lib/advisor/formats";
import { useEffect, useState } from "react";
import Link from "next/link";
import { command, request } from "@/lib/api/client";
import { useSession } from "@/components/admin/auth-gate";
import { formatDate } from "@/lib/booking/logic";
import type { ApiBooking } from "@/lib/api/types";
import { stationTime } from "@/lib/api/types";
import { type ApiCustomer, type ApiVehicle } from "@/lib/api/booking-adapter";
import { PageHeading, AdminLoading } from "@/components/admin/primitives";
import {
  ManagerPanel,
  ManagerTable,
  ManagerSearch,
  ManagerEmpty,
  ManagerField,
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
  const { theme } = useManager(),
    canManage = !!useSession()?.permissions.includes("customers.manage"),
    [reload, setReload] = useState(0);
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
  }, [tab, query, cursor, reload]);
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
  }, [selected, reload]);
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
                        <a href={`tel:${row.phone}`}>{formatPhone(row.phone)}</a>
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
                  {formatPhone(detail.phone)}
                </a>
              </div>
              {canManage && (
                <CustomerTools
                  key={detail.id + detail.version}
                  customer={detail}
                  onChanged={() => setReload((n) => n + 1)}
                  onDeleted={() => {
                    setSelected("");
                    setReload((n) => n + 1);
                  }}
                />
              )}
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
                      {formatDate(stationTime(b.scheduledStartAt).slice(0, 10))}{" "}
                      {stationTime(b.scheduledStartAt).slice(11, 16)}
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

/** Correct a customer's name/phone, or fold a duplicate profile into this one. */
function CustomerTools({
  customer,
  onChanged,
  onDeleted,
}: {
  customer: Detail;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [mode, setMode] = useState<"" | "edit" | "merge">(""),
    [name, setName] = useState(customer.name),
    [phone, setPhone] = useState(formatPhone(customer.phone)),
    [reason, setReason] = useState(""),
    [search, setSearch] = useState(""),
    [matches, setMatches] = useState<CustomerRow[]>([]),
    [duplicate, setDuplicate] = useState<CustomerRow | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState("");
  useEffect(() => {
    if (mode !== "merge" || search.trim().length < 2) {
      setMatches([]);
      return;
    }
    const c = new AbortController(),
      t = setTimeout(() => {
        request<CustomerRow[]>(
          "admin/customers?limit=8&q=" + encodeURIComponent(search.trim()),
          { signal: c.signal },
        )
          .then((r) => setMatches(r.data.filter((x) => x.id !== customer.id)))
          .catch(() => {});
      }, 250);
    return () => {
      c.abort();
      clearTimeout(t);
    };
  }, [mode, search, customer.id]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!reason.trim()) return setError("Nhập lý do thay đổi.");
    if (mode === "merge" && !duplicate)
      return setError("Chọn hồ sơ trùng cần gộp.");
    if (
      mode === "merge" &&
      !window.confirm(
        `Gộp "${duplicate!.name}" vào "${customer.name}"? Lịch hẹn, phiếu dịch vụ và xe sẽ chuyển sang hồ sơ này. Không hoàn tác được.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      if (mode === "edit")
        await command(
          "admin/customers/" + customer.id,
          {
            expectedVersion: customer.version,
            name: name.trim(),
            phone,
            reason: reason.trim(),
          },
          "PATCH",
        );
      else
        await command(`admin/customers/${duplicate!.id}/merge`, {
          expectedVersion: duplicate!.version,
          targetId: customer.id,
          targetVersion: customer.version,
          reason: reason.trim(),
        });
      setDone(mode === "edit" ? "Đã lưu hồ sơ." : "Đã gộp hồ sơ.");
      setMode("");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mgr-detail-section">
      <div className="mgr-row-actions">
        <button
          className="adm-btn"
          aria-pressed={mode === "edit"}
          onClick={() => {
            setMode(mode === "edit" ? "" : "edit");
            setError("");
          }}
        >
          Sửa thông tin
        </button>
        <button
          className="adm-btn"
          aria-pressed={mode === "merge"}
          onClick={() => {
            setMode(mode === "merge" ? "" : "merge");
            setError("");
          }}
        >
          Gộp hồ sơ trùng
        </button>
        <button
          className="adm-btn adm-subtle-danger"
          disabled={busy}
          onClick={async () => {
            if (
              !window.confirm(
                `Xóa khách hàng ${customer.name} (${formatPhone(customer.phone)})? Hồ sơ sẽ được ẩn, lịch hẹn và phiếu dịch vụ cũ vẫn giữ thông tin.`,
              )
            )
              return;
            setBusy(true);
            setError("");
            setMode("");
            try {
              await command(
                "admin/customers/" + customer.id,
                { expectedVersion: customer.version },
                "DELETE",
              );
              onDeleted();
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "Chưa thể xóa khách hàng.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          Xóa khách hàng
        </button>
      </div>
      {done && !mode && <p className="adm-muted">{done}</p>}
      {error && !mode && (
        <p className="adm-error-text" role="alert">
          {error}
        </p>
      )}
      {mode && (
        <form className="mgr-form" onSubmit={submit}>
          <fieldset disabled={busy}>
            {mode === "edit" ? (
              <div className="mgr-form-columns">
                <ManagerField label="Họ tên *">
                  <input
                    required
                    maxLength={100}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </ManagerField>
                <ManagerField label="Số điện thoại *">
                  <input
                    required
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </ManagerField>
              </div>
            ) : (
              <>
                <ManagerField label="Tìm hồ sơ trùng (tên hoặc SĐT)">
                  <input
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setDuplicate(null);
                    }}
                  />
                </ManagerField>
                {matches.map((m) => (
                  <label key={m.id} className="adm-toggle-row">
                    <input
                      type="radio"
                      name="duplicate"
                      checked={duplicate?.id === m.id}
                      onChange={() => setDuplicate(m)}
                    />
                    {m.name} · {formatPhone(m.phone)} · {m.bookingCount} lịch
                  </label>
                ))}
                <p className="adm-muted">
                  Hồ sơ được chọn sẽ gộp vào hồ sơ đang mở. Phiếu thu tiền và
                  lịch sử đồng ý điều khoản vẫn giữ ở hồ sơ cũ.
                </p>
              </>
            )}
            <ManagerField label="Lý do *">
              <input
                required
                maxLength={400}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </ManagerField>
            {error && (
              <p className="adm-error-text" role="alert">
                {error}
              </p>
            )}
            <div className="mgr-row-actions">
              <button
                type="button"
                className="adm-btn"
                onClick={() => setMode("")}
              >
                Hủy
              </button>
              <button className="adm-btn adm-primary">
                {busy
                  ? "Đang lưu…"
                  : mode === "edit"
                    ? "Lưu thay đổi"
                    : "Gộp hồ sơ"}
              </button>
            </div>
          </fieldset>
        </form>
      )}
    </section>
  );
}
