import { pool } from '../server/db'; async function run() { 
  const r = await pool.query('select id, name, email, role, roles from drm.users where email=\'admin@excelstech.com\''); 
  console.log('Ahmed:', r.rows); 
  process.exit(0); 
} run();
