const pg = require("pg");
const { Pool } = pg;
require("dotenv").config();

async function fix() {
    const config = {
        connectionString: process.env.DATABASE_URL
    };
    console.log("Config:", config);
    const pool = new Pool(config);

    try {
        console.log("🚀 Starting permission standardization for Service Manager (JS version)...");

        // 1. Update drm.menu_permissions
        const menuResult = await pool.query(`
            UPDATE drm.menu_permissions 
            SET allowed_role_ids = array_append(allowed_role_ids, 'service_manager')
            WHERE NOT ('service_manager' = ANY(allowed_role_ids));
        `);
        console.log(`✅ updated ${menuResult.rowCount} menu permissions.`);

        // 2. Update drm.url_permissions
        const urlResult = await pool.query(`
            UPDATE drm.url_permissions 
            SET allowed_role_ids = array_append(allowed_role_ids, 'service_manager')
            WHERE NOT ('service_manager' = ANY(allowed_role_ids));
        `);
        console.log(`✅ updated ${urlResult.rowCount} URL permissions.`);

        // 3. Ensure Training Content exists
        const trainingCount = await pool.query("SELECT count(*) FROM training_categories");
        if (trainingCount.rows[0].count === "0") {
            console.log("🌱 Seeding training categories...");
            const catRes = await pool.query(`
                INSERT INTO training_categories (title, status, created_at, updated_at)
                VALUES ('Service Excellence', 'Active', NOW(), NOW()) RETURNING id
            `);
            const catId = catRes.rows[0].id;
            
            await pool.query(`
                INSERT INTO training_subcategories (category_id, title, status, created_at)
                VALUES ($1, 'Customer Communication', 'Active', NOW())
            `, [catId]);
            console.log("✅ Seeded initial training content.");
        }

        console.log("✨ All fixes applied successfully!");
    } catch (err) {
        console.error("❌ Error applying fixes:", err);
    } finally {
        await pool.end();
    }
}

fix();
