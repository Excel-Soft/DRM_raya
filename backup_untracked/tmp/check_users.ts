import { pool } from "../server/db";

async function run() {
    const users = await pool.query("SELECT email, role, roles FROM drm.users LIMIT 2");
    console.log("Users:");
    console.table(users.rows);
    process.exit();
}

run();
