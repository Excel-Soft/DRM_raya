const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.tdofmdaeahxfgmlmjgbp:SajjadAgent2026%21@aws-1-us-east-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function findInvoiceRefs() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'drm' AND column_name LIKE '%invoice%'
    `);
    console.log('Columns referencing "invoice":');
    res.rows.forEach(row => console.log(`${row.table_name}.${row.column_name}`));
  } finally {
    client.release();
    await pool.end();
  }
}

findInvoiceRefs().catch(console.error);
