const pg = require("pg");
require("dotenv").config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkApprovals() {
  try {
    const res = await pool.query("SELECT * FROM drm.project_approvals");
    console.log("Total Approvals:", res.rowCount);
    console.log("Status counts:");
    const statusCounts = await pool.query("SELECT status, count(*) FROM drm.project_approvals GROUP BY status");
    console.table(statusCounts.rows);

    const pendingInvoices = await pool.query("SELECT * FROM drm.product_posting_invoices WHERE status = 'APPROVED'");
    console.log("Total Approved Invoices:", pendingInvoices.rowCount);

    const checkRenamedRoute = await pool.query(`
      SELECT i.id, i.status 
      FROM drm.product_posting_invoices i
      WHERE i.status = 'APPROVED'
      AND NOT EXISTS (
        SELECT 1 FROM drm.projects p WHERE p.invoice_id = i.id
      )
    `);
    console.log("Invoices awaiting project creation:", checkRenamedRoute.rowCount);
    console.table(checkRenamedRoute.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkApprovals();
