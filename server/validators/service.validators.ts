import { z } from "zod";
import { id, uuid, isoDate, remarks, reason, moneyAmount, statusEnum } from "./common.validators";

/**
 * Service-department / service-pool validators. Status values mirror
 * `servicePoolStatusEnum` (shared/schema.ts).
 */

export const servicePoolStatus = statusEnum([
  "active",
  "dropout",
  "completed",
  "refund",
  "temp",
  "pending",
] as const);

export const serviceStatusUpdateSchema = z.object({
  entityId: id,
  status: servicePoolStatus,
  reason: reason.optional(),
});

export const serviceAssignmentSchema = z.object({
  entityId: id,
  assigneeUserId: id,
  note: remarks.optional(),
});

export const serviceDropoutSchema = z.object({
  entityId: id,
  reason: reason, // dropouts must be justified
  effectiveDate: isoDate.optional(),
});

export type ServiceStatusUpdate = z.infer<typeof serviceStatusUpdateSchema>;

// --- Stage 2 DTO allow-lists for service-core write routes ------------------
// Status enums mirror shared/schema.ts service_* enums EXACTLY.

export const serviceFollowupStatus = statusEnum([
  "pending",
  "completed",
  "rescheduled",
  "missed",
] as const);

export const serviceComplaintStatus = statusEnum([
  "open",
  "in_progress",
  "resolved",
  "closed",
] as const);

export const serviceDropoutStatus = statusEnum([
  "pending_recovery",
  "recovered",
  "closed",
] as const);

export const serviceRenewalType = statusEnum(["renewal", "upgrade"] as const);

/**
 * Optional-field helpers. They preprocess `null` / `""` to `undefined` so an
 * omitted/blank value is simply NOT written (column keeps its NULL/default) —
 * exactly the legacy `...req.body` behaviour, where Drizzle ignores keys for
 * columns it isn't given. Without this, `z.coerce.date()` would turn `null`
 * into the 1970 epoch and `uuid.optional()` would 400 on a `null` that
 * previously inserted as NULL.
 */
const blankToUndef = (v: unknown) => (v === null || v === "" ? undefined : v);
const nullToUndef = (v: unknown) => (v === null ? undefined : v);

const optUuid = z.preprocess(blankToUndef, uuid.optional());
const optDate = z.preprocess(blankToUndef, z.coerce.date().optional());
const optMoney = z.preprocess(blankToUndef, moneyAmount.optional());
const optText = (max = 4000) =>
  z.preprocess(nullToUndef, z.string().trim().max(max).optional());
const optVarchar = (max: number) =>
  z.preprocess(blankToUndef, z.string().trim().max(max).optional());

/**
 * Create schemas STRIP unknown keys (mass-assignment guard) but are NOT
 * `.strict()`: callers legitimately send auxiliary fields (e.g. follow-up
 * `outcome`, consumed separately by CommunicationService). Only the columns
 * listed here ever reach the INSERT. Required fields mirror the table's
 * NOT-NULL columns and the pre-existing inline business checks, so no valid
 * request that previously succeeded is newly rejected.
 */
export const serviceFollowupCreateSchema = z.object({
  serviceCustomerId: uuid,
  customerId: optUuid,
  companyId: optUuid,
  assignedTo: optUuid,
  method: z.string().trim().min(1, "Follow-up method is required").max(64),
  purpose: optText(),
  note: optText(),
  status: z.preprocess(blankToUndef, serviceFollowupStatus.optional()),
  nextFollowupDate: optDate,
  completedAt: optDate,
});

export const serviceComplaintCreateSchema = z.object({
  serviceCustomerId: uuid,
  customerId: optUuid,
  companyId: optUuid,
  title: z.string().trim().min(1, "Complaint title is required").max(500),
  description: optText(),
  priority: optVarchar(32),
  assignedTo: optUuid,
  status: z.preprocess(blankToUndef, serviceComplaintStatus.optional()),
});

export const serviceDropoutCreateSchema = z.object({
  serviceCustomerId: uuid,
  customerId: optUuid,
  companyId: optUuid,
  reason: reason,
  status: z.preprocess(blankToUndef, serviceDropoutStatus.optional()),
  recoveryNote: optText(),
});

export const serviceRenewalCreateSchema = z.object({
  serviceCustomerId: uuid,
  oldPackageId: optVarchar(128),
  newPackageId: optVarchar(128),
  oldGmRecordId: optUuid,
  newGmRecordId: optUuid,
  renewalType: z.preprocess(blankToUndef, serviceRenewalType.optional()),
  oldExpiryDate: optDate,
  newStartDate: optDate,
  newExpiryDate: optDate,
  amount: optMoney,
  status: optVarchar(32),
});

export type ServiceFollowupCreate = z.infer<typeof serviceFollowupCreateSchema>;
export type ServiceComplaintCreate = z.infer<typeof serviceComplaintCreateSchema>;
export type ServiceDropoutCreate = z.infer<typeof serviceDropoutCreateSchema>;
export type ServiceRenewalCreate = z.infer<typeof serviceRenewalCreateSchema>;
