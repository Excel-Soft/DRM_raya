import { z } from "zod";
import {
  id,
  isoDate,
  moneyAmount,
  signedMoneyAmount,
  currency,
  reason,
  remarks,
  dateRange,
  statusEnum,
} from "./common.validators";

/**
 * Financial / accounts validators: ledger entries, GM/BV pool actions, refunds,
 * and report exports. Edits and deletes of financial records require a reason.
 */

export const ledgerEntryType = statusEnum(["Credit", "Debit"] as const);

export const ledgerEntrySchema = z.object({
  customerId: id.optional(),
  entryType: ledgerEntryType,
  amount: moneyAmount,
  currency: currency.optional(),
  date: isoDate.optional(),
  description: remarks.optional(),
});

export const financialUpdateSchema = z.object({
  entityId: id,
  amount: signedMoneyAmount.optional(),
  reason: reason, // any financial mutation must be justified
  description: remarks.optional(),
});

export const financialDeleteSchema = z.object({
  entityId: id,
  reason: reason,
});

export const refundSchema = z.object({
  entityId: id,
  amount: moneyAmount,
  reason: reason,
});

export const exportRequestSchema = z.object({
  range: dateRange.optional(),
  format: z.enum(["csv", "xlsx", "pdf"]).default("csv"),
});

export type LedgerEntry = z.infer<typeof ledgerEntrySchema>;
export type FinancialUpdate = z.infer<typeof financialUpdateSchema>;
