require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  try {
    const userIdStr = '00e97543-f362-46d4-a6a8-e397998d99db';
    const roleName = 'account_manager';
    
    const userQueryRes = await pool.query(`SELECT full_name, username FROM drm.users WHERE id = $1 LIMIT 1`, [userIdStr]);
    const userFullName = userQueryRes.rows[0]?.full_name || userQueryRes.rows[0]?.username || userIdStr;
    
    console.log("userIdStr:", userIdStr);
    console.log("userFullName:", userFullName);
    console.log("roleName:", roleName);

    const allUserTargets = await pool.query(`SELECT * FROM drm.target_system_user_targets`);
    const targets = allUserTargets.rows;
    console.log("Total targets in DB:", targets.length);

    const userTargets = targets.filter(t => 
      (t.user_id === String(userIdStr) || t.user_id === String(userFullName)) && 
      t.category && 
      (t.category.toLowerCase().includes("ab new") || t.category.toLowerCase().includes("ab"))
    );

    const roleTargets = targets.filter(t => 
       t.user_id === roleName && 
       t.category && 
       (t.category.toLowerCase().includes("ab new") || t.category.toLowerCase().includes("ab"))
    );
    
    const finalTargets = [...userTargets, ...roleTargets];
    
    console.log("userTargets:", userTargets.length);
    console.log("roleTargets:", roleTargets.length);
    console.log("finalTargets:", finalTargets.length);
    
    if (finalTargets.length > 0) {
      console.log("First matched target:", finalTargets[0]);
    }
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
check();
