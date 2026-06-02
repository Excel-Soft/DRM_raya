const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.tdofmdaeahxfgmlmjgbp:SajjadAgent2026%21@aws-1-us-east-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function listTables() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'drm'
    `);
    console.log('Tables in drm schema:');
    res.rows.forEach(row => console.log(row.table_name));
  } finally {
    client.release();
    await pool.end();
  }
}

listTables().catch(console.error);
