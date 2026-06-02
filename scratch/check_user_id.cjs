require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  try {
    const res = await pool.query(`SELECT id, full_name, username, role FROM drm.users WHERE id = '0dccb495-9eb3-4ad8-923d-5e6a9677beff'`);
    console.log(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
check();
