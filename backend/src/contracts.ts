import { z } from "zod";
import { permissions } from "./stock-finance-contracts";
import {
  uuid,
  version,
  text,
  date,
  instant,
  phone,
  password,
  reason,
  pagination,
  boolQuery,
} from "./common";

const email = z
  .email()
  .max(254)
  .transform((s) => s.trim().toLowerCase());
const job = z.enum(["MANAGER", "ADVISOR", "TECHNICIAN"]);
const role = z.enum(["MANAGER", "ADVISOR", "CMS_ADMIN"]);
const grants = z
  .array(z.enum(permissions))
  .max(permissions.length)
  .refine((v) => new Set(v).size === v.length)
  .default([]);
const account = z.strictObject({
  email,
  temporaryPassword: password,
  role,
  permissions: grants,
});
const accountPatch = z.union([
  z.strictObject({ enable: account }),
  z.strictObject({
    status: z.enum(["ACTIVE", "DISABLED"]).optional(),
    role: role.optional(),
    permissions: grants.optional(),
  }),
]);
const nonempty = (v: Record<string, unknown>) =>
  Object.keys(v).some((k) => !["reason", "expectedVersion"].includes(k));
export const loginInput = z.strictObject({
  email,
  password: z.string().min(1).max(512),
});
export const passwordInput = z.strictObject({
  currentPassword: z.string().min(1).max(512),
  newPassword: password,
});
export const staffCreate = z.strictObject({
  name: text(100),
  phone,
  email,
  jobRole: job,
  active: z.boolean(),
  account: account.optional(),
});
export const staffPatch = z
  .strictObject({
    expectedVersion: version,
    reason,
    name: text(100).optional(),
    phone: phone.optional(),
    email: email.optional(),
    jobRole: job.optional(),
    active: z.boolean().optional(),
    account: accountPatch.optional(),
  })
  .refine(nonempty);
export const staffQuery = z.strictObject({
  ...pagination,
  q: text(100).optional(),
  jobRole: job.optional(),
  active: boolQuery,
  date: date.optional(),
  sort: z.enum(["name:asc", "createdAt:desc"]).default("name:asc"),
});
export const resetInput = z.strictObject({
  expectedVersion: version,
  reason,
  temporaryPassword: password,
});
export const requirement = z
  .strictObject({
    poolId: uuid,
    units: z.number().int().min(1).max(256),
    offsetMinutes: z.number().int().min(0).max(1440),
    durationMinutes: z.number().int().min(1).max(1440),
  })
  .refine((r) => r.offsetMinutes + r.durationMinutes <= 1440);
const serviceFields = {
  code: z.string().regex(/^[A-Z0-9_-]{3,50}$/),
  name: text(120),
  categoryCode: z.enum(["MAINTENANCE", "DETAILING", "ACCESSORIES", "OTHER"]),
  active: z.boolean(),
  bookable: z.boolean(),
  sortOrder: z.number().int().min(0),
  estimatedDurationMinutes: z.number().int().min(15).max(1440),
  qualityChecks: z.array(text(160)).max(30).refine(a=>new Set(a).size===a.length).optional(),
  technicianRequired: z.boolean().optional(),
  description: text(1000).optional(),
  marketingSlug: text(150).optional(),
};
export const serviceCreate = z.strictObject(serviceFields);
const { code, ...editableService } = serviceFields;
export const servicePatch = z
  .strictObject({
    expectedVersion: version,
    reason,
    ...Object.fromEntries(
      Object.entries(editableService).map(([k, v]) => [k, v.optional()]),
    ),
  })
  .refine(nonempty);
