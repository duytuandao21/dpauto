export const stationToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export type OperationsSummary = {
  from: string;
  to: string;
  asOf: string;
  scope: string;
  received: number;
  handovers: number;
  openFromCohort: number;
  completionRate: { numerator: number; denominator: number };
  noShowRate: { numerator: number; denominator: number };
  averageTurnaroundMinutes: number | null;
  stages: { stage: string; count: number }[];
  technicians: { id: string; name: string; completed: number }[];
  finance?: {
    cashIn: string;
    cashOut: string;
    netCash: string;
    approvedQuotes: string;
    outstanding: string;
  };
};
export type OperationAlert = {
  id: string;
  title: string;
  code: string;
  severity: "DANGER" | "WARNING" | "INFO";
  at: string;
  subjectId: string;
  subjectType: "visit" | "booking";
};
export type StaffShift = {
  id: string;
  staffId: string;
  name: string;
  kind: "WORK" | "LEAVE";
  startsAt: string;
  endsAt: string;
  note: string;
  version: number;
};
export type InboxNotice = {
  id: string;
  title: string;
  subjectId: string;
  subjectType: "visit" | "booking";
  createdAt: string;
  readAt: string | null;
  version: number;
};
export type NotificationJob = {
  id: string;
  status: string;
  attempts: number;
  version: number;
  errorCode: string | null;
  nextAttemptAt: string | null;
  createdAt: string;
  deliveries: {
    attempt: number;
    channel: string;
    status: string;
    errorCode: string | null;
    at: string;
  }[];
};
export const operationStages: Record<string, string> = {
  RECEIVED: "Mới tiếp nhận",
  INSPECTED: "Đã kiểm tra",
  IN_PROGRESS: "Đang thi công",
  QUALITY_CHECK: "Chờ nghiệm thu",
  READY: "Sẵn sàng bàn giao",
  HANDED_OVER: "Đã bàn giao",
  ABORTED: "Đã dừng",
};
export const rateText = (r: { numerator: number; denominator: number }) =>
  r.denominator
    ? `${((100 * r.numerator) / r.denominator).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}% (${r.numerator}/${r.denominator})`
    : "— (0/0)";
export function subjectHref(base: string, type: string, id: string) {
  return type === "visit"
    ? `${base}/phieu-dich-vu/${id}`
    : `${base}/lich-hen?selected=${encodeURIComponent(id)}`;
}
