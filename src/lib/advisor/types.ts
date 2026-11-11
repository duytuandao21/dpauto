export type ServiceStage = "quote" | "work" | "acceptance" | "done";
export type QuoteStatus = "draft" | "waiting" | "confirmed" | "rejected";

export interface QuoteLine {
  id: string;
  kind: "service" | "part";
  name: string;
  code: string;
  unit: string;
  quantity: number;
  price: number;
  discount: number;
  vat: number;
  stock?: number;
}

export interface ServiceEvent {
  id: string;
  at: string;
  label: string;
  detail: string;
}

export interface ServiceOrder {
  id: string;
  bookingId: string;
  customerId: string;
  vehicleId: string;
  advisorId: string;
  openedAt: string;
  stage: ServiceStage;
  request: string;
  odo: string;
  exterior: string;
  interior: string;
  engine: string;
  dashboard: string;
  tires: string;
  operation: string[];
  receptionNote: string;
  photos: { id: string; dataUrl: string; name: string }[];
  quote: {
    id: string;
    status: QuoteStatus;
    lines: QuoteLine[];
    discount: number;
    note: string;
  };
  work: {
    technician: string;
    startedAt: string;
    dueAt: string;
    progress: number;
    checklist: { id: string; label: string; done: boolean }[];
    note: string;
    logs: ServiceEvent[];
  };
  acceptance: {
    inspector: string;
    checkedAt: string;
    result: "pending" | "passed" | "needs_work";
    note: string;
    checks: { id: string; label: string; passed: boolean }[];
  };
  finance: { deposit: number; collected: number };
  events: ServiceEvent[];
}

export interface ReceptionDraft {
  odo: string;
  request: string;
  exterior: string;
  interior: string;
  engine: string;
  dashboard: string;
  tires: string;
  operation: string[];
  receptionNote: string;
  photos: { id: string; dataUrl: string; name: string }[];
}
