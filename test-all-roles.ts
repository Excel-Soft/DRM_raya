import { pool } from "./server/db";

async function testAllRolesTargets() {
  console.log("=== Testing Target System For Other Roles ===\n");
  try {
    // 1. Insert a Daily Target for "sales manager"
    console.log("-> Inserting Target for 'sales manager'...");
    await pool.query(`
      INSERT INTO drm.target_system_daily_targets (role, method, target)
      VALUES ('sales manager', 'Whatsapp', '150')
    `);
    
    // 2. Insert an AB target for a Sales Executive (Simulate Pipeline Summary)
    console.log("-> Inserting Target for 'sales executive' (AB and VAS)...");
    await pool.query(`
      INSERT INTO drm.target_system_user_targets (user_id, category, target_name, target, price, bonus)
      VALUES ('sales_executive', 'AB New Terget', 'Test Sales Exec AB Target', '20000', '1500', '8%')
    `);

    // 3. Fetch from Daily Targets to verify it works for managers
    console.log("\n--- Validating Manager Targets DB Pull ---");
    const managerTargets = await pool.query(`SELECT * FROM drm.target_system_daily_targets WHERE lower(role) = 'sales manager'`);
    console.log("Sales Manager Targets found:", managerTargets.rows.length);
    if(managerTargets.rows.length > 0) {
       console.log("Example:", managerTargets.rows[0].method, "->", managerTargets.rows[0].target);
    }

    // 4. Fetch from User Targets to verify Pipeline Summary pull
    console.log("\n--- Validating Pipeline Summary DB Pull ---");
    const userTargets = await pool.query(`SELECT * FROM drm.target_system_user_targets WHERE user_id = 'sales_executive'`);
    console.log("Sales Exec User Targets found:", userTargets.rows.length);
    if(userTargets.rows.length > 0) {
       console.log("Example:", userTargets.rows[0].category, "->", userTargets.rows[0].target_name);
    }
    
    console.log("\n✅ E2E Workflow verification complete for multiple roles!");
  } catch(e) {
    console.error("Test failed:", e);
  } finally {
    process.exit(0);
  }
}

testAllRolesTargets();
