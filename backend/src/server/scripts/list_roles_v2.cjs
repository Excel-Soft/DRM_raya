const pg = require("pg");
const { Pool } = pg;
require("dotenv").config();

async function listRoles() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL
    });

    try {
        const roles = await pool.query("SELECT DISTINCT role_id FROM drm.users");
        console.log("Roles:", JSON.stringify(roles.rows, null, 2));
    } catch (err) {
        console.error("Error listing roles:", err);
    } finally {
        await pool.end();
    }
}

listRoles();
