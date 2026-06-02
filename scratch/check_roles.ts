import { pool } from "../server/db";

async function check() {
    try {
        const res = await pool.query(`select id, name from drm.roles`);
        console.log("Roles:", res.rows);
        
        const res2 = await pool.query(`select id, full_name, role_id from drm.users limit 5`);
        console.log("Users:", res2.rows);
    } catch (e) {
        console.error("Error:", e);
    }
    process.exit(0);
}

check();
