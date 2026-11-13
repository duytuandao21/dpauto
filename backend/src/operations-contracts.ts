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
  dataUrl: z.string().max(273100),
});
export const cmsQuery = z.strictObject({
  ...pagination,
  kind: z.enum(["NEWS", "PAGE", "SEO"]).optional(),
});
const block = z.strictObject({
  tag: z.enum(["p", "h2", "h3", "li", "blockquote"]),
  text: text(4000),
});
const commonContent = {
  title: text(180),
  description: z.string().trim().max(500),
  imageId: uuid.nullable(),
  blocks: z.array(block).max(100),
  noindex: z.boolean().default(false),
};
export const cmsPayload = z.strictObject({
  ...commonContent,
  category: z.string().trim().max(80).default(""),
  date: date.optional(),
});
export const cmsCreate = z.strictObject({
  kind: z.enum(["NEWS", "PAGE", "SEO"]),
  key: text(180),
  payload: cmsPayload,
});
export const cmsSave = z.strictObject({
  expectedVersion: version,
  payload: cmsPayload,
});
export const cmsPublish = command.extend({ revisionId: uuid });
