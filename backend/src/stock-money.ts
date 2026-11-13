import { fail } from "./common";
export const rounded = (n: bigint, d: bigint) => (n + d / 2n) / d;
export const quantity = (s: string) => {
  if (!/^-?\d{1,13}(\.\d{1,3})?$/.test(s)) fail(422, "QUANTITY_INVALID");
  const negative = s.startsWith("-"),
    [whole, fraction = ""] = s.replace(/^-/, "").split(".");
  return (
    (BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, "0"))) *
    (negative ? -1n : 1n)
  );
};
export const decimal = (n: bigint) =>
  `${n < 0n ? "-" : ""}${(n < 0n ? -n : n) / 1000n}.${((n < 0n ? -n : n) % 1000n).toString().padStart(3, "0")}`;
export function money(n: bigint) {
  if (n < 0n || n > 999999999999999999n) fail(422, "AMOUNT_INVALID");
  return n.toString();
}
export function issueValue(value: bigint, onHand: bigint, issued: bigint) {
  if (issued < 0n || issued > onHand || onHand === 0n)
    fail(409, "INSUFFICIENT_STOCK");
  return issued === onHand ? value : rounded(value * issued, onHand);
}
