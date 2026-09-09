import { db } from "../db";
import { sql } from "drizzle-orm";

async function main() {
    try {
        console.log("Cleaning up roles and attributes...");

        // 1. Delete lowercase 'manager' role
        await db.execute(sql`DELETE FROM drm.roles WHERE name = 'manager'`);
        
        // 2. Insert 'reception_manager' role (lowercase pattern)
        await db.execute(sql`
            INSERT INTO drm.roles (name) 
            SELECT 'reception_manager'
            WHERE NOT EXISTS (SELECT 1 FROM drm.roles WHERE name = 'reception_manager')
        `);

        // 3. Delete 'Manager' if it exists in attributes
        await db.execute(sql`
            DELETE FROM drm.attributes 
            WHERE category = 'Job Designation' AND (name ILIKE 'manager' OR name ILIKE 'MANAGER')
        `);

        // 4. Add 'Reception Manager' to attributes
        await db.execute(sql`
            INSERT INTO drm.attributes (name, category) 
            SELECT 'Reception Manager', 'Job Designation'
            WHERE NOT EXISTS (
                SELECT 1 FROM drm.attributes 
                WHERE name = 'Reception Manager' AND category = 'Job Designation'
            )
        `);

        console.log("Roles and attributes synchronized successfully.");

    } catch (error) {
        console.error("Error managing roles/attributes:", error);
    } finally {
        process.exit(0);
    }
}

main();
