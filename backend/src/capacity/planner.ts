import { ApiError, overlap } from "../common";

export type Requirement = {
  key: string;
  poolId: string;
  units: number;
  start: number;
  end: number;
};
export type Resource = {
  id: string;
  code: string;
  pools: string[];
  hours: { start: number; end: number }[];
};
export type Bucket = {
  id?: string;
  poolId: string;
  start: number;
  end: number;
  limit: number;
  held: number;
  closed: boolean;
  version?: number;
};
export type Allocation = {
  resourceId: string;
  start: number;
  end: number;
  keys: string[];
};
export type Charge = {
  poolId: string;
  start: number;
  end: number;
  units: number;
};
export type PlannerInput = {
  requirements: Requirement[];
  resources: Resource[];
  hours: { start: number; end: number }[];
  blocks: {
    poolId: string | null;
    resourceId: string | null;
    start: number;
    end: number;
  }[];
  busy: Allocation[];
  buckets: Bucket[];
  bucketMinutes: number;
  gridOrigin: number;
  budget?: number;
};
export type Plan = {
  allocations: Allocation[];
  charges: Charge[];
  start: number;
  end: number;
};
const inside = (
  hours: { start: number; end: number }[],
  start: number,
  end: number,
) => hours.some((h) => h.start <= start && h.end >= end);
export function occupancy(input: PlannerInput, r: Requirement) {
  const width = input.bucketMinutes * 60000;
  return {
    start:
      input.gridOrigin +
      Math.floor((r.start - input.gridOrigin) / width) * width,
    end:
      input.gridOrigin + Math.ceil((r.end - input.gridOrigin) / width) * width,
  };
}
export function plan(input: PlannerInput): Plan {
  if (!input.requirements.length)
    throw new ApiError(422, "INVALID_RESOURCE_PLAN");
  const candidates = new Map<string, Resource[]>(),
    rounded = new Map<string, { start: number; end: number }>();
  for (const req of input.requirements) {
    const roundedTime = occupancy(input, req);
    rounded.set(req.key, roundedTime);
    if (!inside(input.hours, roundedTime.start, roundedTime.end))
      throw new ApiError(422, "OUTSIDE_BUSINESS_HOURS");
    const eligible = input.resources
      .filter(
        (r) =>
          r.pools.includes(req.poolId) &&
          inside(r.hours, roundedTime.start, roundedTime.end) &&
          !input.busy.some(
            (b) =>
              b.resourceId === r.id &&
              overlap(b.start, b.end, roundedTime.start, roundedTime.end),
          ) &&
          !input.blocks.some(
            (b) =>
              ((!b.poolId && !b.resourceId) ||
                b.resourceId === r.id ||
                (!!b.poolId && r.pools.includes(b.poolId))) &&
              overlap(b.start, b.end, roundedTime.start, roundedTime.end),
          ),
      )
      .sort((a, b) => a.code.localeCompare(b.code) || a.id.localeCompare(b.id));
    if (eligible.length < req.units) throw new ApiError(409, "CAPACITY_FULL");
    candidates.set(req.key, eligible);
  }
  const requirements = [...input.requirements].sort(
    (a, b) =>
      candidates.get(a.key)!.length -
        a.units -
        (candidates.get(b.key)!.length - b.units) ||
      b.end - b.start - (a.end - a.start) ||
      a.key.localeCompare(b.key),
  );
  const assigned: { req: Requirement; resourceId: string }[] = [];
  let nodes = 0,
    result: Plan | undefined;
  const bucketMap = new Map(
    input.buckets.map((b) => [b.poolId + ":" + b.start, b]),
  );
  function tick() {
    if (++nodes > (input.budget ?? 10000))
      throw new ApiError(503, "CAPACITY_CHECK_UNAVAILABLE");
  }
  function finish(): Plan | undefined {
    const charges = new Map<
      string,
      { poolId: string; start: number; end: number; resources: Set<string> }
    >();
    for (const a of assigned) {
      const time = rounded.get(a.req.key)!;
      for (let t = time.start; t < time.end; t += input.bucketMinutes * 60000) {
        const k = a.req.poolId + ":" + t;
        if (!charges.has(k))
          charges.set(k, {
            poolId: a.req.poolId,
            start: t,
            end: t + input.bucketMinutes * 60000,
            resources: new Set(),
          });
        charges.get(k)!.resources.add(a.resourceId);
      }
    }
    for (const [k, ch] of charges) {
      const b = bucketMap.get(k);
      if (!b || b.closed || b.held + ch.resources.size > b.limit)
        return undefined;
    }
    const allocations: Allocation[] = [];
    const raw = assigned
      .map((a) => ({
        resourceId: a.resourceId,
        ...rounded.get(a.req.key)!,
        keys: [a.req.key],
      }))
      .sort(
        (a, b) => a.resourceId.localeCompare(b.resourceId) || a.start - b.start,
      );
    for (const a of raw) {
      const previous = allocations.at(-1);
      if (
        previous &&
        previous.resourceId === a.resourceId &&
        previous.end >= a.start
      ) {
        previous.end = Math.max(previous.end, a.end);
        previous.keys = [...new Set([...previous.keys, ...a.keys])];
      } else allocations.push({ ...a });
    }
    return {
      allocations,
      charges: [...charges.values()].map((c) => ({
        poolId: c.poolId,
        start: c.start,
        end: c.end,
        units: c.resources.size,
      })),
      start: Math.min(...input.requirements.map((r) => r.start)),
      end: Math.max(...input.requirements.map((r) => r.end)),
    };
  }
  function visit(index: number): boolean {
    tick();
    if (index === requirements.length) {
      result = finish();
      return !!result;
    }
    const req = requirements[index],
      available = candidates.get(req.key)!;
    function choose(from: number, left: number): boolean {
      tick();
      if (!left) return visit(index + 1);
      for (let i = from; i <= available.length - left; i++) {
        const r = available[i];
        if (
          assigned.some(
            (a) =>
              a.resourceId === r.id &&
              overlap(a.req.start, a.req.end, req.start, req.end),
          )
        )
          continue;
        assigned.push({ req, resourceId: r.id });
        if (choose(i + 1, left - 1)) return true;
        assigned.pop();
      }
      return false;
    }
    return choose(0, req.units);
  }
  if (!visit(0)) throw new ApiError(409, "CAPACITY_FULL");
  return result!;
}
