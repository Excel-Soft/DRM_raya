import { pool } from "./server/db";

async function testDashboards() {
  try {
    const res = await pool.query(`SELECT * FROM drm.target_system_daily_targets`);
    console.log("Daily targets count:", res.rows.length);

    const res2 = await pool.query(`SELECT * FROM drm.target_system_user_targets`);
    console.log("User targets count:", res2.rows.length);

    console.log("Database schema test complete!");
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

testDashboards();
