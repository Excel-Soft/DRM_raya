require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  try {
    const targetsRes = await pool.query(`SELECT id, user_id, target_name, category, target, price, total FROM drm.target_system_user_targets ORDER BY created_at DESC LIMIT 5`);
    console.table(targetsRes.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
check();
