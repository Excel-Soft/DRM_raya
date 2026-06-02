import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkInvoices() {
  try {
    const res = await pool.query("SELECT * FROM drm.product_posting_invoices WHERE status = 'APPROVED' LIMIT 10");
    console.log("Approved Invoices found:", res.rows);
    
    if (res.rows.length > 0) {
        const invId = res.rows[0].id;
        const projRes = await pool.query("SELECT * FROM drm.projects WHERE invoice_id = $1", [invId]);
        console.log(`Projects for invoice ${invId}:`, projRes.rows);
    } else {
        const allStatus = await pool.query("SELECT status, count(*) FROM drm.product_posting_invoices GROUP BY status");
        console.log("Invoices by status:", allStatus.rows);
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await pool.end();
  }
}

checkInvoices();