export const serviceQuery = z.strictObject({
  ...pagination,
  q: text(100).optional(),
  active: boolQuery,
  bookable: boolQuery,
  categoryCode: text(40).optional(),
  sort: z.enum(["name:asc", "sortOrder:asc"]).default("sortOrder:asc"),
});
export const customerQuery = z.strictObject({
  ...pagination,
  q: text(100).optional(),
  multipleVehicles: boolQuery,
  sort: z.enum(["name:asc", "createdAt:desc"]).default("name:asc"),
});
export const customerPatch = z.strictObject({
  expectedVersion: version,
  name: text(100),
  phone,
  reason,
});
export const customerDelete = z.strictObject({
  expectedVersion: version,
  reason: reason.default("Xóa khách hàng"),
});
export const customerMerge = z.strictObject({
  expectedVersion: version,
  targetId: uuid,
  targetVersion: version,
  reason,
});
export const vehicleQuery = z.strictObject({
  ...pagination,
  q: text(100).optional(),
  customerId: uuid.optional(),
  sort: z.enum(["plate:asc", "createdAt:desc"]).default("plate:asc"),
});
export const relatedQuery = z.strictObject({
  relatedLimit: z.coerce.number().int().min(1).max(20).default(10),
});
const contactNew = z.strictObject({ name: text(100), phone });
export const contact = z.union([z.strictObject({ id: uuid }), contactNew]);
const vehicleNew = z
  .strictObject({
    model: text(100).optional(),
    plate: text(20).optional(),
    year: z
      .number()
      .int()
      .min(1900)
      .max(new Date().getUTCFullYear() + 1)
      .optional(),
  })
  .refine((v) => !!v.model || !!v.plate);
export const vehicle = z
  .union([z.strictObject({ id: uuid }), vehicleNew])
  .nullable()
  .optional();
export const serviceIds = z
  .array(uuid)
  .min(1)
  .max(10)
  .refine((v) => new Set(v).size === v.length);
export const notice = z.strictObject({
  privacyNoticeVersion: text(40),
  privacyNoticeAcknowledged: z.literal(true),
  marketingConsent: z.boolean().default(false),
});
export const period = z.enum(["MORNING", "AFTERNOON"]);
const createFields = {
  serviceIds,
  requestedStartAt: instant,
  catalogVersion: version,
  policyVersion: version,
  notice,
};
// Customers pick a day and a period only; there is no time slot and no per-period limit.
export const publicCreate = z.strictObject({
  serviceIds,
  requestedDate: date,
  requestedPeriod: period,
  catalogVersion: version,
  notice,
  customer: contactNew,
  vehicle: vehicleNew.nullable().optional(),
  note: text(1000).optional(),
  channelToken: z.string().max(1024).optional(),
});
export const bookingCreate = z
  .strictObject({
    ...createFields,
    requestedStartAt: instant.optional(),
    requestedDate: date.optional(),
    requestedPeriod: period.optional(),
    confirmNow: z.boolean().default(false),
    customerAgreed: z.literal(true).optional(),
    customer: contact,
    vehicle,
    source: z.enum(["PHONE", "AT_STATION", "ZALO", "OTHER"]),
    advisorId: uuid.nullable().optional(),
    customerNote: text(1000).optional(),
    internalNote: text(1000).optional(),
    // Partner car: the customer becomes the partner profile; the sale is kept for reconciliation.
    partnerSaleId: uuid.optional(),
  })
  .refine((v) =>
    v.requestedStartAt
      ? !v.requestedDate && !v.requestedPeriod
      : !!v.requestedDate && !!v.requestedPeriod,
  )
  .refine(
    (v) => !v.confirmNow || (!!v.requestedStartAt && v.customerAgreed === true),
  );
export const bookingPatch = z
  .strictObject({
    expectedVersion: version,
    reason,
    customerContact: contactNew.optional(),
    vehicle,
    serviceIds: serviceIds.optional(),
    catalogVersion: version.optional(),
    policyVersion: version.optional(),
    customerNote: z.string().trim().max(1000).optional(),
    internalNote: z.string().trim().max(1000).optional(),
    // Only switches the sale of a partner booking; the partner flag itself is set at creation.
    partnerSaleId: uuid.optional(),
  })
  .refine(nonempty);
