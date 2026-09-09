import { db } from "../db";
import { sql } from "drizzle-orm";

async function main() {
    try {
        console.log("Checking for product_posting_data table...");
        
        // Manual SQL for create table in drm schema
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS drm.product_posting_data (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                category TEXT NOT NULL,
                title TEXT,
                keywords TEXT,
                description TEXT,
                main_image TEXT,
                other_images JSONB DEFAULT '[]'::jsonb,
                platform TEXT,
                status TEXT NOT NULL DEFAULT 'Pending',
                user_id UUID REFERENCES drm.users(id),
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            );
        `);
        
        console.log("Table drm.product_posting_data created or already exists.");
    } catch (error) {
        console.error("Error creating table:", error);
    } finally {
        process.exit(0);
    }
}

main();
