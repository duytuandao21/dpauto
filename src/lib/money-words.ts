const digits = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];

/** One 3-digit group; `full` reads leading zeros ("không trăm …") for groups after the first. */
function group(n: number, full: boolean) {
  const h = Math.floor(n / 100),
    t = Math.floor((n % 100) / 10),
    u = n % 10,
    out: string[] = [];
  if (full || h) out.push(digits[h], "trăm");
  if (t === 0) {
    if (u && out.length) out.push("lẻ");
  } else out.push(t === 1 ? "mười" : `${digits[t]} mươi`);
  if (u)
    out.push(
      u === 1 && t >= 2 ? "mốt" : u === 5 && t >= 1 ? "lăm" : digits[u],
    );
  return out.join(" ");
}

/** "10012520" → "Mười triệu không trăm mười hai nghìn năm trăm hai mươi đồng". */
export function moneyWords(value: string | bigint) {
  let n = BigInt(value);
  if (n < BigInt(0)) n = -n;
  if (n === BigInt(0)) return "Không đồng";
  const groups: number[] = [];
  for (; n > BigInt(0); n /= BigInt(1000)) groups.push(Number(n % BigInt(1000)));
  const words: string[] = [];
  for (let g = groups.length - 1; g >= 0; g--) {
    if (!groups[g]) continue;
    const scale = [["", "nghìn", "triệu"][g % 3], ...Array(Math.floor(g / 3)).fill("tỷ")];
    words.push([group(groups[g], g < groups.length - 1), ...scale].filter(Boolean).join(" "));
  }
  const text = words.join(" ") + " đồng";
  return text[0].toUpperCase() + text.slice(1);
}
