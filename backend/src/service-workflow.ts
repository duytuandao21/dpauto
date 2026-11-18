import { fail } from "./common";

export const serviceStages = [
  "QUOTING",
  "WAITING_FOR_WORK",
  "IN_PROGRESS",
  "HANDOVER",
  "COMPLETED",
] as const;
export function checkServiceTransition(
  from: string,
  to: string,
  paused = false,
) {
  const i = serviceStages.indexOf(from as (typeof serviceStages)[number]);
  if (
    i < 0 ||
    i === serviceStages.length - 1 ||
    serviceStages[i + 1] !== to ||
    (paused && to === "HANDOVER")
  )
    fail(
      409,
      "INVALID_TRANSITION",
      "Thao tác không phù hợp với giai đoạn hiện tại của phiếu.",
    );
}
