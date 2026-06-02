import { pool } from "../server/db";

async function run() {
    const roles = await pool.query("SELECT id, name FROM drm.roles");
    console.log("Roles:");
    console.table(roles.rows);

    const perms = await pool.query("SELECT id, name, allowed_role_ids FROM drm.url_permissions");
    console.log("Permissions:");
    console.table(perms.rows);

    process.exit(0);
}
run();
