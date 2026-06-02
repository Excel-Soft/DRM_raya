require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  try {
    const res = await pool.query(`
        select * from drm.target_system_user_targets
    `);
    
    const allUserTargets = res.rows;
    
    // mimic sales-routes.ts logic
    const userIdStr = 'haider-uuid'; // dummy
    const userFullName = 'haider'; // dummy
    
    const userTargets = allUserTargets.filter(t => 
        (t.user_id === String(userIdStr) || t.user_id === String(userFullName)) && 
        t.category && 
        (t.category.toLowerCase().includes("ab new") || t.category.toLowerCase().includes("ab"))
    );
    
    const roleTargets = allUserTargets.filter(t => 
         ['sales_executive'].includes(t.user_id) && 
         t.category && 
         (t.category.toLowerCase().includes("ab new") || t.category.toLowerCase().includes("ab"))
    );
    
    const finalTargets = [...userTargets, ...roleTargets];
    
    const rows = finalTargets.map((target) => ({
        target: `${target.target_name || target.category} [${target.target || 0}]`,
        bonus: target.bonus,
        priceTarget: target.price,
        reward: target.reward,
        kwa: target.kwa || "0",
        vas: target.vas || "0",
    }));
    
    console.log("Success! Extracted rows:");
    console.log(rows);
    
  } catch (err) {
    console.error("Error:", err);
  } finally {
    pool.end();
  }
}
check();
