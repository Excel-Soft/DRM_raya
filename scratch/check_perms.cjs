require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const res = await pool.query(`select allowed_role_ids from drm.url_permissions where path = 'targets'`);
    console.log(res.rows[0].allowed_role_ids);
  } finally {
    pool.end();
  }
}
run();
