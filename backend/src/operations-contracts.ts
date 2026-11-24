import { z } from "zod";
import {
  date,
  instant,
  pagination,
  reason,
  text,
  uuid,
  version,
} from "./common";

export const period = z.strictObject({ from: date, to: date });
export const alertQuery = z.strictObject({ ...pagination });
export const exportQuery = period.extend({ type: z.enum(["VISITS", "CASH"]) });
export const shiftQuery = period.extend({
  ...pagination,
  staffId: uuid.optional(),
});
export const shiftCreate = z.strictObject({
  staffId: uuid,
  kind: z.enum(["WORK", "LEAVE"]),
  startsAt: instant,
  endsAt: instant,
  note: reason,
});
export const command = z.strictObject({ expectedVersion: version, reason });
export const readNotice = z.strictObject({ expectedVersion: version });
export const retryJob = command;
export const jobsQuery = z.strictObject({ ...pagination });
export const mediaCreate = z.strictObject({
  name: text(120),
  alt: text(240),
});
export const mediaQuery = z.strictObject({
  ...pagination,
  search: z.string().trim().max(120).optional(),
  trash: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  type: z.enum(["image", "video"]).optional(),
});
const focal = z.number().min(0).max(1);
export const mediaUpdate = z
  .strictObject({
    name: text(120).optional(),
    alt: text(240).optional(),
    focalX: focal.optional(),
    focalY: focal.optional(),
  })
  .refine((v) => (v.focalX === undefined) === (v.focalY === undefined), {
    path: ["focalY"],
  })
  .refine((v) => Object.keys(v).length > 0);
