import { z } from "zod";
import { id, moneyAmount, currency, isoDate, remarks } from "./common.validators";

/**
 * Foundational, reusable validators for the Office Accounts module (office
 * expenses, vendor / utility payments). Building blocks composed from
 * `common.validators`; wire per-route as office-account endpoints are hardened.
 */

export const officeExpenseCreateSchema = z.object({
  category: z.string().trim().min(1, "Category is required").max(80),
  description: remarks.optional(),
  amount: moneyAmount,
  currency: currency.optional(),
  paidTo: z.string().trim().max(160).optional(),
  paymentMethod: z.string().trim().max(40).optional(),
  expenseDate: isoDate.optional(),
  status: z.string().trim().max(40).optional(),
});

export const officeAccountStatusSchema = z.object({
  entityId: id,
  status: z.string().trim().min(1, "Status is required").max(40),
  remarks: remarks.optional(),
});

export type OfficeExpenseCreate = z.infer<typeof officeExpenseCreateSchema>;
export type OfficeAccountStatus = z.infer<typeof officeAccountStatusSchema>;
