import { z } from "zod";
import { id, uuid, remarks, reason, statusEnum } from "./common.validators";

/**
 * Workflow / PMS / project-posting validators. Status values are intentionally
 * generic strings (each workflow defines its own set); use `workflowStatus()`
 * to pin an allow-list at the call site when known.
 */

export function workflowStatus<T extends readonly [string, ...string[]]>(values: T) {
  return statusEnum(values);
}

export const taskTransitionSchema = z.object({
  taskId: id,
  toStatus: z.string().trim().min(1, "Target status is required"),
  remarks: remarks.optional(),
});

export const assignTaskSchema = z.object({
  taskId: id,
  assigneeUserId: uuid,
  note: remarks.optional(),
});

export const verificationDecisionSchema = z
  .object({
    taskId: id,
    decision: z.enum(["approve", "return"]),
    reason: z.string().trim().max(2000).optional(),
  })
  .refine(
    (v) => v.decision !== "return" || (v.reason && v.reason.trim().length > 0),
    { message: "A reason is required when returning a task", path: ["reason"] },
  );

export const submitTaskSchema = z.object({
  taskId: id,
  note: remarks.optional(),
});

export type TaskTransition = z.infer<typeof taskTransitionSchema>;
export type VerificationDecision = z.infer<typeof verificationDecisionSchema>;
