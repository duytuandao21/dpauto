"use client";
import { useCloseOutside } from "./use-close-outside";
import { PartnerTicketsBar, thisMonth } from "./partner-tickets-bar";
import { monthRange } from "@/lib/csv";
import { DateInput } from "@/components/advisor/date-input";
import { formatPhone, formatPlate } from "@/lib/advisor/formats";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AdminIcon } from "@/components/admin/admin-icon";
import { AdminLoading, PageHeading } from "@/components/admin/primitives";
import { useBookings } from "@/components/admin/booking-provider";
import { useSession } from "@/components/admin/auth-gate";
import { apiEnabled, request } from "@/lib/api/client";
import { confirmDelete, visitDeleteMessage } from "@/lib/api/delete";
import type { Visit, TicketStage } from "@/lib/api/visits";
import { stationTime } from "@/lib/api/types";
import { quoteTotals } from "@/lib/advisor/seed";
import {
  ticketAction,
  ticketAmount,
  ticketLabels,
  ticketStage,
  ticketTabs,
  localTicketStage,
  searchTicket,
  type ServiceTicketRow,
} from "@/lib/advisor/service-tickets";
import { useAdvisor } from "./advisor-provider";
import { ServiceTicketsTable } from "./service-tickets-table";

const localPermissions = [
  "visits.update",
  "quotes.write",
  "work.write",
  "acceptance.record",
  "visits.handover",
];
export function ServiceTicketsPage() {
  const { data } = useBookings();
  const { orders, ready } = useAdvisor();
  const session = useSession();
  const params = useSearchParams();
  const initial = params.get("stage") || "active";
  const [view, setView] = useState(
    initial === "RECEIVED" || initial === "INSPECTED"
      ? "QUOTE"
      : Object.hasOwn(ticketLabels, initial) ||
          ["active", "all"].includes(initial)
        ? initial
        : "active",
  );
  const [query, setQuery] = useState("");
  // The filter popover (<details>) closes on a click outside it or Escape.
  const filters = useRef<HTMLDetailsElement>(null);
  const closeFilters = useCallback(() => {
    if (filters.current) filters.current.open = false;
  }, []);
  useCloseOutside(filters, true, closeFilters);
  const [month, setMonth] = useState(thisMonth),
    [partnerSale, setPartnerSale] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [values, setValues] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(apiEnabled);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [cursor, setCursor] = useState("");
  const [previous, setPrevious] = useState<string[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [localPage, setLocalPage] = useState(0);
  const [deletingId, setDeletingId] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const resetPage = () => {
    setCursor("");
    setPrevious([]);
    setNext(null);
    setLocalPage(0);
  };
  useEffect(() => {
    if (!apiEnabled) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const q = new URLSearchParams({ limit: "20" });
    if (view === "active") q.set("activeOnly", "true");
    else if (view === "partner") {
      // Partner tab: every stage, one month, optionally one sale.
      const range = monthRange(month);
      q.set("partner", "true");
      q.set("from", range.from);
      q.set("to", range.to);
      if (partnerSale) q.set("partnerSaleId", partnerSale);
    } else if (view !== "all") q.set("ticketStage", view);
    if (query.trim()) q.set("q", query.trim());
    if (cursor) q.set("cursor", cursor);
    if (view !== "partner" && (from || to)) {
      q.set("from", from || to);
      q.set("to", to || from);
    }
    const timer = setTimeout(() => {
      request<Visit[]>(`admin/service-visits?${q}`, {
        signal: controller.signal,
      })
        .then((result) => {
          if (!controller.signal.aborted) {
            setValues(result.data);
            setNext(result.page?.nextCursor || null);
          }
        })
        .catch((e) => {
          if (!controller.signal.aborted) {
            setValues([]);
            setNext(null);
            setError(
              e instanceof Error ? e.message : "Chưa thể tải phiếu dịch vụ.",
            );
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 200);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, view, from, to, cursor, reload, month, partnerSale]);
  useEffect(() => {
    const refresh = () => {
      resetPage();
      setReload((value) => value + 1);
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("dpauto-data-updated", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("dpauto-data-updated", refresh);
    };
  }, []);
  const permissions = apiEnabled
    ? session?.permissions || []
    : localPermissions;
  async function deleteVisit(row: ServiceTicketRow) {
    if (
      deletingId ||
      !row.canDelete ||
      row.version === undefined ||
      !permissions.includes("visits.update")
    )
      return;
    setDeletingId(row.id);
    setDeleteError("");
    try {
      if (
        await confirmDelete(
          `admin/service-visits/${encodeURIComponent(row.id)}`,
          row.version,
          visitDeleteMessage(row),
        )
      )
        setValues((current) => current.filter((visit) => visit.id !== row.id));
    } catch (e) {
      setDeleteError(
        e instanceof Error ? e.message : "Chưa thể xóa phiếu dịch vụ.",
      );
    } finally {
      setDeletingId("");
    }
  }
  const localValues = orders
    .filter((order) => {
      const customer = data.customers.find(
        (item) => item.id === order.customerId,
      );
      const vehicle = data.vehicles.find((item) => item.id === order.vehicleId);
      const state = localTicketStage(order);
      const at = stationTime(order.openedAt).slice(0, 10);
      return (
        (view === "all" ||
          (view === "active"
            ? !["HANDED_OVER", "ABORTED"].includes(state)
            : state === view)) &&
        searchTicket(
          `${order.id} ${vehicle?.plate || ""} ${formatPlate(vehicle?.plate)} ${vehicle?.model || ""} ${customer?.name || ""} ${customer?.phone || ""} ${formatPhone(customer?.phone)}`,
        ).includes(searchTicket(query.trim())) &&
        (!from || at >= from) &&
        (!to || at <= to)
      );
    })
    .sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  const rows: ServiceTicketRow[] = apiEnabled
    ? values.map((visit) => {
        const state = ticketStage(visit);
        return {
          id: visit.id,
          version: visit.version,
          bookingId: visit.bookingId,
          canDelete: visit.canDelete,
          deleteBlockedReason: visit.deleteBlockedReason,
          code: visit.code || "Phiếu dịch vụ",
          plate: visit.vehicle.plate || "",
          model: visit.vehicle.model || "",
          customer: visit.customer.name,
          phone: visit.customer.phone,
          stage: state,
          label: visit.isPaused
            ? ticketLabels.PAUSED
            : visit.stage === "RECEIVED"
              ? "Chờ kiểm tra"
              : ticketLabels[state],
          amount: ticketAmount(visit),
          pendingChange:
            visit.pricing?.hasOpenQuote && visit.pricing.approvedTotal !== null,
          action: ticketAction(
            visit.isPaused ? "PAUSED" : state,
            permissions,
            visit.stage === "RECEIVED",
            visit.pricing?.hasOpenQuote,
          ),
          partnerSale: visit.partner?.saleName,
        };
      })
    : localValues.slice(localPage * 20, (localPage + 1) * 20).map((order) => {
        const customer = data.customers.find(
          (item) => item.id === order.customerId,
        );
        const vehicle = data.vehicles.find(
          (item) => item.id === order.vehicleId,
        );
        const state = localTicketStage(order);
        const hasQuote =
          order.quote.lines.length > 0 && order.quote.status !== "rejected";
        return {
          id: order.id,
          code: /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(order.id)
            ? "Phiếu dịch vụ"
            : order.id,
          plate: vehicle?.plate || "",
          model: vehicle?.model || "",
          customer: customer?.name || "—",
          phone: customer?.phone || "",
          stage: state,
          label: ticketLabels[state],
          amount: {
            value: hasQuote
              ? String(
                  Math.round(
                    quoteTotals(order.quote.lines, order.quote.discount).total,
                  ),
                )
              : null,
            label: hasQuote
              ? order.quote.status === "confirmed"
                ? "Báo giá đã duyệt"
                : "Dự kiến"
              : "Chưa có báo giá",
          },
          action: ticketAction(state, permissions, false, hasQuote),
        };
      });
  const pageIndex = apiEnabled ? previous.length : localPage;
  const hasNext = apiEnabled
    ? !!next
    : (localPage + 1) * 20 < localValues.length;
  return (
    <div className="adv-page adv-ticket-page">
      <PageHeading
        title="Phiếu dịch vụ"
        description="Theo dõi báo giá, thi công, nghiệm thu và bàn giao xe."
      >
        <div className="adv-actions">
          <Link className="adm-btn" href="/co-van/lich-hen">
            Mở lịch hẹn
          </Link>
          <Link
            className="adm-btn adm-primary"
            href="/co-van/tiep-nhan/truc-tiep"
          >
            Tiếp nhận xe trực tiếp
          </Link>
        </div>
      </PageHeading>
      <section className="adm-panel adv-ticket-panel">
        <div
          className="adm-quick-filters adv-ticket-tabs"
          aria-label="Lọc trạng thái phiếu dịch vụ"
        >
          {ticketTabs.map(([value, label]) => (
            <button
              key={value}
              aria-pressed={view === value}
              className={view === value ? "is-active" : ""}
              onClick={() => {
                setView(value);
                resetPage();
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="adm-search-row">
          <label className="adm-search">
            <AdminIcon name="search" />
            <input
              maxLength={100}
              aria-label="Tìm phiếu dịch vụ"
              placeholder="Mã phiếu, biển số, tên xe, khách hàng, SĐT…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                resetPage();
              }}
            />
            {query && (
              <button
                type="button"
                aria-label="Xóa tìm kiếm"
                onClick={() => {
                  setQuery("");
                  resetPage();
                }}
              >
                ×
              </button>
            )}
          </label>
          <details className="adv-ticket-filters" ref={filters}>
            <summary className="adm-btn">
              <AdminIcon name="filter" />
              Bộ lọc
              {(from || to || ["PAUSED", "REWORK", "ABORTED"].includes(view)) &&
                " •"}
            </summary>
            <div className="adm-filters adv-ticket-filter-panel">
              <div className="adv-ticket-filter-head">
                <strong>Bộ lọc</strong>
                <button
                  className="adm-text-link"
                  type="button"
                  onClick={() => {
                    setFrom("");
                    setTo("");
                    setView("active");
                    resetPage();
                  }}
                >
                  Đặt lại
                </button>
              </div>
              <label>
                Trạng thái
                <select
                  value={view}
                  onChange={(e) => {
                    setView(e.target.value);
                    resetPage();
                  }}
                >
                  {ticketTabs.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                  {["PAUSED", "REWORK", "ABORTED"].map((value) => (
                    <option key={value} value={value}>
                      {ticketLabels[value as TicketStage]}
                    </option>
                  ))}
                </select>
              </label>
              <div className="adv-ticket-filter-dates">
              <label>
                Từ ngày
                <DateInput
                  value={from}
                  max={to || undefined}
                  onValueChange={(value) => {
                    setFrom(value);
                    resetPage();
                  }}
                />
              </label>
              <label>
                Đến ngày
                <DateInput
                  value={to}
                  min={from || undefined}
                  onValueChange={(value) => {
                    setTo(value);
                    resetPage();
                  }}
                />
              </label>
              </div>
            </div>
          </details>
        </div>
        {view === "partner" && apiEnabled && (
          <PartnerTicketsBar
            month={month}
            saleId={partnerSale}
            onMonth={(value) => {
              setMonth(value);
              resetPage();
            }}
            onSale={(value) => {
              setPartnerSale(value);
              resetPage();
            }}
          />
        )}
        <div className="adm-results-row">
          <strong aria-live="polite">
            {loading
              ? "Đang tải phiếu dịch vụ…"
              : `${rows.length} phiếu trên trang này`}
          </strong>
          <span className="adm-muted">
            {view === "active"
              ? "Phiếu đang xử lý"
              : view === "all"
                ? "Tất cả phiếu"
                : view === "partner"
                  ? "Xe đối tác trong tháng"
                  : ticketLabels[view as TicketStage]}
          </span>
        </div>
        {deleteError && (
          <div className="adm-action-row" role="alert">
            <p className="adm-error-text">{deleteError}</p>
            <button
              className="adm-btn"
              onClick={() => setReload((value) => value + 1)}
            >
              Tải lại danh sách
            </button>
          </div>
        )}
        {loading || (!apiEnabled && !ready) ? (
          <AdminLoading />
        ) : error ? (
          <div role="alert" className="adv-stack">
            <p className="adm-error-text">{error}</p>
            <button
              className="adm-btn"
              onClick={() => setReload((value) => value + 1)}
            >
              Tải lại danh sách
            </button>
          </div>
        ) : (
          <ServiceTicketsTable
            rows={rows}
            onDelete={
              apiEnabled && permissions.includes("visits.update")
                ? deleteVisit
                : undefined
            }
            deletingId={deletingId}
          />
        )}
        {(pageIndex > 0 || hasNext) && (
          <nav
            className="adv-ticket-pagination adv-pagination"
            aria-label="Phân trang phiếu dịch vụ"
          >
            <button
              className="adm-btn"
              type="button"
              aria-label="Trang trước"
              disabled={loading || !!error || pageIndex === 0}
              onClick={() => {
                if (apiEnabled) {
                  setCursor(previous.at(-1) || "");
                  setPrevious(previous.slice(0, -1));
                } else setLocalPage((value) => value - 1);
              }}
            >
              <AdminIcon name="back" />
              Trước
            </button>
            <span
              className="adv-pagination-current"
              aria-current="page"
              aria-live="polite"
            >
              Trang {pageIndex + 1}
            </span>
            <button
              className="adm-btn"
              type="button"
              aria-label="Trang sau"
              disabled={loading || !!error || !hasNext}
              onClick={() => {
                if (apiEnabled && next) {
                  setPrevious([...previous, cursor]);
                  setCursor(next);
                } else if (!apiEnabled) setLocalPage((value) => value + 1);
              }}
            >
              Tiếp
              <AdminIcon name="back" />
            </button>
          </nav>
        )}
      </section>
    </div>
  );
}
