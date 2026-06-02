
import { pool } from "../server/db";

async function checkGmData() {
    try {
        const res = await pool.query('SELECT COUNT(*) FROM gm_entries');
        console.log(`Current GM entries count: ${res.rows[0].count}`);
    } catch (err) {
        console.error("Error checking GM data:", err);
    } finally {
        process.exit();
    }
}

checkGmData();
