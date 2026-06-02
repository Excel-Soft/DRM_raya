
import { pool } from "../server/db";

async function diagnose() {
    try {
        console.log("--- PMS PERMISSIONS ---");
        const perms = await pool.query("SELECT * FROM drm.url_permissions WHERE path LIKE '%pms%'");
        console.log(JSON.stringify(perms.rows, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

diagnose();
