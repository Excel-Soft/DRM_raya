import { z } from "zod";
import { id, isoDate, remarks, reason, statusEnum } from "./common.validators";

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
