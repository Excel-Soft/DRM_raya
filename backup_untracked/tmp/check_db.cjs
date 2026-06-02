const { Pool } = require('pg');
const pool = new Pool({
  connectionString: "postgresql://postgres.tdofmdaeahxfgmlmjgbp:SajjadAgent2026!@aws-1-us-east-2.pooler.supabase.com:5432/postgres",
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    const res = await pool.query("SELECT table_schema, table_name FROM information_schema.tables WHERE table_name = 'session'");
    console.log('Session table locations:', res.rows);
    
    // Check drm.session
    const drmSession = await pool.query("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'drm' AND table_name = 'session'");
    console.log('drm.session exists:', drmSession.rows[0].count > 0);

  } catch (err) {
    console.error('DB Error:', err.message);
  } finally {
    await pool.end();
  }
}
check();
