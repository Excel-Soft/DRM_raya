const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres.tdofmdaeahxfgmlmjgbp:SajjadAgent2026%21@aws-1-us-east-2.pooler.supabase.com:5432/postgres',
    ssl: { rejectUnauthorized: false }
});

async function main() {
    const result = await pool.query(`
    select column_name, data_type 
    from information_schema.columns 
    where table_name = 'quotation_items'
  `);
    console.log(JSON.stringify(result.rows, null, 2));
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
