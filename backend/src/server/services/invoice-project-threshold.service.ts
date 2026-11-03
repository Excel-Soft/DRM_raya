import { pool } from "../db";
import {
  formatPkr,
  invoiceMinimumProjectPkr,
  meetsInvoiceProjectThreshold,
} from "@shared/invoice-project-threshold";
import { WORKFLOW_ENTITY_TYPES } from "@shared/gm-sales-constants";
import { NotificationService } from "./notification-service";
import {
  createOrLinkProjectForApprovedInvoice,
  createOrLinkProjectForLegacySource,
} from "../routes/services/invoice-to-project.service";
export type InvoiceThresholdFinancials = {
  invoiceId: string;
  source: "standard_invoice" | "product_posting" | "quotation" | "unknown";
  totalPkr: number;
  paidPkr: number;
  minPkr: number;
  ownerUserId: string | null;
  companyLabel: string;
  invoiceLabel: string;
};

function ledgerPaymentToPkr(amount: number, currency: string | null | undefined, rate: number): number {
  const amt = Number(amount) || 0;
  if (!currency || currency === "PKR") return amt;
  if (currency === "USD") return amt * rate;
  return amt;
}

export async function sumInvoicePaidPkr(invoiceId: string, dollarRate = 280): Promise<number> {
  const rate = Number(dollarRate) || 280;
  const { rows } = await pool.query(
    `SELECT amount, currency FROM drm.ledger_entries
       WHERE reference_id = $1 AND reference_type = 'Invoice'
         AND category = 'Invoice Payment' AND entry_type = 'Credit'`,
    [invoiceId],
  );
  return rows.reduce((sum, row) => sum + ledgerPaymentToPkr(row.amount, row.currency, rate), 0);
}

async function loadStandardInvoiceFinancials(invoiceId: string): Promise<InvoiceThresholdFinancials | null> {
  const { rows } = await pool.query(
    `SELECT i.id, i.total, i.currency, i.dollar_rate AS "dollarRate", i.customer_name AS company,
            i.created_by_user_id AS "ownerUserId", i.invoice_number AS "invoiceNumber", i.notes,
            qi.pkr_total AS "pkrTotal"
       FROM drm.invoices i
       LEFT JOIN drm.quotations qi ON qi.id = i.quotation_id
      WHERE i.id = $1 LIMIT 1`,
    [invoiceId],
  );
  const row = rows[0];
  if (!row) return null;
  const rate = Number(row.dollarRate) || 280;
  let totalPkr = 0;
  if (row.pkrTotal != null && row.pkrTotal !== "") {
    totalPkr = Math.max(0, Math.round(Number(row.pkrTotal)));
  } else if (String(row.currency || "").toUpperCase() === "PKR") {
    totalPkr = Math.max(0, Math.round(Number(row.total || 0)));
  } else {
    totalPkr = Math.max(0, Math.round(Number(row.total || 0) * rate));
  }
  const paidPkr = await sumInvoicePaidPkr(invoiceId, rate);
  return {
    invoiceId,
    source: "standard_invoice",
    totalPkr,
    paidPkr,
    minPkr: invoiceMinimumProjectPkr(totalPkr),
    ownerUserId: row.ownerUserId || null,
    companyLabel: row.company || "your company",
    invoiceLabel: row.invoiceNumber || "Invoice",
  };
}

async function loadProductPostingFinancials(invoiceId: string): Promise<InvoiceThresholdFinancials | null> {
  const { rows } = await pool.query(
    `SELECT id, amount, company_name AS company, sales_exec_id AS "ownerUserId",
            project_name, invoice_number AS "invoiceNumber"
       FROM drm.product_posting_invoices WHERE id = $1 LIMIT 1`,
    [invoiceId],
  );
  const row = rows[0];
  if (!row) return null;
  const totalPkr = Math.max(0, Math.round(Number(row.amount || 0)));
  const paidPkr = await sumInvoicePaidPkr(invoiceId, 280);
  return {
    invoiceId,
    source: "product_posting",
    totalPkr,
    paidPkr,
    minPkr: invoiceMinimumProjectPkr(totalPkr),
    ownerUserId: row.ownerUserId || null,
    companyLabel: row.company || "your company",
    invoiceLabel: row.project_name || row.invoiceNumber || "Product Posting Invoice",
  };
}

