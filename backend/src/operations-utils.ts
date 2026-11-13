export type Interval = { start: number; end: number };
export type Shift = Interval & { kind: string };
export function shiftHours(hours: Interval[], shifts: Shift[]): Interval[] {
  const work = shifts.filter((s) => s.kind === "WORK");
  let result = work.length
    ? hours.flatMap((h) =>
        work
          .map((w) => ({
            start: Math.max(h.start, w.start),
            end: Math.min(h.end, w.end),
          }))
          .filter((i) => i.start < i.end),
      )
    : [...hours];
  for (const leave of shifts.filter((s) => s.kind === "LEAVE"))
    result = result.flatMap((h) =>
      [
        { start: h.start, end: Math.min(h.end, leave.start) },
        { start: Math.max(h.start, leave.end), end: h.end },
      ].filter((i) => i.start < i.end),
    );
  const merged: Interval[] = [];
  for (const interval of result.sort((a, b) => a.start - b.start)) {
    const previous = merged.at(-1);
    if (previous && interval.start <= previous.end)
      previous.end = Math.max(previous.end, interval.end);
    else merged.push({ ...interval });
  }
  return merged;
}
export function csv(rows: unknown[][]) {
  return rows
    .map((row) =>
      row
        .map((value) => {
          let s = value == null ? "" : String(value);
          if (/^[\s\u0000-\u001f]*[=+\-@]/.test(s)) s = "'" + s;
          return '"' + s.replace(/"/g, '""') + '"';
        })
        .join(","),
    )
    .join("\r\n");
}
