import { pool } from "../db";

async function ensureProductPostingInvoicesTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS drm.product_posting_invoices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      amount NUMERIC(12, 2) DEFAULT 0,
      sales_exec_id UUID,
      customer_id UUID,
      project_name TEXT,
      company_name TEXT,
      status TEXT DEFAULT 'PENDING_HOD',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

/**
 * Automatically creates 3 zero-amount invoices for the Product Posting Workflow
 * (Alibaba Product Posting, Alibaba Minisite, Listing Page)
 */
export async function createProductPostingInvoices(
  userId: string,
  customerId: string | null | undefined,
  companyName: string | null | undefined
) {
  try {
    await ensureProductPostingInvoicesTable();
    const invoiceInsertSql = `
      INSERT INTO drm.product_posting_invoices (
        id, amount, sales_exec_id, customer_id, project_name, company_name, status, created_at, updated_at
      ) VALUES (gen_random_uuid(), 0, $1, $2, $3, $4, 'PENDING_HOD', NOW(), NOW())
    `;
    
    const projectNames = ["Alibaba Product Posting", "Alibaba Minisite", "Listing Page"];
    
    for (const name of projectNames) {
      await pool.query(invoiceInsertSql, [
        userId, 
        customerId || null, 
        name, 
        companyName || "N/A"
      ]);
    }
    
    console.log(`[invoice-utils] created 3 automatic zero-amount invoices for company ${companyName || 'N/A'}`);
    return true;
  } catch (err) {
    console.error("[invoice-utils] failed to create automatic invoices:", err);
    return false;
  }
}
