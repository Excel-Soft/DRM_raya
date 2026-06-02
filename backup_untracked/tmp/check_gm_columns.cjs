const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres.tdofmdaeahxfgmlmjgbp:SajjadAgent2026%21@aws-1-us-east-2.pooler.supabase.com:5432/postgres',
    ssl: { rejectUnauthorized: false }
});

async function main() {
    const result = await pool.query(`
    select column_name, data_type 
    from information_schema.columns 
    where table_schema = 'drm' and table_name = 'gm_entries'
    order by ordinal_position
  `);
    console.log("gm_entries columns:");
    result.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));
    await pool.end();
}
main().catch(err => { console.error(err.message); pool.end(); });
