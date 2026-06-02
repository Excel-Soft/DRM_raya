const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.tdofmdaeahxfgmlmjgbp:SajjadAgent2026%21@aws-1-us-east-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function checkColumns() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'drm' AND table_name = 'product_posting_invoices'
    `);
    console.log('Columns in product_posting_invoices:');
    res.rows.forEach(row => console.log(`${row.column_name}: ${row.data_type}`));

    const res2 = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'drm' AND table_name = 'projects'
    `);
    console.log('\nColumns in projects:');
    res2.rows.forEach(row => console.log(`${row.column_name}: ${row.data_type}`));
  } finally {
    client.release();
    await pool.end();
  }
}

checkColumns().catch(console.error);
