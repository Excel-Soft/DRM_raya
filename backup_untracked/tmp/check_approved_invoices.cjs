const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.tdofmdaeahxfgmlmjgbp:SajjadAgent2026%21@aws-1-us-east-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function checkApprovedInvoices() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT * FROM drm.product_posting_invoices WHERE status = 'APPROVED'
    `);
    console.log('Approved Invoices in product_posting_invoices:');
    console.log(JSON.stringify(res.rows, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
}

checkApprovedInvoices().catch(console.error);
