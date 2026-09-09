/**
 * Patch 5 — GM payload validators (Zod). Pure schemas only; not wired into any
 * existing route in Stage 1.
 */
import { z } from "zod";
import { gmTypeSchema } from "../../shared/gm-sales-constants";

export const gmCreatePayloadSchema = z
  .object({
    gmType: gmTypeSchema,
    companyName: z.string().min(1, "companyName is required"),
    packageType: z.string().min(1).optional(),
    entryType: z.string().min(1).optional(),
    amountUsd: z.coerce.number().positive("amountUsd must be greater than 0").optional(),
    salesPersonId: z.string().optional(),
  })
  .passthrough();

export const partialReceiptPayloadSchema = z
  .object({
    amount: z.coerce.number().positive("amount must be greater than 0"),
    currency: z.string().optional(),
    receiptDate: z.string().optional(),
    proofUrl: z.string().optional(),
  })
  .passthrough();

export const loanGmTermsSchema = z
  .object({
    loanAmount: z.coerce.number().positive("loanAmount must be greater than 0"),
    expectedReturnDate: z.string().min(1, "expectedReturnDate is required"),
    terms: z.string().optional(),
  })
  .passthrough();

export type GmCreatePayload = z.infer<typeof gmCreatePayloadSchema>;
export type PartialReceiptPayload = z.infer<typeof partialReceiptPayloadSchema>;
export type LoanGmTerms = z.infer<typeof loanGmTermsSchema>;
