import { pool } from '../server/db'; async function run() { const r = await pool.query('select full_name, email, role, roles from drm.users'); console.log(r.rows); process.exit(0); } run();