async function loadQuotationFinancials(invoiceId: string): Promise<InvoiceThresholdFinancials | null> {
  const { rows } = await pool.query(
    `SELECT id, grand_total AS "grandTotal", dollar_rate AS "dollarRate", pkr_total AS "pkrTotal",
            company, created_by AS "ownerUserId"
       FROM drm.quotations WHERE id = $1 LIMIT 1`,
    [invoiceId],
  );
  const row = rows[0];
  if (!row) return null;
  const rate = Number(row.dollarRate) || 280;
  let totalPkr = 0;
  if (row.pkrTotal != null && row.pkrTotal !== "") {
    totalPkr = Math.max(0, Math.round(Number(row.pkrTotal)));
  } else {
    totalPkr = Math.max(0, Math.round(Number(row.grandTotal || 0) * rate));
  }
  const paidPkr = await sumInvoicePaidPkr(invoiceId, rate);
  return {
    invoiceId,
    source: "quotation",
    totalPkr,
    paidPkr,
    minPkr: invoiceMinimumProjectPkr(totalPkr),
    ownerUserId: row.ownerUserId || null,
    companyLabel: row.company || "your company",
    invoiceLabel: "Quotation",
  };
}

export async function loadInvoiceThresholdFinancials(
  invoiceId: string,
  sourceHint?: "standard_invoice" | "product_posting" | "quotation",
): Promise<InvoiceThresholdFinancials | null> {
  if (sourceHint === "product_posting") return loadProductPostingFinancials(invoiceId);
  if (sourceHint === "quotation") return loadQuotationFinancials(invoiceId);
  if (sourceHint === "standard_invoice") return loadStandardInvoiceFinancials(invoiceId);

  return (
    (await loadStandardInvoiceFinancials(invoiceId)) ||
    (await loadProductPostingFinancials(invoiceId)) ||
    (await loadQuotationFinancials(invoiceId))
  );
}

export async function notifySalesBelowProjectThreshold(fin: InvoiceThresholdFinancials): Promise<void> {
  if (!fin.ownerUserId) return;
  const message =
    `Payment recorded for '${fin.invoiceLabel}' (${fin.companyLabel}) is below 33% of the invoice total ` +
    `(${formatPkr(fin.paidPkr)} received; minimum ${formatPkr(fin.minPkr)} of ${formatPkr(fin.totalPkr)}). ` +
    `The PMS project will be created automatically once at least 33% is received.`;
  await NotificationService.createNotification({
    userId: fin.ownerUserId,
    message,
    type: "WARNING",
    targetUrl: "/pms/approvals",
    module: "invoice-workflow",
    entityType: WORKFLOW_ENTITY_TYPES.INVOICE,
    entityId: String(fin.invoiceId),
  });
}

export async function notifySalesProjectCreatedFromPayment(fin: InvoiceThresholdFinancials): Promise<void> {
  if (!fin.ownerUserId) return;
  const message =
    `Project created for '${fin.invoiceLabel}' (${fin.companyLabel}) — received ${formatPkr(fin.paidPkr)} ` +
    `(≥ 33% of ${formatPkr(fin.totalPkr)}). Please upload the required documents in the PMS module to proceed.`;
  await NotificationService.createNotification({
    userId: fin.ownerUserId,
    message,
    type: "SUCCESS",
    targetUrl: "/pms/approvals",
    module: "invoice-workflow",
    entityType: WORKFLOW_ENTITY_TYPES.INVOICE,
    entityId: String(fin.invoiceId),
  });
}

