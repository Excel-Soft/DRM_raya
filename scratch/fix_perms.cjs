require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    await pool.query(`
      UPDATE drm.url_permissions 
      SET allowed_role_ids = array_append(allowed_role_ids, 'sales_executive')
      WHERE path = 'targets' AND NOT ('sales_executive' = ANY(allowed_role_ids));
    `);
    
    await pool.query(`
      UPDATE drm.url_permissions 
      SET allowed_role_ids = array_append(allowed_role_ids, 'service_executive')
      WHERE path = 'targets' AND NOT ('service_executive' = ANY(allowed_role_ids));
    `);
    
    console.log("Updated permissions for sales_executive and service_executive!");
  } finally {
    pool.end();
  }
}
run();
