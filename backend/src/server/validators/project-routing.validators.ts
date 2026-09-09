/**
 * Patch 5 — project-routing validators (Zod). Pure schemas only; not wired into
 * any existing route in Stage 1.
 */
import { z } from "zod";
import { invoiceTypeSchema, projectInitialStatusSchema } from "../../shared/gm-sales-constants";

export const invoiceToProjectPayloadSchema = z
  .object({
    invoiceId: z.string().min(1, "invoiceId is required"),
    invoiceStatus: z.string().min(1, "invoiceStatus is required"),
    initialStatus: projectInitialStatusSchema.optional(),
  })
  .passthrough();

export const productPostingDependencySchema = z
  .object({
    invoiceType: invoiceTypeSchema.optional(),
    listingQaComplete: z.boolean().optional(),
    requireWaitForListingQa: z.boolean().optional(),
  })
  .passthrough();

export type InvoiceToProjectPayload = z.infer<typeof invoiceToProjectPayloadSchema>;
export type ProductPostingDependency = z.infer<typeof productPostingDependencySchema>;
