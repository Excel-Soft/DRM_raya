import { db } from "../db";
import { sql } from "drizzle-orm";

async function main() {
    try {
        console.log("Checking for restricted_keywords table...");
        
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS drm.restricted_keywords (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                keyword TEXT NOT NULL UNIQUE,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            );
        `);
        
        console.log("Table drm.restricted_keywords created or already exists.");
    } catch (error) {
        console.error("Error creating table:", error);
    } finally {
        process.exit(0);
    }
}

main();
