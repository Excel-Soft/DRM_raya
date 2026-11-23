import { Router } from "express";
import { db, pool } from "../db";
import { ledgerEntries, invoices, customers, users } from "../../shared/schema";
import { eq, desc, sql, and, ilike, or, gte, lte, inArray } from "drizzle-orm";
import { requireFinancialPermission, FINANCIAL_ACTIONS, FINANCIAL_VIEW_ROLES, FINANCIAL_VOID_ROLES } from "./middleware/financial-permission";
import { tryAutoCreateProjectAfterPayment } from "../services/invoice-project-threshold.service";

export const companyLedgerRouter = Router();

// Shared SQL for the Company Ledger (old drm "Invoices List", allCompinesLedgers()).
// Invoices copied from the old DRM (mapping rows) hold PKR amounts although they were
// stored with currency 'USD'; they are reported as PKR. Their Pay = old webxl_invoice.pay
// + payments saved later from Make Invoice. App invoices: Invoice Payment ledger credits
// (converted to the invoice currency), else the full total once status is Paid.
const LEDGER_NUM = (col: string) =>
  `coalesce(nullif(regexp_replace(coalesce(${col}, ''), '[^0-9.]', '', 'g'), '')::numeric, 0)`;
const LEDGER_INVOICES_CTE = `
  inv AS (
    SELECT i.id, i.customer_id, i.customer_name, i.subtotal, i.total, i.currency, i.dollar_rate,
           i.status::text AS status, i.created_at, i.created_by_user_id, m.legacy_id,
           CASE WHEN m.legacy_id IS NOT NULL THEN 'PKR' ELSE i.currency END AS cur
      FROM drm.invoices i
      LEFT JOIN migration_meta.migration_legacy_ids m
             ON m.modern_table = 'invoices' AND m.modern_id = i.id AND m.entity_type = 'invoice'
  ),
  inv_pay AS (
    SELECT inv.*,
      CASE WHEN inv.legacy_id IS NOT NULL THEN
             ${LEDGER_NUM("l.pay")} + coalesce((
               SELECT sum(x.amount) FROM drm.legacy_invoice_item_payments x
                WHERE x.legacy_invoice_id = inv.legacy_id
                  AND NOT EXISTS (SELECT 1 FROM migration_meta.migration_legacy_ids mm
                                   WHERE mm.modern_table = 'legacy_invoice_item_payments' AND mm.modern_id = x.id::text)), 0)
             -- + payments recorded later from the ledger's Make Payment (stored in PKR)
             + coalesce((SELECT sum(p.amount) FROM drm.ledger_entries p
                          WHERE p.reference_id = inv.id AND p.category = 'Invoice Payment' AND p.entry_type = 'Credit'), 0)
           ELSE coalesce(nullif((
               SELECT sum(CASE WHEN p.currency IS NULL OR p.currency = inv.currency THEN p.amount
                               WHEN inv.currency = 'USD' AND p.currency = 'PKR' THEN p.amount / coalesce(nullif(inv.dollar_rate, 0), 280)
                               WHEN inv.currency = 'PKR' AND p.currency = 'USD' THEN p.amount * coalesce(nullif(inv.dollar_rate, 0), 280)
                               ELSE p.amount END)
                 FROM drm.ledger_entries p
                WHERE p.reference_id = inv.id AND p.category = 'Invoice Payment' AND p.entry_type = 'Credit'), 0),
             CASE WHEN inv.status = 'Paid' THEN inv.total ELSE 0 END)
      END AS pay
      FROM inv
      LEFT JOIN legacy_archive.webxl_invoice l ON l._source_table = 'webxl_invoice' AND l._legacy_pk = inv.legacy_id
  )`;

