import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function fixDbAll() {
  try {
    console.log("Adding missing columns to account_heads...");
    
    // Add category (enum text)
    await db.execute(sql`ALTER TABLE drm.account_heads ADD COLUMN IF NOT EXISTS category TEXT;`);
    await db.execute(sql`UPDATE drm.account_heads SET category = 'Expenses' WHERE category IS NULL;`);
    await db.execute(sql`ALTER TABLE drm.account_heads ALTER COLUMN category SET NOT NULL;`);
    
    // Add description
    await db.execute(sql`ALTER TABLE drm.account_heads ADD COLUMN IF NOT EXISTS description TEXT;`);
    
    // Add is_active
    await db.execute(sql`ALTER TABLE drm.account_heads ADD COLUMN IF NOT EXISTS is_active INTEGER DEFAULT 1;`);
    await db.execute(sql`UPDATE drm.account_heads SET is_active = 1 WHERE is_active IS NULL;`);
    await db.execute(sql`ALTER TABLE drm.account_heads ALTER COLUMN is_active SET NOT NULL;`);
    
    // Add created_by_user_id
    await db.execute(sql`ALTER TABLE drm.account_heads ADD COLUMN IF NOT EXISTS created_by_user_id VARCHAR;`);
    
    console.log("Successfully updated the database schema.");
  } catch (err) {
    console.error("Error updating schema:", err);
  }
  process.exit(0);
}

fixDbAll();
