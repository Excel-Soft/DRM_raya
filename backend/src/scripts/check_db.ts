
import { pool } from "../db";

async function run() {
    try {
        await pool.query("select added_by_id from gm_entries limit 1");
        console.log("added_by_id exists");
    } catch (e: any) {
        console.log("added_by_id MISSING: " + e.message);
    }
    process.exit(0);
}
run();
