import { pool } from "./server/db";

async function revertInvoices() {
  try {
    const res1 = await pool.query(`UPDATE drm.invoices SET payment_method = null WHERE payment_method = 'BankTransfer'`);
    console.log(`Reverted ${res1.rowCount} standard invoices`);

    const res2 = await pool.query(`UPDATE drm.product_posting_invoices SET payment_method = null WHERE payment_method = 'BankTransfer'`);
    console.log(`Reverted ${res2.rowCount} product posting invoices`);

    const res3 = await pool.query(`UPDATE drm.quotations SET payment_method = null WHERE payment_method = 'BankTransfer'`);
    console.log(`Reverted ${res3.rowCount} quotations`);
  } catch(e) {
    console.error(e);
  }
  process.exit();
}
revertInvoices();
