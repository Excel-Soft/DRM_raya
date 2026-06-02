import { pool } from '../server/db'; async function run() { 
  const r = await pool.query('select id, name, email, role from drm.users');
  console.table(r.rows);
  process.exit(0); 
} run();
