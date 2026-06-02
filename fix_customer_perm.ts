import { pool } from './server/db.ts';

async function fix() {
  await pool.query(`
    UPDATE menu_permissions 
    SET allowed_role_ids = array_append(array_append(allowed_role_ids, 'product_posting_executive'), 'posting_executive') 
    WHERE name = 'Customer' AND NOT ('product_posting_executive' = ANY(allowed_role_ids));
  `);
  console.log('Fixed Customer permissions!');
  process.exit(0);
}

fix();
