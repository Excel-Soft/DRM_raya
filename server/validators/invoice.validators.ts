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

export type CreateInvoice = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceStatus = z.infer<typeof updateInvoiceStatusSchema>;
