const { pool } = require('./server/db');

async function run() {
  const res = await pool.query(`SELECT id, created_by, created_at, amount_usd FROM drm.gm_entries LIMIT 10`);
  console.log("GM Entries:", res.rows);
  const users = await pool.query(`SELECT id, role, under_works FROM drm.users WHERE id IN (SELECT created_by FROM drm.gm_entries)`);
  console.log("Users who created GMs:", users.rows);
  await pool.end();
}
run();
