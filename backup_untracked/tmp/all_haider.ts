import { pool } from '../server/db'; async function run() { 
  const r = await pool.query('select * from drm.customers where company_name ilike \'%haider%\''); 
  console.log('Customers:', r.rows); 
  process.exit(0); 
} run();
