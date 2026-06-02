const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.tdofmdaeahxfgmlmjgbp:SajjadAgent2026%21@aws-1-us-east-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function checkData() {
  try {
    const res = await pool.query("SELECT entry_type, is_loan, status, COUNT(*) FROM drm.gm_entries GROUP BY 1, 2, 3");
    console.log("Counts in drm.gm_entries:");
    console.table(res.rows);

    const recent = await pool.query("SELECT drm_id, company_name, amount_usd, entry_type, created_at FROM drm.gm_entries ORDER BY created_at DESC LIMIT 5");
    console.log("\nRecent 5 entries:");
    console.table(recent.rows);
  } catch (err) {
    console.error("DB Error:", err);
  } finally {
    pool.end();
  }
}

checkData();
