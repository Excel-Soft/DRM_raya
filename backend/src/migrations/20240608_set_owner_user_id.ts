// Migration: set owner_user_id = created_by for existing customers where missing
import { pool } from '../db';

async function run() {
  const res = await pool.query(`
    UPDATE drm.customers
    SET owner_user_id = created_by
    WHERE owner_user_id IS NULL OR owner_user_id = ''
      AND created_by IS NOT NULL;
  `);
  console.log('Customers owner_user_id updated rows:', res.rowCount);

  const resTemp = await pool.query(`
    UPDATE drm.temp_contacts
    SET user_id = created_by
    WHERE (user_id IS NULL OR user_id = '')
      AND created_by IS NOT NULL;
  `);
  console.log('Temp contacts user_id updated rows:', resTemp.rowCount);
  process.exit(0);
}
run();
