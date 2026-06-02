const pg = require('pg');

async function fix() {
  const pool = new pg.Pool({
    connectionString: "postgresql://postgres.tdofmdaeahxfgmlmjgbp:SajjadAgent2026%21@aws-1-us-east-2.pooler.supabase.com:5432/postgres",
    ssl: { rejectUnauthorized: false }
  });
  try {
    const res = await pool.query("SELECT created_by, customer_id, company_name FROM drm.gm_entries WHERE company_name = 'zahid • talha' ORDER BY created_at DESC LIMIT 1");
    if (res.rows.length === 0) {
      console.log("No GM found for zahid • talha");
      return;
    }
    const { created_by, customer_id, company_name } = res.rows[0];
    
    const projects = ["Alibaba Product Posting", "Alibaba Minisite", "Listing Page"];
    for (const name of projects) {
       await pool.query('INSERT INTO drm.product_posting_invoices (id, amount, sales_exec_id, customer_id, project_name, company_name, status, created_at, updated_at) VALUES (gen_random_uuid(), 0, $1, $2, $3, $4, \'PENDING_HOD\', NOW(), NOW())', 
       [created_by, customer_id, name, company_name]);
    }
    console.log("Manual fix applied: Created 3 invoices for zahid • talha");
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

fix();
