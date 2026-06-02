
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkSchema() {
  try {
    const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' AND table_schema = 'public'");
    console.log("Public schema columns:", res.rows.map(r => r.column_name).join(", "));
    
    const res2 = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' AND table_schema = 'drm'");
    console.log("DRM schema columns:", res2.rows.map(r => r.column_name).join(", "));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkSchema();
