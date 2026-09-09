import { z } from "zod";
import { id, reason, rejectionReason } from "./common.validators";

/**
 * Generic approve / reject validators reused by HR, accounts and workflow
 * approval endpoints. A rejection always requires a reason; an approval may
 * optionally carry remarks.
 */

export const approvalActionSchema = z
  .object({
    entityId: id.optional(),
    decision: z.enum(["approve", "reject"]),
    reason: z.string().trim().max(2000).optional(),
  })
  .refine(
    (v) => v.decision !== "reject" || (v.reason && v.reason.trim().length > 0),
    { message: "A reason is required when rejecting", path: ["reason"] },
  );

export const approveSchema = z.object({
  entityId: id.optional(),
  remarks: z.string().trim().max(2000).optional(),
});

export const rejectSchema = z.object({
  entityId: id.optional(),
  reason: rejectionReason,
});

/** Status transition payload: where we are coming from and going to. */
export const statusTransitionSchema = z.object({
  entityId: id,
  fromStatus: z.string().trim().min(1).optional(),
  toStatus: z.string().trim().min(1, "Target status is required"),
  reason: reason.optional(),
});

export type ApprovalAction = z.infer<typeof approvalActionSchema>;
export type StatusTransition = z.infer<typeof statusTransitionSchema>;
