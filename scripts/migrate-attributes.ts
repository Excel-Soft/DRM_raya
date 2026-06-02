
import { pool } from "../server/db";

async function migrateAttributes() {
    try {
        console.log("🔧 Creating attributes table...");

        await pool.query(`
      CREATE TABLE IF NOT EXISTS attributes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        category varchar(100) NOT NULL,
        name text NOT NULL,
        created_at timestamp NOT NULL DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_attributes_category ON attributes(category);
    `);

        console.log("✅ Attributes table created successfully.");

    } catch (err: any) {
        console.error("❌ Error creating attributes table:", err);
    } finally {
        process.exit();
    }
}

migrateAttributes();
