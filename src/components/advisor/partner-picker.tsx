"use client";
import { useState } from "react";
import { command } from "@/lib/api/client";
import {
  usePartners,
  type Partner,
  type PartnerSnapshot,
} from "@/lib/api/partners";

/**
 * "Xe đối tác" tick + the sale who brought the car. Once a booking/ticket exists the tick is fixed
 * (`locked`): only the sale can still be corrected.
 */
export function PartnerPicker({
  value,
  onChange,
  onToggle,
  locked = false,
  current,
  error,
}: {
  value: string;
  onChange: (saleId: string, partner: Partner | null) => void;
  /** Ticked state, so the form can require a sale once the box is on. */
  onToggle?: (on: boolean) => void;
  locked?: boolean;
  current?: PartnerSnapshot | null;
  error?: string;
}) {
  const { partners, error: loadError } = usePartners();
  const [on, setOn] = useState(!!value);
  const active = partners.filter((p) => p.active);
  const chosen = partners.find((p) => p.sales.some((s) => s.id === value));
  return (
    <div className={`adm-field adm-span-full${error ? " has-error" : ""}`}>
      <label className="adm-toggle-row adv-partner-toggle">
        <input
          type="checkbox"
          checked={on}
          disabled={locked}
          onChange={(e) => {
            setOn(e.target.checked);
            onToggle?.(e.target.checked);
            if (!e.target.checked) onChange("", null);
          }}
        />
        <span>
          Xe đối tác{active.length === 1 ? ` (${active[0].name})` : ""}
        </span>
      </label>
      {on && (
        <>
          <label htmlFor="partnerSaleId">Sale mang xe đến *</label>
          <select
            id="partnerSaleId"
            value={value}
            aria-invalid={!!error}
            onChange={(e) =>
              onChange(
                e.target.value,
                partners.find((p) =>
                  p.sales.some((s) => s.id === e.target.value),
                ) || null,
              )
            }
          >
            <option value="">Chọn sale</option>
            {active.map((p) => {
              const options = p.sales
                .filter((s) => s.active || s.id === current?.saleId)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ));
              // One partner: its name is already in the tick label, so no group heading.
              return active.length > 1 ? (
                <optgroup key={p.id} label={p.name}>
                  {options}
                </optgroup>
              ) : (
                options
              );
            })}
          </select>
          {error && <p className="adm-error-text">{error}</p>}
          {loadError && <p className="adm-error-text">{loadError}</p>}
          {chosen && !chosen.phone && (
            <p className="adm-error-text">
              Đối tác chưa có số điện thoại. Điều hành cần cập nhật ở trang Đối
              tác.
            </p>
          )}
          {!loadError && !active.some((p) => p.sales.some((s) => s.active)) && (
            <p className="adm-field-help">
              Chưa có sale nào. Điều hành thêm sale ở trang Đối tác.
            </p>
          )}
          {chosen?.phone && (
            <p className="adm-field-help">
              Khách hàng của phiếu là hồ sơ đối tác {chosen.name}.
            </p>
          )}
        </>
      )}
    </div>
  );
}

/** Correct the sale of an existing partner ticket (the partner flag itself stays). */
export function PartnerSaleEdit({
  path,
  version,
  current,
  onSaved,
}: {
  path: string;
  version: number;
  current: PartnerSnapshot;
  onSaved: () => void;
}) {
  const { partners } = usePartners();
  const [editing, setEditing] = useState(false),
    [sale, setSale] = useState(current.saleId),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const sales =
    partners
      .find((p) => p.id === current.partnerId)
      ?.sales.filter((s) => s.active || s.id === current.saleId) || [];
  if (!editing)
    return (
      <span className="adv-partner-edit">
        <span>Sale: {current.saleName}</span>
        <button
          type="button"
          className="adm-text-link"
          onClick={() => {
            setSale(current.saleId);
            setError("");
            setEditing(true);
          }}
        >
          Đổi sale
        </button>
      </span>
    );
  return (
    <span className="adv-partner-edit is-editing">
      <span className="adm-field">
        <select
          aria-label="Sale mang xe đến"
          value={sale}
          disabled={busy}
          onChange={(e) => setSale(e.target.value)}
        >
          {sales.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </span>
      <button
        type="button"
        className="adm-btn adm-btn-sm adm-primary"
        disabled={busy || sale === current.saleId}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await command(path, { expectedVersion: version, partnerSaleId: sale }, "PATCH");
            setEditing(false);
            onSaved();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Chưa thể lưu.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Đang lưu…" : "Lưu"}
      </button>
      <button
        type="button"
        className="adm-text-link"
        disabled={busy}
        onClick={() => setEditing(false)}
      >
        Hủy
      </button>
      {error && <span className="adm-error-text">{error}</span>}
    </span>
  );
}

/** Customer cell of a partner car: the sale's name plus a red "Toàn Trung" tag. */
export function PartnerName({ sale }: { sale: string }) {
  return (
    <span className="adv-partner-name">
      <strong>{sale}</strong>
      {/* shortcut: fixed label for the only partner (Xe Lướt Toàn Trung); use the partner's short name once there are more. */}
      <span className="adv-partner-badge">Toàn Trung</span>
    </span>
  );
}
