import { pool } from "../server/db";

async function run() {
    try {
        const res = await pool.query("SELECT * FROM drm.target_system_daily_targets");
        console.log("Daily targets count:", res.rowCount);
        console.log(JSON.stringify(res.rows, null, 2));

        const userTargets = await pool.query("SELECT * FROM drm.target_system_user_targets");
        console.log("User targets count:", userTargets.rowCount);
        console.log(JSON.stringify(userTargets.rows, null, 2));
    } catch (e: any) {
        console.error("Error querying db:", e);
    }
    process.exit(0);
}
run();
