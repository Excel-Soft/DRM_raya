const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.tdofmdaeahxfgmlmjgbp:SajjadAgent2026%21@aws-1-us-east-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function checkQuotations() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'quotations'
    `);
    console.log('Columns in quotations:');
    res.rows.forEach(row => console.log(`${row.column_name}: ${row.data_type}`));

    const res2 = await client.query(`
      SELECT * FROM quotations LIMIT 1
    `);
    console.log('\nSample data from quotations:');
    console.log(JSON.stringify(res2.rows[0], null, 2));
  } finally {
    client.release();
    await pool.end();
  }
}

checkQuotations().catch(console.error);