// GET /api/reports/ledger (Company Ledger Summary)
// One row per company: sum of its invoices' sub total / discount / grand total / pay,
// Due = grand total - pay, Date = latest invoice, sale person = latest invoice's creator.
companyLedgerRouter.get("/api/reports/ledger", requireFinancialPermission(FINANCIAL_ACTIONS.accountLedgerView, { roles: FINANCIAL_VIEW_ROLES }), async (req, res) => {
  try {
    const { company, contact, ntn, from } = req.query as Record<string, string | undefined>;
    const pageNum = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.pageSize ?? "15"), 10) || 15));
    const offset = (pageNum - 1) * limit;

    const params: any[] = [];
    const where: string[] = ["coalesce(btrim(ip.customer_name), '') <> ''"];
    if (company && company.trim()) {
      params.push(`%${company.trim()}%`);
      where.push(`(ip.customer_name ILIKE $${params.length} OR c.company_name ILIKE $${params.length})`);
    }
    if (contact && contact.trim()) {
      params.push(`%${contact.trim().replace(/\s+/g, "")}%`);
      where.push(`(replace(coalesce(c.phone, ''), ' ', '') ILIKE $${params.length}
                   OR replace(coalesce(c.mobile, ''), ' ', '') ILIKE $${params.length}
                   OR coalesce(c.phone_normalized, '') ILIKE $${params.length})`);
    }
    if (ntn && ntn.trim()) {
      params.push(`%${ntn.trim()}%`);
      where.push(`(c.ntn ILIKE $${params.length} OR c.cnic ILIKE $${params.length})`);
    }
    if (from && /^\d{4}-\d{2}-\d{2}$/.test(String(from))) {
      params.push(from);
      where.push(`ip.created_at >= $${params.length}::date`);
    }

    const sqlText = `
      WITH ${LEDGER_INVOICES_CTE},
      grp AS (
        SELECT coalesce(ip.customer_id::text, 'name:' || lower(btrim(ip.customer_name))) AS gkey,
               (array_agg(ip.customer_name ORDER BY ip.created_at DESC))[1] AS company_name,
               (array_agg(ip.id ORDER BY ip.created_at DESC))[1] AS last_invoice_id,
               (array_agg(ip.created_by_user_id ORDER BY ip.created_at DESC))[1] AS last_user_id,
               max(ip.customer_id::text) AS customer_id,
               sum(ip.subtotal) AS sub_total,
               sum(greatest(ip.subtotal - ip.total, 0)) AS discount,
               sum(ip.total) AS grand_total,
               sum(ip.pay) AS pay,
               max(ip.created_at) AS last_date,
               count(*)::int AS invoice_count
          FROM inv_pay ip
          LEFT JOIN drm.customers c ON c.id = ip.customer_id
         WHERE ${where.join(" AND ")}
         GROUP BY 1
      )
      SELECT g.*, g.grand_total - g.pay AS due,
             coalesce(c.account_name, c.person_name) AS account_name,
             coalesce(u.full_name, u.username) AS sale_person,
             count(*) OVER ()::int AS total_rows,
             sum(g.grand_total) OVER () AS all_grand_total,
             sum(g.pay) OVER () AS all_pay,
             sum(g.grand_total - g.pay) OVER () AS all_due
        FROM grp g
        LEFT JOIN drm.customers c ON c.id::text = g.customer_id
        LEFT JOIN drm.users u ON u.id = g.last_user_id
       ORDER BY g.last_date DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const { rows } = await pool.query(sqlText, [...params, limit, offset]);

    let totalRows = rows[0]?.total_rows ?? 0;
    let summaryRow = rows[0];
    if (!rows.length && offset > 0) {
      // Page past the end: still report totals.
      const r2 = await pool.query(sqlText, [...params, 1, 0]);
      totalRows = r2.rows[0]?.total_rows ?? 0;
      summaryRow = r2.rows[0];
    }

    const results = rows.map((r: any) => ({
      id: r.gkey,
      entryType: "Credit" as const,
      amount: String(r.sub_total ?? 0),
      currency: "PKR",
      description: r.company_name,
      category: "Company",
      referenceId: r.last_invoice_id,
      referenceType: "Invoice",
      balanceAfter: "0",
      entryDate: new Date(r.last_date).toISOString(),
      createdAt: new Date(r.last_date).toISOString(),
      accountName: r.account_name || null,
      salePerson: r.sale_person || null,
      subTotal: String(r.sub_total ?? 0),
      discount: String(r.discount ?? 0),
      grandTotal: String(r.grand_total ?? 0),
      pay: String(r.pay ?? 0),
      due: String(r.due ?? 0),
      invoiceCount: r.invoice_count,
    }));

    res.json({
      data: results,
      total: totalRows,
      page: pageNum,
      pageSize: limit,
      summary: {
        totalGM: Number(summaryRow?.all_pay ?? 0),
        totalRefund: 0,
        totalInvoice: Number(summaryRow?.all_grand_total ?? 0),
        totalDonation: 0,
        outstandingDues: Number(summaryRow?.all_due ?? 0),
      },
    });
  } catch (err) {
    console.error("Error fetching company ledger report:", err);
    res.status(500).json({ error: "Failed to fetch company ledger report" });
  }
});

// GET /api/account/history/:companyId  (company name; old: account-history=<com_id>)
// Invoices of the company + their receipts (Invoice Payment credits, and the old-DRM
// payments copied into the ledger as category 'Invoice').
companyLedgerRouter.get("/api/account/history/:companyId", requireFinancialPermission(FINANCIAL_ACTIONS.accountLedgerView, { roles: FINANCIAL_VIEW_ROLES }), async (req, res) => {
  try {
    const companyName = String(req.params.companyId || "").trim();

    // Explicit columns: drm.invoices has no quotation_id although the drizzle schema does.
    const invRes = await pool.query(
      `SELECT i.id, i.invoice_number AS "invoiceNumber", i.customer_id AS "customerId",
              i.customer_name AS "customerName", i.customer_email AS "customerEmail",
              i.customer_address AS "customerAddress", i.subtotal, i.tax, i.total,
              CASE WHEN m.legacy_id IS NOT NULL THEN 'PKR' ELSE i.currency END AS currency,
              i.status, i.issue_date AS "issueDate", i.due_date AS "dueDate", i.paid_at AS "paidAt",
              i.notes, i.items, i.created_by_user_id AS "createdByUserId", i.created_at AS "createdAt",
              i.updated_at AS "updatedAt", i.payment_method AS "paymentMethod", i.dollar_rate AS "dollarRate",
              m.legacy_id AS "legacyInvoiceId",
              coalesce(u.full_name, u.username, '-') AS "createdByName"
         FROM drm.invoices i
         LEFT JOIN migration_meta.migration_legacy_ids m
                ON m.modern_table = 'invoices' AND m.modern_id = i.id AND m.entity_type = 'invoice'
         LEFT JOIN drm.users u ON u.id = i.created_by_user_id
        WHERE lower(btrim(i.customer_name)) = lower($1)
        ORDER BY i.created_at DESC`,
      [companyName],
    );
    const companyInvoices = invRes.rows;
    const invoiceIds = companyInvoices.map((i: any) => i.id);
    const legacyIds = new Set(companyInvoices.filter((i: any) => i.legacyInvoiceId).map((i: any) => i.id));

    let payments: any[] = [];
    if (invoiceIds.length > 0) {
      const payRes = await pool.query(
        `SELECT id, entry_type AS "entryType", amount, currency, description, category, date,
                reference_id AS "referenceId", reference_type AS "referenceType", entry_date AS "entryDate",
                remarks, created_at AS "createdAt", status
           FROM drm.ledger_entries
          WHERE reference_id = ANY($1::text[]) AND entry_type = 'Credit'
            AND category IN ('Invoice Payment', 'Invoice')
          ORDER BY entry_date`,
        [invoiceIds],
      );
      payments = payRes.rows.map((p: any) => {
        // Receipt screenshot is stored in the description by POST /api/account/payment;
        // fall back to the invoice's own notes.receiptImage (approval flow).
        const match = typeof p.description === "string" ? p.description.match(/\s*\[receipt:(.+?)\]/) : null;
        let receiptImage = match ? match[1] : null;
        const description = match ? p.description.replace(match[0], "") : p.description;
        if (!receiptImage) {
          const relatedInvoice = companyInvoices.find((inv: any) => inv.id === p.referenceId);
          try {
            const parsedNotes = relatedInvoice?.notes ? JSON.parse(relatedInvoice.notes) : null;
            receiptImage = parsedNotes?.receiptImage || null;
          } catch {
            // notes wasn't JSON
          }
        }
        // Old-DRM payments: PKR amounts, method in "(...)", receipt number in the text.
        const legacy = legacyIds.has(p.referenceId);
        const method = typeof description === "string" ? description.match(/\(([^()]*)\)\s*$/)?.[1] : null;
        const recNo = typeof description === "string" ? description.match(/receipt (\S+)/)?.[1] : null;
        return {
          ...p,
          currency: legacy ? "PKR" : p.currency,
          description,
          receiptImage,
          receiptNumber: recNo && recNo !== "0" ? recNo : null,
          remarks: legacy ? (method || p.remarks) : p.remarks,
        };
      });
    }

    const custRes = await pool.query(
      `SELECT phone, ntn FROM drm.customers WHERE lower(btrim(company_name)) = lower($1) LIMIT 1`,
      [companyName],
    );

    // Invoices marked Paid by the Account Manager's approve action never got a ledger row:
    // show a synthetic receipt for them so Due and the receipts list agree.
    const paidInvoiceIds = new Set(payments.map((p: any) => p.referenceId));
    const syntheticReceipts = companyInvoices
      .filter((inv: any) => inv.status === "Paid" && !paidInvoiceIds.has(inv.id) && !inv.legacyInvoiceId)
      .map((inv: any) => {
        let receiptNumber: string | null = null;
        let receiptImage: string | null = null;
        try {
          const parsedNotes = inv.notes ? JSON.parse(inv.notes) : null;
          receiptNumber = parsedNotes?.receiptNumber || null;
          receiptImage = parsedNotes?.receiptImage || null;
        } catch {
          // notes wasn't JSON
        }
        return {
          id: receiptNumber || inv.id,
          amount: inv.total,
          currency: inv.currency,
          entryDate: inv.updatedAt,
          referenceId: inv.id,
          referenceType: "Invoice",
          description: `Invoice ${inv.invoiceNumber} marked Paid on approval`,
          receiptImage,
          remarks: inv.paymentMethod || null,
        };
      });

    res.json({
      success: true,
      data: {
        invoices: companyInvoices,
        receipts: [...payments, ...syntheticReceipts],
        customer: custRes.rows[0] ? { phone: custRes.rows[0].phone, ntn: custRes.rows[0].ntn } : null,
      },
    });
  } catch (err) {
    console.error("Error fetching account history:", err);
    res.status(500).json({ error: "Failed to fetch account history" });
  }
});

// POST /api/account/payment (Make Payment)
companyLedgerRouter.post("/api/account/payment", requireFinancialPermission(FINANCIAL_ACTIONS.accountLedgerCreate), async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const { invoiceId, amount, paymentMethod, notes, entryDate, receiptImage } = req.body;

    if (!invoiceId || !amount) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Explicit columns (drm.invoices has no quotation_id although the drizzle schema does).
    const invRes = await pool.query(
      `SELECT id, invoice_number AS "invoiceNumber" FROM drm.invoices WHERE id = $1`,
      [invoiceId],
    );
    const inv = invRes.rows[0] as { id: string; invoiceNumber: string } | undefined;

    if (!inv) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    // There's no dedicated column for an optional receipt screenshot on this
    // table, so (like the invoice-approval flow's notes.receiptImage) it's
    // tucked into the free-text description with a parseable marker and
    // extracted back out by the GET /api/account/history/:companyId reader.
    const description = `Payment for invoice ${inv.invoiceNumber}${notes ? ` - ${notes}` : ''}${receiptImage ? ` [receipt:${receiptImage}]` : ''}`;

    // `amount` is entered in PKR in both Make Payment modals (same convention
    // as the approval flow) — store it as PKR exactly as entered rather than
    // converting to the invoice's own currency up front, which would round
    // a figure like 30,000 down to 2 decimal places of USD and lose it on
    // the way back (see D-019). Readers convert at calculation time instead.
    const newEntry = await db.insert(ledgerEntries).values({
      entryType: "Credit",
      amount: amount.toString(),
      currency: "PKR",
      description,
      category: "Invoice Payment",
      referenceId: invoiceId,
      referenceType: "Invoice",
      entryDate: entryDate || new Date().toISOString().split("T")[0],
      createdByUserId: req.user.userId,
      status: "Posted",
      remarks: paymentMethod || null
    }).returning();

    let projectCreated = false;
    let thresholdMet = false;
    let thresholdMeta: { paidPkr?: number; minPkr?: number; totalPkr?: number } = {};
    try {
      const auto = await tryAutoCreateProjectAfterPayment({
        invoiceId,
        actorUserId: req.user.userId,
        req,
      });
      projectCreated = auto.projectCreated;
      thresholdMet = auto.thresholdMet;
      if (auto.financials) {
        thresholdMeta = {
          paidPkr: auto.financials.paidPkr,
          minPkr: auto.financials.minPkr,
          totalPkr: auto.financials.totalPkr,
        };
      }
    } catch (autoErr) {
      console.error("[account/payment] project auto-create check failed (non-fatal):", autoErr);
    }

    res.json({
      success: true,
      message: "Payment recorded successfully",
      data: newEntry[0],
      projectCreated,
      thresholdMet,
      ...thresholdMeta,
    });
  } catch (err) {
    console.error("Error creating payment:", err);
    res.status(500).json({ error: "Failed to create payment" });
  }
});
