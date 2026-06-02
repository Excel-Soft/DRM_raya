
import { pool } from "../server/db";

async function checkNotifications() {
    try {
        const { rows } = await pool.query('SELECT * FROM drm.notifications ORDER BY created_at DESC LIMIT 10');
        console.log(JSON.stringify(rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

checkNotifications();
