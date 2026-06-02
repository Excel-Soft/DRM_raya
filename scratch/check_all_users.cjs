require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  try {
    const users = await pool.query(`SELECT id, username, email, role FROM drm.users ORDER BY created_at ASC LIMIT 10`);
    console.table(users.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
check();
