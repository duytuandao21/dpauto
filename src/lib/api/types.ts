export type AuthSession = {
  user: { id: string; email: string; status: string; authVersion: number };
  staff: { id: string; name: string; jobRole: string; stationId: string };
  roles: string[];
  permissions: string[];
  mustChangePassword: boolean;
  csrfToken: string;
};
export type ApiService = {
  /** Set when soft-deleted: kept so old bookings still show the name. */
  deletedAt?: string | null;
  qualityChecks?: string[];
  technicianRequired?: boolean;
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: { code: string; name: string };
  active: boolean;
  bookable: boolean;
  sortOrder: number;
  requirements: {
    poolId: string;
    units: number;
    offsetMinutes: number;
    durationMinutes: number;
  }[];
  estimatedDurationMinutes: number;
  version: number;
};
export type ApiBooking = {
  id: string;
  code: string;
  partner?: import("./partners").PartnerSnapshot | null;
  status: string;
  source: string;
  customer: { name: string; phone: string };
  vehicle: { id: string; model: string | null; plate: string | null } | null;
  services: { id: string; name: string }[];
  requestedStartAt: string;
  requestedPeriod?: "MORNING" | "AFTERNOON" | null;
  originalRequestedPeriod?: "MORNING" | "AFTERNOON" | null;
  scheduledStartAt: string;
  confirmedStartAt: string | null;
  assignedAdvisor: { id: string; name: string } | null;
  changeKind: string;
  version: number;
  customerId?: string;
  vehicleId?: string | null;
  customerNote?: string | null;
  internalNote?: string | null;
  createdAt?: string;
  allowedActions?: string[];
  serviceVisitId?: string | null;
  lastContactOutcome?: string | null;
  contactAttempts?: number;
  callbackAt?: string | null;
};
export type ApiStaff = {
  deletedAt?: string | null;
  id: string;
  name: string;
  jobRole: string;
  active: boolean;
  version: number;
  phone?: string;
  email?: string;
  accountEnabled?: boolean;
};
export type ApiPolicy = {
  slotMinutes: number;
  maxBookingsPerSlot: number;
  stationId: string;
  bookingEnabled: boolean;
  configurationVersion: number;
  leadMinutes: number;
  advanceDays: number;
  hours: { weekday: number; opensAt: string; closesAt: string }[];
};
export type PublicCatalog = {
  services: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    estimatedDurationLabel: string;
    estimatedDurationMinutes: number;
    /** Website service key this booking service mirrors. */
    marketingSlug: string | null;
  }[];
  catalogVersion: number;
  policyVersion: number;
  bookingPolicy: {
    leadMinutes: number;
    advanceDays: number;
    startGridMinutes: number;
    privacyNoticeVersion: string;
    privacyNoticeUrl: string;
    marketingNoticeVersion: string | null;
  };
};
export type ApiSettings = {
  stationId: string;
  name: string;
  phone: string;
  address: string;
  directionsUrl: string;
  timezone: string;
  privacyNoticeVersion: string;
  marketingNoticeVersion: string | null;
  version: number;
  bookingQrUrl: string;
};
export type ApiBucket = {
  id: string;
  startAt: string;
  endAt: string;
  capacityLimit: number;
  heldUnits: number;
  pendingCount: number;
  confirmedCount: number;
  freeUnits: number;
  closed: boolean;
  version: number;
  holdRefs: {
    bookingId: string | null;
    visitId?: string | null;
    units: number;
  }[];
};
export function stationTime(instant: string) {
  const d = new Date(instant);
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  return `${date}T${time}:00+07:00`;
}
