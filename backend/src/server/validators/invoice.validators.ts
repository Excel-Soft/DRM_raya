import { z } from "zod";
import {
  id,
  uuid,
  isoDate,
  moneyAmount,
  currency,
  percentage,
  remarks,
  reason,
  rejectionReason,
  statusEnum,
} from "./common.validators";
import { invoiceTypeSchema } from "../../shared/gm-sales-constants";

/**
 * Invoice domain validators. Mirrors the values in `invoiceStatusEnum`
 * (shared/schema.ts) without importing the DB layer, so it stays usable from
 * request handlers before any DB access.
 */

export const invoiceStatus = statusEnum([
  "Draft",
  "Pending",
  "Sent",
  "Paid",
  "Overdue",
  "Cancelled",
] as const);

export const invoiceLineItem = z.object({
  description: z.string().trim().min(1, "Description is required").max(500),
  quantity: z.coerce.number().int().positive("Quantity must be positive"),
  unitPrice: moneyAmount,
  discountPercent: percentage.optional(),
});

export const createInvoiceSchema = z.object({
  customerId: id,
  currency: currency.optional(),
  issueDate: isoDate.optional(),
  dueDate: isoDate.optional(),
  items: z.array(invoiceLineItem).min(1, "At least one line item is required"),
  notes: remarks.optional(),
});

export const updateInvoiceStatusSchema = z.object({
  status: invoiceStatus,
  reason: reason.optional(),
});

export const invoiceDecisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  // rejection requires a reason; enforced via refine below
  reason: z.string().trim().max(2000).optional(),
}).refine(
  (v) => v.decision !== "reject" || (v.reason && v.reason.length > 0),
  { message: "A rejection reason is required when rejecting", path: ["reason"] },
);

export const editInvoiceSchema = z.object({
  invoiceId: id,
  reason: reason, // edits to financial docs must be justified
  items: z.array(invoiceLineItem).min(1).optional(),
  notes: remarks.optional(),
});

export const markInvoicePaidSchema = z.object({
  invoiceId: id,
  amountPaid: moneyAmount,
  paidDate: isoDate.optional(),
  reference: z.string().trim().max(200).optional(),
});

// ===========================================================================
// Stage 3 — workflow invoice validators (product_posting_invoices state machine)
// ===========================================================================

/** A strictly positive money amount (zero / negative rejected). */
const positiveAmount = z.coerce
  .number({ invalid_type_error: "Amount must be a number" })
  .finite("Amount must be a finite number")
  .positive("Amount must be greater than zero")
  .refine(
    (n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-9,
    "Amount supports at most 2 decimals",
  );

/**
 * Create a workflow invoice. Enforces: positive amount, valid currency,
 * customer present, and a known service (serviceType OR projectName). Optional
 * source linkage and an override (admin/manager) to bypass duplicate blocking.
 */
export const workflowCreateInvoiceSchema = z
  .object({
    customerId: uuid,
    amount: positiveAmount,
    // Patch 5 Stage 4 (P7): the invoice type is a CLOSED enum, never free text.
    // It drives the canonical project name / service type used for dedup.
    invoiceType: invoiceTypeSchema,
    currency: currency.optional(),
    projectName: z.string().trim().max(300).optional(),
    serviceType: z.string().trim().max(200).optional(),
    servicePackage: z.string().trim().max(200).optional(),
    companyName: z.string().trim().max(300).optional(),
    gmId: z.string().trim().max(128).optional(),
    invoiceDate: isoDate.optional(),
    paymentTerms: z.string().trim().max(200).optional(),
    sourceModule: z.string().trim().max(100).optional(),
    sourceId: z.string().trim().max(128).optional(),
    notes: remarks.optional(),
    status: z.enum(["DRAFT", "PENDING_HOD"]).optional(),
    overrideDuplicate: z.boolean().optional(),
    overrideReason: z.string().trim().max(2000).optional(),
  })
  .refine((v) => !v.overrideDuplicate || (v.overrideReason && v.overrideReason.length > 0), {
    message: "An override reason is required to bypass the duplicate check",
    path: ["overrideReason"],
  });

/** Approve/reject decision for HOD or Account stages; reject requires a reason. */
export const workflowDecisionSchema = z
  .object({
    action: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase())
      .pipe(z.enum(["APPROVE", "REJECT"])),
    reason: z.string().trim().max(2000).optional(),
  })
  .refine((v) => v.action !== "REJECT" || (v.reason && v.reason.length > 0), {
    message: "A rejection reason is required when rejecting",
    path: ["reason"],
  });

/** Mark an APPROVED invoice as PAID. Method + reference required; amount reconciles. */
export const workflowMarkPaidSchema = z.object({
  paymentMethod: z.string().trim().min(1, "Payment method is required").max(100),
  receiptReference: z
    .string()
    .trim()
    .min(1, "A receipt / reference number is required")
    .max(200),
  paidAmount: positiveAmount,
  paidDate: isoDate.optional(),
  notes: remarks.optional(),
});

/** Cancel an in-flight invoice. Reason required. */
export const workflowCancelSchema = z.object({
  reason,
});

/**
 * Edit a workflow invoice. The set of fields actually allowed is enforced by
 * the service per current status/role; this only validates the shapes.
 */
export const workflowPatchSchema = z
  .object({
    amount: positiveAmount.optional(),
    currency: currency.optional(),
    projectName: z.string().trim().max(300).optional(),
    serviceType: z.string().trim().max(200).optional(),
    servicePackage: z.string().trim().max(200).optional(),
    companyName: z.string().trim().max(300).optional(),
    invoiceDate: isoDate.optional(),
    paymentTerms: z.string().trim().max(200).optional(),
    notes: remarks.optional(),
    reason: z.string().trim().max(2000).optional(),
  })
  .refine((v) => Object.keys(v).some((k) => k !== "reason" && (v as any)[k] !== undefined), {
    message: "At least one editable field must be provided",
  });

export type WorkflowCreateInvoice = z.infer<typeof workflowCreateInvoiceSchema>;
export type WorkflowDecision = z.infer<typeof workflowDecisionSchema>;
export type WorkflowMarkPaid = z.infer<typeof workflowMarkPaidSchema>;
export type WorkflowPatch = z.infer<typeof workflowPatchSchema>;

export type CreateInvoice = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceStatus = z.infer<typeof updateInvoiceStatusSchema>;

// ===========================================================================
// Patch 5 Stage 1 — GM/Sales foundation validators (pure; not wired to routes)
// ===========================================================================

export const manualInvoicePayloadSchema = z
  .object({
    invoiceType: invoiceTypeSchema,
    customerId: z.string().optional(),
    companyName: z.string().min(1).optional(),
    amount: z.coerce.number().nonnegative("amount must be 0 or greater"),
  })
  .passthrough();

export const invoiceApprovalReadinessSchema = z
  .object({
    status: z.string().min(1, "status is required"),
    hasLineItems: z.boolean().optional(),
  })
  .passthrough();

export const invoicePaymentReadinessSchema = z
  .object({
    status: z.string().min(1, "status is required"),
    amountDue: z.coerce.number().optional(),
  })
  .passthrough();

export type ManualInvoicePayload = z.infer<typeof manualInvoicePayloadSchema>;
