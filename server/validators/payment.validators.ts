/**
 * Patch 5 — payment validators (Zod). Pure schemas only; not wired into any
 * existing route in Stage 1.
 */
import { z } from "zod";
import { minimumPaymentThresholdsSchema } from "../../shared/gm-sales-constants";

export const minimumPaymentThresholdCheckSchema = z.object({
  gmType: z.string().min(1, "gmType is required"),
  packageType: z.string().min(1, "packageType is required"),
  amount: z.coerce.number().nonnegative("amount must be 0 or greater"),
  thresholds: minimumPaymentThresholdsSchema.optional(),
});

export const partialReceiptAmountSchema = z.object({
  amount: z.coerce.number().positive("amount must be greater than 0"),
  totalExpected: z.coerce.number().positive().optional(),
  alreadyPaid: z.coerce.number().nonnegative().optional(),
});

export type MinimumPaymentThresholdCheck = z.infer<typeof minimumPaymentThresholdCheckSchema>;
