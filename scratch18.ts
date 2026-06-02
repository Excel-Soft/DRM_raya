import { pool } from "./server/db";

async function addColumns() {
  try {
    await pool.query(`ALTER TABLE drm.invoices ADD COLUMN IF NOT EXISTS payment_method VARCHAR(255)`);
    console.log("Added to invoices");
  } catch(e) { console.error(e) }
  
  try {
    await pool.query(`ALTER TABLE drm.product_posting_invoices ADD COLUMN IF NOT EXISTS payment_method VARCHAR(255)`);
    console.log("Added to product_posting_invoices");
  } catch(e) { console.error(e) }

  try {
    await pool.query(`ALTER TABLE drm.quotations ADD COLUMN IF NOT EXISTS payment_method VARCHAR(255)`);
    console.log("Added to quotations");
  } catch(e) { console.error(e) }
  
  process.exit();
}

addColumns();
