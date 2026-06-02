import { pool } from "./server/db";

async function fixAllOldInvoices() {
  try {
    const res1 = await pool.query(`UPDATE drm.invoices SET payment_method = 'BankTransfer' WHERE status IN ('Paid', 'APPROVED') AND payment_method IS NULL`);
    console.log(`Updated ${res1.rowCount} standard invoices`);

    const res2 = await pool.query(`UPDATE drm.product_posting_invoices SET payment_method = 'BankTransfer' WHERE status IN ('PENDING_ACCOUNT', 'APPROVED') AND payment_method IS NULL`);
    console.log(`Updated ${res2.rowCount} product posting invoices`);

    const res3 = await pool.query(`UPDATE drm.quotations SET payment_method = 'BankTransfer' WHERE save_status IN ('Approved', 'paid') AND payment_method IS NULL`);
    console.log(`Updated ${res3.rowCount} quotations`);
  } catch(e) {
    console.error(e);
  }
  process.exit();
}

fixAllOldInvoices();
