import { z } from "zod";
import { uuid, isoDate, remarks } from "./common.validators";

/**
 * Stage 7 — communication / follow-up validators.
 *
 * Mirrors `communicationChannelEnum` / `communicationOutcomeEnum`
 * (shared/schema.ts) without importing the DB layer so it stays usable from
 * request handlers before any DB access.
 */

export const COMMUNICATION_CHANNELS = [
  "CALL",
  "WHATSAPP",
  "EMAIL",
  "MEETING",
  "VISIT",
  "SMS",
  "NOTE",
  "OTHER",
] as const;

export const COMMUNICATION_OUTCOMES = [
  "INTERESTED",
  "NOT_INTERESTED",
  "CALLBACK",
  "NO_RESPONSE",
  "CONVERTED",
  "COMPLAINT",
  "RENEWAL",
  "RESOLVED",
  "DROPOUT_RISK",
  "OTHER",
] as const;

export const COMMUNICATION_ENTITY_TYPES = [
  "customer",
  "lead",
  "service_customer",
  "ticket",
  "project",
] as const;

export const COMMUNICATION_STATUSES = ["PENDING", "COMPLETED", "CANCELLED"] as const;

/** Outcomes that demand a scheduled next follow-up date. */
const OUTCOMES_REQUIRING_NEXT = new Set(["CALLBACK", "NO_RESPONSE"]);
/** Negative / sensitive outcomes that demand explanatory notes. */
const OUTCOMES_REQUIRING_NOTES = new Set([
  "COMPLAINT",
  "DROPOUT_RISK",
  "NOT_INTERESTED",
]);

const channel = z.enum(COMMUNICATION_CHANNELS);
const outcome = z.enum(COMMUNICATION_OUTCOMES);
const entityType = z.enum(COMMUNICATION_ENTITY_TYPES);
const status = z.enum(COMMUNICATION_STATUSES);

const baseCommunication = z.object({
  entityType,
  entityId: z.string().trim().min(1, "entityId is required").max(128),
  customerId: uuid.optional(),
  leadId: uuid.optional(),
  channel,
  outcome: outcome.optional(),
  notes: remarks.optional(),
  nextAction: z.string().trim().max(2000).optional(),
  nextFollowupAt: isoDate.optional(),
  status: status.optional(),
  relatedFollowupId: z.string().trim().max(128).optional(),
  relatedAppointmentId: z.string().trim().max(128).optional(),
  messageTemplate: z.string().trim().max(2000).optional(),
  externalReference: z.string().trim().max(256).optional(),
  // Optional service/subservice linkage. A subservice may never be supplied
  // without its parent service (rule: never silently fall back to the first
  // available service). The pair itself is validated against the DB in the
  // service layer.
  serviceId: z.string().trim().max(128).optional(),
  subServiceId: z.string().trim().max(128).optional(),
});

/**
 * Create a communication log.
 * Rules enforced here:
 *  - channel always required (schema)
 *  - outcome required when the entry is COMPLETED (a finished follow-up must say
 *    how it went). Default status is COMPLETED, so a bare log needs an outcome.
 *  - next follow-up date required for CALLBACK / NO_RESPONSE, or whenever the
 *    entry is left PENDING (it is a scheduled future touch).
 *  - notes required for COMPLAINT / DROPOUT_RISK / NOT_INTERESTED outcomes.
 *  - a subservice may not be supplied without a service.
 */
export const createCommunicationSchema = baseCommunication
  .refine(
    (v) => {
      const effectiveStatus = v.status ?? "COMPLETED";
      return effectiveStatus !== "COMPLETED" || Boolean(v.outcome);
    },
    { message: "An outcome is required for a completed follow-up", path: ["outcome"] },
  )
  .refine(
    (v) => {
      const needsNext =
        (v.outcome && OUTCOMES_REQUIRING_NEXT.has(v.outcome)) ||
        (v.status ?? "COMPLETED") === "PENDING";
      return !needsNext || Boolean(v.nextFollowupAt);
    },
    {
      message:
        "A next follow-up date is required for callbacks, no-response, or pending follow-ups",
      path: ["nextFollowupAt"],
    },
  )
  .refine(
    (v) => !(v.outcome && OUTCOMES_REQUIRING_NOTES.has(v.outcome)) || Boolean(v.notes?.trim()),
    {
      message: "Notes are required for complaint, dropout-risk, or not-interested outcomes",
      path: ["notes"],
    },
  )
  .refine((v) => !v.subServiceId || Boolean(v.serviceId), {
    message: "A subservice cannot be selected without its parent service",
    path: ["serviceId"],
  });

/** Patch an existing communication log (notes / next action / reschedule / status). */
export const patchCommunicationSchema = z
  .object({
    outcome: outcome.optional(),
    notes: remarks.optional(),
    nextAction: z.string().trim().max(2000).optional(),
    nextFollowupAt: isoDate.optional(),
    status: status.optional(),
    messageTemplate: z.string().trim().max(2000).optional(),
    externalReference: z.string().trim().max(256).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "At least one field must be provided",
  })
  .refine(
    (v) => !(v.outcome && OUTCOMES_REQUIRING_NOTES.has(v.outcome)) || Boolean(v.notes?.trim()),
    {
      message: "Notes are required for complaint, dropout-risk, or not-interested outcomes",
      path: ["notes"],
    },
  );

/** Complete the scheduled next action of a PENDING follow-up. */
export const completeNextActionSchema = z.object({
  outcome,
  notes: remarks.optional(),
  // Optionally schedule a further follow-up when closing this one.
  nextFollowupAt: isoDate.optional(),
  nextAction: z.string().trim().max(2000).optional(),
}).refine(
  (v) => !OUTCOMES_REQUIRING_NOTES.has(v.outcome) || Boolean(v.notes?.trim()),
  {
    message: "Notes are required for complaint, dropout-risk, or not-interested outcomes",
    path: ["notes"],
  },
).refine(
  (v) => !OUTCOMES_REQUIRING_NEXT.has(v.outcome) || Boolean(v.nextFollowupAt),
  {
    message: "A next follow-up date is required for callbacks or no-response",
    path: ["nextFollowupAt"],
  },
);

/** Query filters for the list endpoint and timelines. */
export const listCommunicationsSchema = z.object({
  entityType: entityType.optional(),
  entityId: z.string().trim().max(128).optional(),
  customerId: uuid.optional(),
  channel: channel.optional(),
  outcome: outcome.optional(),
  userId: uuid.optional(),
  status: status.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export type CreateCommunication = z.infer<typeof createCommunicationSchema>;
export type PatchCommunication = z.infer<typeof patchCommunicationSchema>;
export type CompleteNextAction = z.infer<typeof completeNextActionSchema>;
export type ListCommunications = z.infer<typeof listCommunicationsSchema>;
