import { pool } from "./server/db";
pool.query(`
        SELECT
          q.id::text,
          q.account_holder   AS "accountHolder",
          q.company,
          q.email,
          q.contact,
          q.gst_percent      AS "gstPercent",
          q.discount_type    AS "discountType",
          q.discount_value   AS "discountValue",
          q.sub_amount       AS "subAmount",
          q.gst_amount       AS "gstAmount",
          q.total_amount     AS "totalAmount",
          q.grand_total      AS "grandTotal",
          q.save_status      AS "saveStatus",
          q.note,
          q.created_at       AS "createdAt",
          q.updated_at       AS "updatedAt",
          q.lead_id          AS "leadId",
          q.customer_id      AS "customerId",
          u.full_name        AS "submittedByName",
          u.email            AS "submittedByEmail",
          'quotation'        AS "source",
          NULL               AS "paymentProofUrl"
        FROM drm.quotations q
        LEFT JOIN drm.users u ON u.id::text = q.created_by::text
        WHERE q.save_status = 'pending_account_manager'
        
        UNION ALL
        
        SELECT
          p.id::text,
          p.company_name     AS "accountHolder",
          p.company_name     AS "company",
          NULL               AS "email",
          NULL               AS "contact",
          0                  AS "gstPercent",
          'AMOUNT'           AS "discountType",
          0                  AS "discountValue",
          p.amount::numeric  AS "subAmount",
          0                  AS "gstAmount",
          p.amount::numeric  AS "totalAmount",
          p.amount::numeric  AS "grandTotal",
          p.status           AS "saveStatus",
          p.project_name     AS "note",
          p.created_at       AS "createdAt",
          p.updated_at       AS "updatedAt",
          NULL               AS "leadId",
          NULL               AS "customerId",
          u.full_name        AS "submittedByName",
          u.email            AS "submittedByEmail",
          'product_posting'  AS "source",
          NULL               AS "paymentProofUrl"
        FROM drm.product_posting_invoices p
        LEFT JOIN drm.users u ON u.id = p.sales_exec_id
        WHERE p.status = 'PENDING_ACCOUNT'
        
        UNION ALL
        
        SELECT
          i.id::text,
          i.customer_name     AS "accountHolder",
          i.customer_name     AS "company",
          i.customer_email    AS "email",
          NULL               AS "contact",
          0                  AS "gstPercent",
          'AMOUNT'           AS "discountType",
          0                  AS "discountValue",
          i.subtotal::numeric AS "subAmount",
          i.tax::numeric      AS "gstAmount",
          i.total::numeric    AS "totalAmount",
          i.total::numeric    AS "grandTotal",
          i.status::text      AS "saveStatus",
          i.notes             AS "note",
          i.created_at        AS "createdAt",
          i.updated_at        AS "updatedAt",
          NULL                AS "leadId",
          i.customer_id::text AS "customerId",
          u.full_name         AS "submittedByName",
          u.email             AS "submittedByEmail",
          'standard_invoice'  AS "source",
          NULL                AS "paymentProofUrl"
        FROM drm.invoices i
        LEFT JOIN drm.users u ON u.id::text = i.created_by_user_id::text
        WHERE i.status = 'Sent'
        
        ORDER BY "updatedAt" DESC NULLS LAST
        LIMIT 20 OFFSET 0
`).then(r => console.log(r.rows.length)).catch(console.error).finally(() => process.exit());
