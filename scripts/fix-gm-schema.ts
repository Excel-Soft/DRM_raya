
import { pool } from "../server/db";

async function fixGmSchema() {
    try {
        console.log("🔧 Fixing gm_entries schema...");

        await pool.query(`
      ALTER TABLE gm_entries 
      ADD COLUMN IF NOT EXISTS sales_person_id varchar,
      ADD COLUMN IF NOT EXISTS sales_person_name text,
      ADD COLUMN IF NOT EXISTS final_order_usd decimal,
      ADD COLUMN IF NOT EXISTS entry_type text,
      ADD COLUMN IF NOT EXISTS gm_type text,
      ADD COLUMN IF NOT EXISTS drm_id text,
      ADD COLUMN IF NOT EXISTS package_type text;
    `);

        console.log("✅ Schema updated successfully.");

    } catch (err) {
        console.error("❌ Error fixing schema:", err);
    } finally {
        process.exit();
    }
}

fixGmSchema();
