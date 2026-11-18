type Line = {
  quantity: string;
  unitPrice: string;
  discountPercent: string;
  vatPercent: string;
};
// Preview follows VND_LINE_HALF_UP_V1; the backend still calculates the amount saved.
export function quotePreview(lines: Line[], discountPercent: string) {
  const scaled = (s: string, places: number) => {
    if (
      !new RegExp(`^\\d+(?:\\.\\d{1,${places || 1}})?$`).test(s) ||
      (!places && s.includes("."))
    )
      throw Error("decimal");
    const [whole, fraction = ""] = s.split(".");
    return (
      BigInt(whole) * BigInt(10) ** BigInt(places) +
      BigInt(fraction.padEnd(places, "0") || "0")
    );
  };
  const round = (n: bigint, d: bigint) => (n + d / BigInt(2)) / d;
  try {
    const rate = scaled(discountPercent, 2);
    if (rate > BigInt(10000)) return null;
    let subtotal = BigInt(0),
      discount = BigInt(0),
      tax = BigInt(0);
    for (const line of lines) {
      const quantity = scaled(line.quantity, 3),
        price = scaled(line.unitPrice, 0),
        lineRate = scaled(line.discountPercent, 2),
        vat = scaled(line.vatPercent, 2);
      if (
        quantity === BigInt(0) ||
        lineRate > BigInt(10000) ||
        vat > BigInt(10000)
      )
        return null;
      const gross = round(quantity * price, BigInt(1000)),
        first = round(gross * lineRate, BigInt(10000)),
        second = round((gross - first) * rate, BigInt(10000));
      subtotal += gross;
      discount += first + second;
      tax += round((gross - first - second) * vat, BigInt(10000));
    }
    return {
      subtotal: subtotal.toString(),
      discountTotal: discount.toString(),
      taxTotal: tax.toString(),
      total: (subtotal - discount + tax).toString(),
    };
  } catch {
    return null;
  }
}
