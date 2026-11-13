import { fail } from "./common";

export const calculationPolicy = "VND_LINE_HALF_UP_V1";
export type MoneyLine = {
  quantity: string;
  unitPrice: string;
  discountPercent: string;
  vatPercent: string;
};
const maximum = 999999999999999999n;
function scaled(value: string, places: number) {
  if (!/^\d+(\.\d+)?$/.test(value)) fail(400, "INVALID_DECIMAL");
  const [whole, decimal = ""] = value.split(".");
  if (decimal.length > places) fail(400, "INVALID_DECIMAL");
  return (
    BigInt(whole) * 10n ** BigInt(places) + BigInt(decimal.padEnd(places, "0"))
  );
}
const rounded = (n: bigint, d: bigint) => (n + d / 2n) / d;
function checked(n: bigint) {
  if (n < 0n || n > maximum) fail(422, "QUOTE_AMOUNT_TOO_LARGE");
  return n;
}
export function quoteMoney(lines: MoneyLine[], discountPercent: string) {
  const orderRate = scaled(discountPercent, 2);
  if (orderRate > 10000n) fail(400, "INVALID_DISCOUNT");
  let subtotal = 0n,
    discount = 0n,
    tax = 0n,
    total = 0n;
  const calculated = lines.map((line) => {
    const quantity = scaled(line.quantity, 3),
      price = scaled(line.unitPrice, 0),
      lineRate = scaled(line.discountPercent, 2),
      taxRate = scaled(line.vatPercent, 2);
    if (quantity <= 0n || lineRate > 10000n || taxRate > 10000n)
      fail(400, "INVALID_DECIMAL");
    const gross = checked(rounded(quantity * price, 1000n)),
      first = rounded(gross * lineRate, 10000n);
    const second = rounded((gross - first) * orderRate, 10000n),
      net = gross - first - second,
      vat = rounded(net * taxRate, 10000n),
      amount = checked(net + vat);
    subtotal += gross;
    discount += first + second;
    tax += vat;
    total += amount;
    return {
      subtotal: gross.toString(),
      discountTotal: (first + second).toString(),
      taxTotal: vat.toString(),
      total: amount.toString(),
    };
  });
  checked(total);
  checked(subtotal);
  checked(tax);
  return {
    lines: calculated,
    subtotal: subtotal.toString(),
    discountTotal: discount.toString(),
    taxTotal: tax.toString(),
    total: total.toString(),
  };
}
