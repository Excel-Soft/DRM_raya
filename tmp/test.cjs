const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const query = "select id, company_name, pool_type, owner_user_id, created_by from drm.customers order by created_at desc limit 5";
  const { rows } = await pool.query(query);
  console.log(rows);
  process.exit(0);
}
run();
