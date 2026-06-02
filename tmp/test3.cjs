const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const userId1 = '292134ce-af47-413f-b635-c1becef59485'; // Ali or someone
  const userId2 = 'b29868ad-e13c-4aed-8c70-444639c3bfaf'; 
  
  const whereSql = "where coalesce(op.owner_id::text, c.owner_user_id::text, c.created_by::text) = $1::text";
  const params = [userId1];
  
  const query = `
    select c.id, c.company_name, c.owner_user_id, c.created_by, op.owner_id
    from drm.customers c
    left join drm.opportunities op on op.customer_id = c.id and coalesce(op.is_deleted, false) = false
    ${whereSql}
  `;
  try {
    const { rows } = await pool.query(query, params);
    console.log(`Results for ${userId1}:`, rows.length);
    if(rows.length > 0) {
      console.log(rows[0]);
    }
    
    // Also, count everything without whereSql
    const { rows: allRows } = await pool.query(`select count(*) from drm.customers`);
    console.log(`Total customers:`, allRows[0].count);
    
  } catch(e) {
    console.error(e);
  }
  process.exit(0);
}
run();