export async function tryAutoCreateProjectAfterPayment(params: {
  invoiceId: string;
  actorUserId: string;
  req?: any;
}): Promise<{ projectCreated: boolean; thresholdMet: boolean; financials: InvoiceThresholdFinancials | null }> {
  const fin = await loadStandardInvoiceFinancials(params.invoiceId);
  if (!fin) {
    return { projectCreated: false, thresholdMet: false, financials: null };
  }
  const thresholdMet = meetsInvoiceProjectThreshold(fin.paidPkr, fin.totalPkr);
  if (!thresholdMet) {
    await notifySalesBelowProjectThreshold(fin);
    return { projectCreated: false, thresholdMet: false, financials: fin };
  }

  const existing = await pool.query(
    `SELECT id FROM drm.projects WHERE invoice_id = $1 AND COALESCE(is_deleted, false) = false LIMIT 1`,
    [params.invoiceId],
  );
  if (existing.rows[0]) {
    return { projectCreated: false, thresholdMet: true, financials: fin };
  }

  const invRow = await pool.query(
    `SELECT customer_id AS "customerId", created_by_user_id AS "ownerUserId", customer_name AS company
       FROM drm.invoices WHERE id = $1`,
    [params.invoiceId],
  );
  const inv = invRow.rows[0];
  const genResult = await createOrLinkProjectForLegacySource({
    sourceId: params.invoiceId,
    customerId: inv?.customerId,
    ownerUserId: inv?.ownerUserId || params.actorUserId,
    name: `Proj-${String(inv?.company || "Invoice").replace(/\s+/g, "-").substring(0, 15)}`,
    description: `Auto-created after payment reached 33% threshold for invoice ${params.invoiceId}`,
    actorUserId: params.actorUserId,
    req: params.req,
  });

  if (genResult.ok && genResult.created) {
    await notifySalesProjectCreatedFromPayment(fin);
    return { projectCreated: true, thresholdMet: true, financials: fin };
  }
  return { projectCreated: false, thresholdMet: true, financials: fin };
}

export async function shouldRunProjectGenerationForApproval(
  invoiceId: string,
  source: "standard_invoice" | "product_posting" | "quotation",
): Promise<{ allowed: boolean; financials: InvoiceThresholdFinancials | null; existingProject: boolean }> {
  const fin = await loadInvoiceThresholdFinancials(invoiceId, source);
  if (!fin) return { allowed: true, financials: null, existingProject: false };

  const existing = await pool.query(
    `SELECT id FROM drm.projects WHERE invoice_id = $1 AND COALESCE(is_deleted, false) = false LIMIT 1`,
    [invoiceId],
  );
  const existingProject = !!existing.rows[0];
  if (existingProject) return { allowed: true, financials: fin, existingProject: true };

  const allowed = meetsInvoiceProjectThreshold(fin.paidPkr, fin.totalPkr);
  return { allowed, financials: fin, existingProject: false };
}

export async function recordInvoiceApprovalPayment(params: {
  invoiceId: string;
  amount: number | undefined | null;
  paymentMethod?: string | null;
  actorUserId: string;
  invoiceNumber?: string | null;
}): Promise<void> {
  const nativeAmount = Number(params.amount);
  if (!Number.isFinite(nativeAmount) || nativeAmount <= 0) return;
  await pool.query(
    `INSERT INTO drm.ledger_entries
       (entry_type, amount, currency, description, category, reference_id, reference_type, entry_date, created_by_user_id, status, remarks)
     VALUES ('Credit', $1, 'PKR', $2, 'Invoice Payment', $3, 'Invoice', now(), $4, 'Posted', $5)`,
    [
      nativeAmount,
      `Payment recorded on approval of invoice ${params.invoiceNumber || params.invoiceId}`,
      params.invoiceId,
      params.actorUserId,
      params.paymentMethod || null,
    ],
  );
}

export { meetsInvoiceProjectThreshold, invoiceMinimumProjectPkr };
