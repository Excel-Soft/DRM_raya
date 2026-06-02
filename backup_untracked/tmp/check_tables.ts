import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkTables() {
  try {
    const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'drm' AND table_name = 'notifications'");
    console.log("Columns in drm.notifications:", res.rows.map(r => r.column_name));
    
    if (res.rows.length === 0) {
        const allRes = await pool.query("SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema NOT IN ('information_schema', 'pg_catalog') LIMIT 50");
        console.log("All tables (first 50):", allRes.rows);
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await pool.end();
  }
}

checkTables();
