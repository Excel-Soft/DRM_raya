const pg = require("pg");
const { Pool } = pg;
require("dotenv").config();

async function listMenus() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL
    });

    try {
        const menus = await pool.query("SELECT id, name, allowed_role_ids FROM drm.menu_permissions");
        console.log("Menus:", JSON.stringify(menus.rows, null, 2));
    } catch (err) {
        console.error("Error listing menus:", err);
    } finally {
        await pool.end();
    }
}

listMenus();
