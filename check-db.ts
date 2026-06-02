import { pool } from "./server/db";

async function run() {
  try {
    const res = await pool.query("SELECT id, company_name, approval_status, status FROM drm.gm_entries ORDER BY created_at DESC LIMIT 5");
    console.log("Recent GM Entries:");
    console.table(res.rows);

    const inv = await pool.query("SELECT id, company_name, status FROM drm.product_posting_invoices ORDER BY created_at DESC LIMIT 5");
    console.log("Recent Invoices:");
    console.table(inv.rows);

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
