import { pool } from "../server/db";

async function seedUserReports() {
    const client = await pool.connect();
    try {
        const TABLE = "drm.menu_permissions";
        
        // 1. Check if "User Reports" already exists
        const check = await client.query(`SELECT id FROM ${TABLE} WHERE name = $1`, ["User Reports"]);
        
        if (check.rows.length === 0) {
            console.log("Seeding 'User Reports' permission...");
            await client.query(
                `INSERT INTO ${TABLE} (name, menu_icon, is_active, permissions, sub_urls, allowed_role_ids)
                 VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::text[])`,
                [
                    "User Reports",
                    "BarChart3", // Icon
                    true,
                    JSON.stringify([{ name: "User Reports", type: "default" }]),
                    JSON.stringify({ isRoot: true, items: ["analytics/user-activity"] }),
                    []
                ]
            );
            console.log("Success: 'User Reports' added to DB.");
        } else {
            console.log("'User Reports' already exists in DB.");
        }
    } catch (err) {
        console.error("Error seeding permission:", err);
    } finally {
        client.release();
    }
}

seedUserReports();
