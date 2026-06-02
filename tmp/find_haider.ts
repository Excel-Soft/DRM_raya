import { pool } from '../server/db'; async function run() { 
  const r = await pool.query('select id, company_name, owner_user_id, created_by, pool_type from drm.customers where drm_id=\'pkhaid8809\' or company_name=\'haider\''); 
  console.log('Customers:', r.rows); 
  const t = await pool.query('select id, person_name, user_id, status from drm.temp_contacts where id::text in (select id::text from drm.customers where company_name=\'haider\') or person_name ILIKE \'%haider%\'');
  console.log('TempContacts:', t.rows);
  const o = await pool.query('select * from drm.opportunities where title ilike \'%haider%\'');
  console.log('Opportunities:', o.rows);
  process.exit(0); 
} run();
