import { pool } from '../server/db'; async function run() { 
  const r = await pool.query('select * from drm.opportunities where title ilike \'%haider%\' or customer_id=\'c8a5b9a4-0698-4381-aaab-37c136436562\''); 
  console.log('Opportunities:', r.rows); 
  process.exit(0); 
} run();
