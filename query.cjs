const { pool } = require('./server/db');

async function run() {
  const res = await pool.query(`SELECT name, allowed_role_ids, sub_urls FROM drm.menu_permissions WHERE name = 'PMS'`);
  console.log(JSON.stringify(res.rows, null, 2));
  await pool.end();
}
run();
