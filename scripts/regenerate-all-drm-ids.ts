
import { pool } from "../server/db";
import { generateDrmId } from "../server/utils/drm-id-utils";

async function migrate() {
    console.log("Starting DRM ID regeneration...");
    const client = await pool.connect();
    try {
        const res = await client.query("SELECT id, company_name, country, drm_id FROM customers");
        const customers = res.rows;
        console.log(`Found ${customers.length} customers to update.`);

        let updatedCount = 0;
        for (const c of customers) {
            const newDrmId = generateDrmId(c.company_name, c.country, c.id);

            // Only update if different (though logic changed, so most will be different)
            if (newDrmId !== c.drm_id) {
                await client.query("UPDATE customers SET drm_id = $1 WHERE id = $2", [newDrmId, c.id]);
                updatedCount++;
                if (updatedCount % 10 === 0) process.stdout.write(".");
            }
        }
        console.log(`\nDefault DONE. Updated ${updatedCount} customers.`);

    } catch (e) {
        console.error("Migration failed:", e);
    } finally {
        client.release();
        process.exit(0);
    }
}

migrate();
