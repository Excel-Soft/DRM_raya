require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  try {
    const userRes = await pool.query(`
        select id, full_name, email, role from drm.users where full_name ilike '%haider%' or email ilike '%haider%'
    `);
    console.log("Users:");
    console.table(userRes.rows);
    
    if (userRes.rows.length > 0) {
        for (const u of userRes.rows) {
            const targets = await pool.query(`select * from drm.target_system_user_targets where user_id = $1`, [u.id]);
            console.log(`Targets for ${u.full_name} (${u.id}):`);
            console.table(targets.rows);
        }
    }
    
  } catch (err) {
    console.error("Error:", err);
  } finally {
    pool.end();
  }
}
check();
