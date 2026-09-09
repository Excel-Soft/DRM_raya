/**
 * Penalty request validators (Zod) — PEN-001.
 *
 * These schemas are a behaviour-preserving port of the manual inline validation
 * that previously lived in penalty-routes.ts. Every message, coercion and the
 * ORDER in which fields are reported are mirrored EXACTLY so the existing
 * `{ error: "BadRequest", message }` 400 responses are byte-for-byte identical.
 * The route still owns all 401/403/404/409 checks and the actual persistence
 * mapping; these schemas only replace the field-shape (400) validation.
 *
 * Read `.issues[0].message` for the single user-facing message (matches the
 * previous "first failing check wins" behaviour).
 */
import { z } from "zod";

const custom = z.ZodIssueCode.custom;

/**
 * CREATE — the five up-front required fields, validated in this exact order:
 * employeeId, penaltyHead, reason, amount (>= 0), penaltyDate (valid date).
 * Unknown keys pass through untouched (department / attachments / approvalStatus
 * are still handled by the route). Output carries the same coercions the route
 * used to apply (trimmed strings, numeric amount).
 */
export const penaltyCreateSchema = z
  .object({
    employeeId: z.preprocess((v) => String(v ?? ""), z.string().min(1, "employeeId is required")),
    penaltyHead: z.preprocess((v) => String(v ?? "").trim(), z.string().min(1, "penaltyHead is required")),
    reason: z.preprocess((v) => String(v ?? "").trim(), z.string().min(1, "reason is required")),
    amount: z
      .any()
      .superRefine((v, ctx) => {
        const n = v === undefined || v === null || v === "" ? NaN : Number(v);
        if (Number.isNaN(n) || n < 0) {
          ctx.addIssue({ code: custom, message: "amount is required and must be >= 0" });
        }
      })
      .transform((v) => Number(v)),
    penaltyDate: z.preprocess(
      (v) => String(v ?? "").trim(),
      z
        .string()
        .refine(
          (s) => s !== "" && !Number.isNaN(new Date(s).getTime()),
          "penaltyDate is required and must be a valid date",
        ),
    ),
  })
  .passthrough();

/**
 * UPDATE — every field optional; only validated when present (mirrors the
 * `b.x !== undefined && ...` guards), reported in order amount, penaltyDate,
 * penaltyHead, reason. Used for VALIDATION ONLY; the route keeps its own
 * field-by-field persistence mapping (incl. null coercions) unchanged.
 */
export const penaltyUpdateSchema = z
  .object({
    amount: z.any().superRefine((v, ctx) => {
      if (v === undefined) return;
      const n = Number(v);
      if (Number.isNaN(n) || n < 0) ctx.addIssue({ code: custom, message: "amount must be >= 0" });
    }),
    penaltyDate: z.any().superRefine((v, ctx) => {
      if (v === undefined) return;
      if (Number.isNaN(new Date(String(v)).getTime())) {
        ctx.addIssue({ code: custom, message: "penaltyDate must be a valid date" });
      }
    }),
    penaltyHead: z.any().superRefine((v, ctx) => {
      if (v === undefined) return;
      if (!String(v).trim()) ctx.addIssue({ code: custom, message: "penaltyHead cannot be empty" });
    }),
    reason: z.any().superRefine((v, ctx) => {
      if (v === undefined) return;
      if (!String(v).trim()) ctx.addIssue({ code: custom, message: "reason cannot be empty" });
    }),
  })
  .passthrough();

/**
 * DECISION (approve / reject) — accepts the spec body shape `{approvalStatus}`
 * as well as the legacy `{decision|status}`; rejection requires hodRemarks.
 * Output is the normalised `{ decision, hodRemarks }` the route consumes.
 */
export const penaltyDecisionSchema = z
  .object({
    approvalStatus: z.any().optional(),
    decision: z.any().optional(),
    status: z.any().optional(),
    hodRemarks: z.any().optional(),
  })
  .transform((b) => ({
    decision: String(b.approvalStatus ?? b.decision ?? b.status ?? "").toUpperCase(),
    hodRemarks: b.hodRemarks ? String(b.hodRemarks).trim() : "",
  }))
  .superRefine((val, ctx) => {
    if (!["APPROVED", "REJECTED"].includes(val.decision)) {
      ctx.addIssue({ code: custom, message: "approvalStatus must be APPROVED or REJECTED" });
      return;
    }
    if (val.decision === "REJECTED" && !val.hodRemarks) {
      ctx.addIssue({ code: custom, message: "hodRemarks is required when rejecting a penalty" });
    }
  });

/**
 * VOID — a trimmed, non-empty reason is mandatory. Output is `{ reason }`.
 */
export const penaltyVoidSchema = z
  .object({ reason: z.any().optional() })
  .transform((b) => ({ reason: b.reason ? String(b.reason).trim() : "" }))
  .superRefine((val, ctx) => {
    if (!val.reason) ctx.addIssue({ code: custom, message: "reason is required to void a penalty" });
  });
