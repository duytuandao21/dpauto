"use client";
import { useEffect, useState } from "react";
import { request } from "@/lib/api/client";
import { siteVehicles, type Feed } from "@/lib/site-content";

type Brand = { name: string; models: string[] };
// The makes/models list is the website's "Hãng xe" catalogue (/admin/hang-xe); loaded once per tab.
let catalog: Promise<Brand[]> | null = null;
function loadCatalog() {
  catalog ??= request<Feed>("public/content")
    .then((r) => siteVehicles({ items: r.data.items, assets: {} }))
    .catch((e) => {
      catalog = null;
      throw e;
    });
  return catalog;
}

/** "Toyota Vios" → { brand: "Toyota", model: "Vios" } when both are in the catalogue. */
export function splitVehicle(value: string, brands: Brand[]) {
  const b = brands.find((x) => value.startsWith(x.name + " "));
  const model = b ? value.slice(b.name.length + 1) : "";
  return b && b.models.includes(model) ? { brand: b.name, model } : null;
}

/**
 * Hãng xe + Dòng xe picked from the admin catalogue (no free typing). `value` is "Hãng Dòng",
 * the same text the public booking form stores; it is "" until both are chosen.
 */
export function VehicleSelect({
  value,
  onChange,
  error,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}) {
  const [brands, setBrands] = useState<Brand[]>([]),
    [loadError, setLoadError] = useState(""),
    [brand, setBrand] = useState("");
  useEffect(() => {
    let live = true;
    loadCatalog()
      .then((list) => {
        if (!live) return;
        setBrands(list);
        setBrand((b) => b || splitVehicle(value, list)?.brand || "");
      })
      .catch((e) => live && setLoadError(e.message));
    return () => {
      live = false;
    };
    // Only the first value seeds the brand; later changes come from these selects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const parsed = splitVehicle(value, brands);
  const models = brands.find((b) => b.name === brand)?.models || [];
  return (
    <>
      <label className={`adm-field${error ? " has-error" : ""}`}>
        Hãng xe *
        <select
          required
          disabled={disabled}
          aria-invalid={!!error}
          value={brand}
          onChange={(e) => {
            setBrand(e.target.value);
            onChange("");
          }}
        >
          <option value="">Chọn hãng xe</option>
          {brands.map((b) => (
            <option key={b.name} value={b.name}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      <label className={`adm-field${error ? " has-error" : ""}`}>
        Dòng xe *
        <select
          required
          disabled={disabled || !brand}
          aria-invalid={!!error}
          value={parsed?.brand === brand ? parsed.model : ""}
          onChange={(e) =>
            onChange(e.target.value ? `${brand} ${e.target.value}` : "")
          }
        >
          <option value="">{brand ? "Chọn dòng xe" : "Chọn hãng xe trước"}</option>
          {models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        {error && <span className="adm-error-text">{error}</span>}
        {loadError && <span className="adm-error-text">{loadError}</span>}
        {value && brands.length > 0 && !parsed && (
          <span className="adm-field-help">
            Đang lưu: {value}. Chọn lại hãng và dòng xe nếu cần đổi.
          </span>
        )}
      </label>
    </>
  );
}
