const { pool } = require('./server/db');

async function run() {
  const res = await pool.query(`SELECT id, username, role, under_works FROM drm.users LIMIT 20`);
  console.log(JSON.stringify(res.rows, null, 2));
  await pool.end();
}
run();
