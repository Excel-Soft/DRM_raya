const { Pool } = require('pg');

async function check() {
    const pool = new Pool({
        connectionString: "postgresql://postgres.tdofmdaeahxfgmlmjgbp:SajjadAgent2026%21@aws-1-us-east-2.pooler.supabase.com:5432/postgres",
        ssl: { rejectUnauthorized: false }
    });

    try {
        const res = await pool.query("SELECT id, email, role, full_name, is_active FROM drm.users WHERE role IN ('admin', 'sales_executive', 'account_manager', 'hod') LIMIT 10");
        console.log("Users:", res.rows);
    } finally {
        pool.end();
    }
}

check().catch(console.error);
