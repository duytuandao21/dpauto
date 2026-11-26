/** Price shown on public service cards; null = "Liên hệ báo giá". */
export type ServicePrice = { kind: "FROM" | "FIXED"; amount: number } | null;

/**
 * CMS service payload → price. Older documents only have the free-text "Giá tham khảo"
 * (e.g. "Từ 1.500.000đ"); a plain amount in it is still understood.
 */
export function servicePrice(p: {
  priceKind?: unknown;
  priceAmount?: unknown;
  priceFrom?: unknown;
}): ServicePrice {
  if (
    (p.priceKind === "FROM" || p.priceKind === "FIXED") &&
    typeof p.priceAmount === "number" &&
    p.priceAmount > 0
  )
    return { kind: p.priceKind, amount: p.priceAmount };
  const text = String(p.priceFrom || "");
  // Only grouped thousands ("1.500.000") or 4+ digits; "1tr5"-style text is left as contact.
  const amount = text.match(/\d{1,3}(?:[.,\s]\d{3})+|\d{4,}/)?.[0];
  return amount
    ? {
        kind: /chỉ/i.test(text) ? "FIXED" : "FROM",
        amount: Number(amount.replace(/\D/g, "")),
      }
    : null;
}

export const priceText = (price: ServicePrice) =>
  price
    ? {
        label: price.kind === "FIXED" ? "Giá chỉ" : "Giá từ",
        value: `${price.amount.toLocaleString("vi-VN")}đ`,
      }
    : { label: "", value: "Liên hệ báo giá" };

/** One price-table column; "_" is the single "Giá" column used when the admin names none. */
export type PricingColumn = { id: string; name: string };
export const singlePriceColumn: PricingColumn = { id: "_", name: "Giá" };

/** CMS payload → detail-page price table; null when no package has a name. */
export function servicePricing(p: {
  pricingColumns?: unknown;
  pricing?: unknown;
  pricingNote?: unknown;
}) {
  const named = (Array.isArray(p.pricingColumns) ? p.pricingColumns : []) as PricingColumn[];
  const columns = named.length ? named : [singlePriceColumn];
  const rows = (
    (Array.isArray(p.pricing) ? p.pricing : []) as {
      name?: string;
      text?: string;
      featured?: boolean;
      prices?: Record<string, number>;
    }[]
  ).filter((r) => r.name?.trim());
  if (!rows.length) return null;
  return {
    columns: columns.map((c) => c.name.trim() || "Giá"),
    rows: rows.map((r) => ({
      name: r.name!.trim(),
      text: r.text?.trim() || "",
      featured: !!r.featured,
      // null = "Liên hệ" in that column.
      prices: columns.map((c) => r.prices?.[c.id] || null),
    })),
    note: String(p.pricingNote || "").trim(),
  };
}
export type ServicePricing = NonNullable<ReturnType<typeof servicePricing>>;
