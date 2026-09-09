import { z } from "zod";
import { id, uuid, isoDate, dateRange, reason, remarks, statusEnum } from "./common.validators";

/**
 * HR validators: leave, loan, overtime requests and their approval decisions.
 * These complement the existing inline guards in the HR routes — they validate
 * request shape only and do not change approval/role logic.
 */

export const hrRequestStatus = statusEnum(["Pending", "Approved", "Rejected"] as const);

export const leaveRequestSchema = z.object({
  range: dateRange,
  type: z.string().trim().min(1, "Leave type is required").max(60),
  reason: reason,
});

export const overtimeRequestSchema = z.object({
  date: isoDate,
  hours: z.coerce.number().positive("Hours must be positive").max(24, "Hours cannot exceed 24"),
  reason: reason,
});

export const loanRequestSchema = z.object({
  amount: z.coerce.number().positive("Loan amount must be positive"),
  installments: z.coerce.number().int().positive().max(120).optional(),
  reason: reason,
});

export const hrDecisionSchema = z
  .object({
    requestId: id.optional(),
    decision: z.enum(["approve", "reject"]),
    status: hrRequestStatus.optional(),
    reason: z.string().trim().max(2000).optional(),
  })
  .refine(
    (v) => v.decision !== "reject" || (v.reason && v.reason.trim().length > 0),
    { message: "A reason is required when rejecting", path: ["reason"] },
  );

export type LeaveRequest = z.infer<typeof leaveRequestSchema>;
export type HrDecision = z.infer<typeof hrDecisionSchema>;
