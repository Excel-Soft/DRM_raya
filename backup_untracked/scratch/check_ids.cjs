const pg = require('pg');

async function check() {
  const pool = new pg.Pool({
    connectionString: "postgresql://postgres.tdofmdaeahxfgmlmjgbp:SajjadAgent2026%21@aws-1-us-east-2.pooler.supabase.com:5432/postgres",
    ssl: { rejectUnauthorized: false }
  });
  try {
    const res = await pool.query("SELECT sales_exec_id, company_name FROM drm.product_posting_invoices WHERE company_name = 'zahid • talha'");
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

check();