export const confirmInput = z.strictObject({
  expectedVersion: version,
  confirmedStartAt: instant,
  customerAgreed: z.literal(true),
  reason: reason.default("Xác nhận giờ hẹn đã thống nhất với khách"),
  internalNote: text(1000).optional(),
  policyVersion: version.optional(),
  // Manager only: who takes an unclaimed request being confirmed.
  advisorId: uuid.optional(),
});
// Either an exact new time, or (while still pending) a new day + period agreed with the customer.
export const rescheduleInput = z
  .strictObject({
    expectedVersion: version,
    newStartAt: instant.optional(),
    requestedDate: date.optional(),
    requestedPeriod: period.optional(),
    customerAgreed: z.literal(true),
    reason: reason.default("Điều chỉnh giờ hẹn đã thống nhất với khách"),
    policyVersion: version.optional(),
  })
  .refine((v) =>
    v.newStartAt
      ? !v.requestedDate && !v.requestedPeriod && !!v.policyVersion
      : !!v.requestedDate && !!v.requestedPeriod,
  );
export const reasonInput = z.strictObject({ expectedVersion: version, reason });
/** Body of every soft-delete endpoint (service, staff, partner, part, vehicle…). */
export const deleteInput = z.strictObject({
  expectedVersion: version,
  reason: reason.default("Xóa khỏi danh mục"),
});
export const partnerInput = z.strictObject({
  name: text(120),
  phone: phone.optional(),
});
export const partnerPatch = z.strictObject({
  expectedVersion: version,
  name: text(120),
  phone: phone.nullable().optional(),
  active: z.boolean(),
});
export const partnerSaleInput = z.strictObject({
  name: text(100),
  phone: phone.optional(),
});
export const partnerSalePatch = z.strictObject({
  expectedVersion: version,
  name: text(100),
  phone: phone.nullable().optional(),
  active: z.boolean(),
});
export const bookingDelete = z.strictObject({
  expectedVersion: version,
  reason: reason.default("Xóa lịch hẹn"),
});
export const noShowInput = z.strictObject({
  expectedVersion: version,
  reason,
  checkedManually: z.literal(true),
});
export const assignInput = z.strictObject({
  expectedVersion: version,
  reason,
  advisorId: uuid,
});
export const transferInput = z.strictObject({
  expectedVersion: version,
  reason,
  toAdvisorId: uuid,
});
export const contactInput = z
  .strictObject({
    expectedVersion: version,
    channel: z.enum(["PHONE", "ZALO", "IN_PERSON", "OTHER"]),
    outcome: z.enum([
      "UNREACHED",
      "AGREED",
      "PROPOSED_TIME",
      "DECLINED",
      "OTHER",
    ]),
    proposedStartAt: instant.optional(),
    customerAccepted: z.boolean().optional(),
    note: text(1000).optional(),
    callbackAt: instant.optional(),
  })
  .refine((v) => v.outcome !== "PROPOSED_TIME" || !!v.proposedStartAt);
export const bookingPreviewInput = z.strictObject({
  expectedVersion: z.coerce.number().int().min(1),
  action: z.enum(["confirm", "reschedule"]),
  startAt: instant,
  advisorId: uuid.optional(),
});
export const bookingCreatePreviewInput = z.strictObject({
  startAt: instant,
  serviceIds: z
    .string()
    .transform((s) => s.split(","))
    .pipe(serviceIds),
  catalogVersion: z.coerce.number().int().min(1),
  advisorId: uuid.optional(),
});
export const bookingQuery = z
  .strictObject({
    ...pagination,
    from: date.optional(),
    to: date.optional(),
    customerId: uuid.optional(),
    vehicleId: uuid.optional(),
    q: text(100).optional(),
    status: z
      .string()
      .regex(
        /^(PENDING|CONFIRMED|ARRIVED|COMPLETED|CANCELLED|NO_SHOW)(,(PENDING|CONFIRMED|ARRIVED|COMPLETED|CANCELLED|NO_SHOW))*$/,
      )
      .optional(),
    advisorId: z.union([uuid, z.literal("unassigned")]).optional(),
    serviceId: uuid.optional(),
    categoryCode: text(40).optional(),
    source: z
      .enum(["WEBSITE", "QR", "PHONE", "AT_STATION", "ZALO", "OTHER"])
      .optional(),
    changeKind: z.enum(["NEW", "RESCHEDULED", "CANCELLED"]).optional(),
    sort: z
      .enum(["scheduledStartAt:asc", "scheduledStartAt:desc", "createdAt:desc"])
      .default("scheduledStartAt:asc"),
  })
  .refine(
    (q) =>
      !!q.from === !!q.to &&
      (!!q.from ||
        !!q.customerId ||
        !!q.vehicleId ||
        q.status === "PENDING" ||
        q.status === "PENDING,ARRIVED"),
  );
