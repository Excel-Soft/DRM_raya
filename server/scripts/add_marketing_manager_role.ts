import { db } from "../db";
import { sql } from "drizzle-orm";

async function main() {
    try {
        console.log("Adding Marketing Manager role...");

        // Insert 'marketing_manager' role
        await db.execute(sql`
            INSERT INTO drm.roles (name) 
            SELECT 'marketing_manager'
            WHERE NOT EXISTS (SELECT 1 FROM drm.roles WHERE name = 'marketing_manager')
        `);

        // Add 'Marketing Manager' to attributes
        await db.execute(sql`
            INSERT INTO drm.attributes (name, category) 
            SELECT 'Marketing Manager', 'Job Designation'
            WHERE NOT EXISTS (
                SELECT 1 FROM drm.attributes 
                WHERE name = 'Marketing Manager' AND category = 'Job Designation'
            )
        `);

        console.log("Roles and attributes updated successfully.");

    } catch (error) {
        console.error("Error managing roles/attributes:", error);
    } finally {
        process.exit(0);
    }
}

main();
