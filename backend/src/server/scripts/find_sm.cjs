const pg = require("pg");
const { Pool } = pg;
require("dotenv").config();

async function findSM() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL
    });

    try {
        const users = await pool.query("SELECT email, role_id, full_name FROM drm.users WHERE role_id = 'service_manager'");
        console.log("SM Users:", JSON.stringify(users.rows, null, 2));
    } catch (err) {
        console.error("Error finding SM:", err);
    } finally {
        await pool.end();
    }
}

findSM();
