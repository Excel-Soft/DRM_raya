const pg = require("pg");
const { Pool } = pg;
require("dotenv").config();

async function listUrlPerms() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL
    });

    try {
        const perms = await pool.query("SELECT id, path, name, allowed_role_ids FROM drm.url_permissions");
        console.log("URL Perms:", JSON.stringify(perms.rows, null, 2));
    } catch (err) {
        console.error("Error listing URL perms:", err);
    } finally {
        await pool.end();
    }
}

listUrlPerms();