export const historyQuery = z.strictObject({
  ...pagination,
  from: date,
  to: date,
  q: text(100).optional(),
  sort: z.literal("assignedAt:desc").default("assignedAt:desc"),
});
export const eventsQuery = z.strictObject(pagination);
export const capacityQuery = z.strictObject({
  from: date,
  to: date,
});
const hour = z
  .strictObject({
    weekday: z.number().int().min(0).max(6),
    opensAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    closesAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  })
  .refine((h) => h.closesAt > h.opensAt);
export const policyInput = z
  .strictObject({
    expectedVersion: version,
    reason,
    bookingEnabled: z.boolean(),
    slotMinutes: z.number().int().min(15).max(120),
    maxBookingsPerSlot: z.number().int().min(1).max(100),
    hours: z.array(hour).max(28),
  })
  .refine(
    (v) =>
      v.hours.every(
        (h, i) =>
          !v.hours.some(
            (other, j) =>
              j !== i &&
              other.weekday === h.weekday &&
              other.opensAt < h.closesAt &&
              other.closesAt > h.opensAt,
          ),
      ),
    "Giờ hoạt động bị chồng lấn.",
  );
export const materializeInput = z.strictObject({
  date,
  expectedPolicyVersion: version,
  reason,
});
export const bucketInput = z
  .strictObject({
    expectedVersion: version,
    reason,
    startAt: instant,
    capacityLimit: z.number().int().min(0).max(100).optional(),
    closed: z.boolean().optional(),
  })
  .refine((v) => v.capacityLimit !== undefined || v.closed !== undefined);
export const blocksQuery = z.strictObject({
  ...pagination,
  from: date,
  to: date,
});
export const blockInput = z
  .strictObject({
    startsAt: instant,
    endsAt: instant,
    reason,
    kind: z.enum(["HOLIDAY", "MAINTENANCE", "MANUAL_CLOSE"]),
  })
  .refine(
    (v) =>
      Date.parse(v.endsAt) > Date.parse(v.startsAt) &&
      Date.parse(v.endsAt) - Date.parse(v.startsAt) <= 366 * 86400000,
  );
export const auditQuery = z.strictObject({
  ...pagination,
  from: date,
  to: date,
  actorId: uuid.optional(),
  action: text(100).optional(),
  entityType: text(100).optional(),
  entityId: uuid.optional(),
  sort: z.literal("occurredAt:desc").default("occurredAt:desc"),
});
export const dashboardQuery = z.strictObject({ date });
export const settingsInput = z.strictObject({
  expectedVersion: version,
  reason,
  name: text(120),
  phone,
  address: text(250),
  directionsUrl: z
    .url()
    .max(2048)
    .refine((v) => {
      const u = new URL(v);
      return (
        u.protocol === "https:" &&
        !u.username &&
        !u.password &&
        (u.hostname === "google.com" ||
          u.hostname.endsWith(".google.com") ||
          ["maps.app.goo.gl", "share.google"].includes(u.hostname))
      );
    }),
  privacyNoticeVersion: text(40),
  marketingNoticeVersion: text(40).nullable().optional(),
});
export const availabilityQuery = z.strictObject({ date });
export const publicServicesQuery = z.strictObject({});
/** Public "Tra cứu": both plate and phone must match the ticket. */
export const vehicleStatusInput = z.strictObject({
  plate: z
    .string()
    .max(20)
    .transform((s) => s.toUpperCase().replace(/[^A-Z0-9]/g, ""))
    .refine((s) => s.length >= 5),
  phone,
});
