const { Pool } = require('pg');

async function test() {
    const pool = new Pool({
        connectionString: "postgresql://postgres.tdofmdaeahxfgmlmjgbp:SajjadAgent2026%21@aws-1-us-east-2.pooler.supabase.com:5432/postgres",
        ssl: { rejectUnauthorized: false }
    });

    try {
        const res = await pool.query("SELECT table_schema, column_name FROM information_schema.columns WHERE table_name = 'projects'");
        console.log(res.rows);
    } finally {
        pool.end();
    }
}

test();
