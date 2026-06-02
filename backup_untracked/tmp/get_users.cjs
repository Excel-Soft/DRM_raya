const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres.tdofmdaeahxfgmlmjgbp:SajjadAgent2026%21@aws-1-us-east-2.pooler.supabase.com:5432/postgres',
    ssl: { rejectUnauthorized: false }
});

async function main() {
    // Get user with plain password
    const res = await pool.query("SELECT id, email, password, full_name, role FROM drm.users WHERE is_active = true AND password IS NOT NULL ORDER BY created_at LIMIT 10");
    console.log("Users with passwords:");
    res.rows.forEach(u => console.log(`  ${u.email} pwd="${u.password}" role=${u.role}`));
    await pool.end();
}
main().catch(err => { console.error(err.message); pool.end(); });
