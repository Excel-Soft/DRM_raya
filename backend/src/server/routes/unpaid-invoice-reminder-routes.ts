// Unpaid-invoice reminder (old DRM popup "Your payment is overdue … Hod: <status> Account: Not Pay").
//
//   GET /api/me/unpaid-invoices   the logged-in user's own invoices that accounts has not received
//                                 payment for yet (read-only)
//
// Old invoices (legacy_archive.webxl_invoice, user_id = the user's old id): unpaid = the same rule as
// the Make Invoice page — no webxl_payments row and no payment saved from the new Make Invoice page.
// HOD status = webxl_invoice.hod (Approved / Cancel / Pending / ''). New-app invoices (drm.invoices
// created by the user, not copied from old DRM): status not Paid and no posted invoice payment.
import type { Express, Request, Response } from "express";
import { pool } from "../db";

const LIMIT = 10;

export function registerUnpaidInvoiceReminderRoutes(app: Express) {
  app.get("/api/me/unpaid-invoices", async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.userId ?? (req.user as any)?.id;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const { rows } = await pool.query(
        `WITH me AS (
           SELECT legacy_id FROM migration_meta.migration_legacy_ids
            WHERE entity_type = 'user' AND legacy_table = 'webxl_user' AND modern_id = $1::text
         ),
         legacy AS (
           SELECT 'L' || i.invoice_id AS key, i.invoice_id AS "invoiceId",
                  coalesce(nullif(btrim(c.cname), ''), nullif(btrim(i.cname), ''), '-') AS company,
                  coalesce(nullif(btrim(i.grand_total), ''), '0') AS amount,
                  migration_meta.mig_ts(i.create_date) AS "createdAt",
                  coalesce(nullif(btrim(i.hod), ''), 'Pending') AS hod
             FROM legacy_archive.webxl_invoice i
             JOIN me ON me.legacy_id = btrim(i.user_id)
             LEFT JOIN legacy_archive.webxl_company c ON c._source_table = 'webxl_company' AND c._legacy_pk = i.com_id
            WHERE i._source_table = 'webxl_invoice'
              AND NOT EXISTS (SELECT 1 FROM legacy_archive.webxl_payments p
                               WHERE p._source_table = 'webxl_payments' AND p.invoice_id = i.invoice_id)
              AND NOT EXISTS (SELECT 1 FROM drm.legacy_invoice_item_payments x
                               WHERE x.legacy_invoice_id = i.invoice_id
                                 AND NOT EXISTS (SELECT 1 FROM migration_meta.migration_legacy_ids mm
                                                  WHERE mm.modern_table = 'legacy_invoice_item_payments'
                                                    AND mm.modern_id = x.id::text))
         ),
         modern AS (
           SELECT 'N' || v.id AS key, coalesce(nullif(v.invoice_number, ''), v.id) AS "invoiceId",
                  coalesce(nullif(btrim(v.customer_name), ''), '-') AS company,
                  coalesce(v.total, 0)::text AS amount, v.created_at AS "createdAt", '—' AS hod
             FROM drm.invoices v
            WHERE v.created_by_user_id::text = $1::text
              AND coalesce(v.status::text, '') <> 'Paid'
              AND NOT EXISTS (SELECT 1 FROM migration_meta.migration_legacy_ids mm
                               WHERE mm.modern_table = 'invoices' AND mm.modern_id = v.id::text)
              AND NOT EXISTS (SELECT 1 FROM drm.ledger_entries le
                               WHERE le.reference_id = v.id::text AND le.category = 'Invoice Payment'
                                 AND le.entry_type = 'Credit')
         )
         SELECT * FROM (SELECT * FROM legacy UNION ALL SELECT * FROM modern) x
          ORDER BY "createdAt" DESC NULLS LAST`,
        [String(userId)],
      );
      res.json({ total: rows.length, items: rows.slice(0, LIMIT) });
    } catch (error) {
      console.error("Error fetching unpaid invoices:", error);
      res.status(500).json({ error: "Failed to fetch unpaid invoices" });
    }
  });
}
