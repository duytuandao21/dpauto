export type VisitStage =
  | "RECEIVED"
  | "INSPECTED"
  | "IN_PROGRESS"
  | "QUALITY_CHECK"
  | "READY"
  | "HANDED_OVER"
  | "ABORTED";
export const visitStages: Record<VisitStage, string> = {
  RECEIVED: "Đã tiếp nhận",
  INSPECTED: "Đã kiểm tra",
  IN_PROGRESS: "Đang thi công",
  QUALITY_CHECK: "Chờ nghiệm thu",
  READY: "Sẵn sàng bàn giao",
  HANDED_OVER: "Đã bàn giao",
  ABORTED: "Đã dừng",
};
export const visitStageTone: Record<VisitStage, string> = {
  RECEIVED: "pending",
  INSPECTED: "pending",
  IN_PROGRESS: "confirmed",
  QUALITY_CHECK: "arrived",
  READY: "completed",
  HANDED_OVER: "completed",
  ABORTED: "cancelled",
};
export type Intake = {
  request: string;
  odometer: number | null;
  odometerMissingReason?: string | null;
  plateMissingReason?: string | null;
  conditions: {
    exterior: string;
    interior: string;
    engine: string;
    dashboard: string;
    tires: string;
    operation: string[];
  };
  receptionNote: string;
  photos: { name: string; dataUrl: string }[];
};
export const emptyIntake: Intake = {
  request: "",
  odometer: null,
  conditions: {
    exterior: "",
    interior: "",
    engine: "",
    dashboard: "",
    tires: "",
    operation: [],
  },
  receptionNote: "",
  photos: [],
};
export type Visit = {
  id: string;
  code: string;
  bookingId: string | null;
  origin: "BOOKING" | "WALK_IN";
  stage: VisitStage;
  customerId: string;
  vehicleId: string;
  version: number;
  receivedAt: string;
  customer: { name: string; phone: string };
  vehicle: {
    id: string;
    model: string | null;
    plate: string | null;
    year?: number | null;
  };
  assignedAdvisor: { id: string; name: string };
  work?: {
    status: string;
    dueAt: string | null;
    total: number;
    done: number;
    technicians: string[];
  } | null;
  services: { id: string; name: string }[];
};
export type VisitDetail = Visit & {
  intake: Omit<Intake, "photos">;
  media: { id: string; name: string; uploadedAt: string }[];
  followUpOfVisitId: string | null;
  followUpReason: string | null;
  reservation: {
    id: string;
    startAt: string;
    endAt: string;
    status: string;
  } | null;
  allowedActions: string[];
};

export function visitFollowUp(visit: Visit, now: number) {
  if (visit.stage === "HANDED_OVER" || visit.stage === "ABORTED") return null;
  if (
    visit.stage === "IN_PROGRESS" &&
    visit.work?.dueAt &&
    !["FINISHED", "ABORTED"].includes(visit.work.status) &&
    new Date(visit.work.dueAt).getTime() < now
  )
    return {
      label: "Xe quá hạn hoàn thành",
      badge: "Quá hạn",
      tone: "cancelled",
      tab: "thi-cong",
      priority: 0,
    } as const;
  const tasks = {
    RECEIVED: {
      label: "Kiểm tra xe tiếp nhận",
      badge: "Tiếp nhận",
      tone: "pending",
      tab: "tong-quan",
      priority: 2,
    },
    INSPECTED: {
      label: "Xử lý báo giá",
      badge: "Báo giá",
      tone: "pending",
      tab: "bao-gia",
      priority: 3,
    },
    IN_PROGRESS: {
      label: "Theo dõi thi công",
      badge: "Thi công",
      tone: "confirmed",
      tab: "thi-cong",
      priority: 3,
    },
    QUALITY_CHECK: {
      label: "Xe chờ nghiệm thu",
      badge: "Nghiệm thu",
      tone: "arrived",
      tab: "nghiem-thu",
      priority: 4,
    },
    READY: {
      label: "Xe chờ bàn giao",
      badge: "Bàn giao",
      tone: "completed",
      tab: "nghiem-thu",
      priority: 5,
    },
  } as const;
  return tasks[visit.stage];
}
export type VisitReceipt = {
  visitId: string;
  code: string;
  bookingId: string | null;
  stage: VisitStage;
  version: number;
};
export type VisitEvent = {
  id: string;
  type: string;
  occurredAt: string;
  reason: string | null;
  data: Record<string, unknown>;
};

export function intakePayload(value: Intake) {
  return {
    ...value,
    request: value.request.trim(),
    odometerMissingReason:
      value.odometer === null
        ? value.odometerMissingReason?.trim() || undefined
        : undefined,
    plateMissingReason: value.plateMissingReason?.trim() || undefined,
  };
}
