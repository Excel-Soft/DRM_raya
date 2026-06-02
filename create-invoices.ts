import { pool } from "./server/db";

async function run() {
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
  console.log("Table created successfully");
  process.exit(0);
}

run().catch(e => {
  console.error("Error creating table:", e);
  process.exit(1);
});
