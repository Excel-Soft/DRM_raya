const pg = require("pg");
const { Pool } = pg;
require("dotenv").config();

async function listUsers() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL
    });

    try {
        const users = await pool.query("SELECT id, email, role_id, full_name FROM drm.users LIMIT 20");
        console.log("Users:", JSON.stringify(users.rows, null, 2));
    } catch (err) {
        console.error("Error listing users:", err);
    } finally {
        await pool.end();
    }
}

listUsers();
