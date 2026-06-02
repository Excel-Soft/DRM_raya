const pg = require("pg");
const { Pool } = pg;
require("dotenv").config();

async function fix() {
    const config = {
        connectionString: process.env.DATABASE_URL
    };
    const pool = new Pool(config);

    try {
        console.log("🚀 Starting permission removal for Service Manager...");

        // Remove service_manager from all menu permissions EXCEPT the allowed ones
        const allowedMenus = [
            'Dashboard', 
            'Customer', 
            'Attendance', 
            'LEAD', 
            'PMS', 
            'User Reports', 
            'Training'
        ];

        // Retrieve all menu permissions
        const res = await pool.query("SELECT id, name, allowed_role_ids FROM drm.menu_permissions");
        let updatedCount = 0;

        for (const row of res.rows) {
            if (!allowedMenus.includes(row.name)) {
                // If service_manager is in allowed_role_ids, remove it
                if (row.allowed_role_ids && row.allowed_role_ids.includes('service_manager')) {
                    const newRoles = row.allowed_role_ids.filter(r => r !== 'service_manager');
                    await pool.query(
                        "UPDATE drm.menu_permissions SET allowed_role_ids = $1 WHERE id = $2",
                        [newRoles, row.id]
                    );
                    updatedCount++;
                    console.log(`Removed from: ${row.name}`);
                }
            }
        }

        console.log(`✅ updated ${updatedCount} menu permissions.`);
        console.log("✨ Fix applied successfully!");
    } catch (err) {
        console.error("❌ Error applying fixes:", err);
    } finally {
        await pool.end();
    }
}

fix();
