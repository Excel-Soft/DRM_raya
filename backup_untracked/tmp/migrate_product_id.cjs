const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres.tdofmdaeahxfgmlmjgbp:SajjadAgent2026%21@aws-1-us-east-2.pooler.supabase.com:5432/postgres',
    ssl: { rejectUnauthorized: false }
});

async function main() {
    console.log("Starting migration...");
    await pool.query(`
    alter table drm.quotation_items alter column product_id type text;
  `);
    console.log("Migration finished.");
    process.exit(0);
}

main().catch(err => {
    console.error("Migration failed:", err);
    process.exit(1);
});
