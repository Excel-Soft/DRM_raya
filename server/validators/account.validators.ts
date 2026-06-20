import { z } from "zod";
import {
  uuid,
  id,
  moneyAmount,
  signedMoneyAmount,
  currency,
  isoDate,
  remarks,
  reason,
} from "./common.validators";

/**
 * Foundational, reusable validators for the Accounts module (invoice ledger,
 * receipts, manual entries). These are building blocks composed from
 * `common.validators`; wire them per-route as account endpoints are hardened.
 * Status is kept as a bounded free string here — tighten to a per-route enum at
 * the call site so each route stays explicit about the statuses it accepts.
 */

export const accountStatusUpdateSchema = z.object({
  entityId: id,
  status: z.string().trim().min(1, "Status is required").max(40),
  reason: reason.optional(),
});

export const ledgerEntryCreateSchema = z.object({
  accountId: uuid.optional(),
  customerId: uuid.optional(),
  invoiceId: id.optional(),
  description: remarks.optional(),
  debit: moneyAmount.optional(),
  credit: moneyAmount.optional(),
  amount: signedMoneyAmount.optional(),
  currency: currency.optional(),
  entryDate: isoDate.optional(),
});

export const receiptCreateSchema = z.object({
  invoiceId: id.optional(),
  customerId: uuid.optional(),
  amount: moneyAmount,
  currency: currency.optional(),
  method: z.string().trim().max(40).optional(),
  reference: z.string().trim().max(128).optional(),
  receivedAt: isoDate.optional(),
  remarks: remarks.optional(),
});

export type AccountStatusUpdate = z.infer<typeof accountStatusUpdateSchema>;
export type LedgerEntryCreate = z.infer<typeof ledgerEntryCreateSchema>;
export type ReceiptCreate = z.infer<typeof receiptCreateSchema>;
