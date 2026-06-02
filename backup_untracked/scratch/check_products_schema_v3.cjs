const pg = require('pg');

async function check() {
  const pool = new pg.Pool({
    connectionString: "postgresql://postgres.tdofmdaeahxfgmlmjgbp:SajjadAgent2026%21@aws-1-us-east-2.pooler.supabase.com:5432/postgres",
    ssl: { rejectUnauthorized: false }
  });
  try {
    const res = await pool.query("SELECT table_schema, column_name FROM information_schema.columns WHERE table_name = 'products' AND table_schema = 'public' ORDER BY column_name");
    console.log('PUBLIC SCHEMA:', JSON.stringify(res.rows, null, 2));
    
    const resDrm = await pool.query("SELECT table_schema, column_name FROM information_schema.columns WHERE table_name = 'products' AND table_schema = 'drm' ORDER BY column_name");
    console.log('DRM SCHEMA:', JSON.stringify(resDrm.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

check();
