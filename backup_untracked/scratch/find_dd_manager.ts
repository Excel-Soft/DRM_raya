import { pool } from "../server/db";

async function findManager() {
    const res = await pool.query("SELECT id, full_name, role_id FROM users WHERE role_id ILIKE '%dd%' OR role_id ILIKE '%d_d%' LIMIT 10");
    console.table(res.rows);
    process.exit(0);
}

findManager();
