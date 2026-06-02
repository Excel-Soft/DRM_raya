const pg = require('pg');

async function check() {
  const pool = new pg.Pool({
    connectionString: "postgresql://postgres.tdofmdaeahxfgmlmjgbp:SajjadAgent2026%21@aws-1-us-east-2.pooler.supabase.com:5432/postgres",
    ssl: { rejectUnauthorized: false }
  });
  try {
    const res = await pool.query(`
        SELECT p.name, w.current_phase, p.status as project_status 
        FROM drm.projects p 
        LEFT JOIN drm.product_posting_workflows w ON w.project_id = p.id 
        WHERE p.name ILIKE '%listing%' OR p.name ILIKE '%product%'
        ORDER BY p.created_at DESC LIMIT 10
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

check();
