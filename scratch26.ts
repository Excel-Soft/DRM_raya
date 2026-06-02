import { pool } from "./server/db";

async function checkRecentInvoices() {
  try {
    const res1 = await pool.query(`SELECT id, status, payment_method, updated_at FROM drm.invoices ORDER BY updated_at DESC LIMIT 5`);
    console.log("Standard Invoices:", res1.rows);

    const res2 = await pool.query(`SELECT id, status, payment_method, updated_at FROM drm.product_posting_invoices ORDER BY updated_at DESC LIMIT 5`);
    console.log("Product Posting Invoices:", res2.rows);

    const res3 = await pool.query(`SELECT id, gm_type, payment_status, updated_at FROM drm.gm_entries ORDER BY updated_at DESC LIMIT 5`);
    console.log("GM Entries:", res3.rows);

  } catch(e) {
    console.error(e);
  }
  process.exit();
}
checkRecentInvoices();
