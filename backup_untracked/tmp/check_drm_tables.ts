import { pool } from "../server/db";

async function checkTargets() {
    try {
        const res = await pool.query("SELECT * FROM drm.targets");
        console.table(res.rows);

        const res2 = await pool.query("SELECT * FROM drm.service_subservices LIMIT 5");
        console.table(res2.rows);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
checkTargets();
