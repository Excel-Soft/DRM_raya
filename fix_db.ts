import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function fixDb() {
  try {
    // Check if table exists
    console.log("Adding code column...");
    await db.execute(sql`ALTER TABLE drm.account_heads ADD COLUMN IF NOT EXISTS code TEXT;`);
    
    // Set dummy codes for any existing rows that have null code
    await db.execute(sql`UPDATE drm.account_heads SET code = gen_random_uuid()::text WHERE code IS NULL;`);
    
    // Now make it not null and unique
    await db.execute(sql`ALTER TABLE drm.account_heads ALTER COLUMN code SET NOT NULL;`);
    await db.execute(sql`ALTER TABLE drm.account_heads ADD CONSTRAINT account_heads_code_unique UNIQUE (code);`);
    
    console.log("Successfully updated the database schema.");
  } catch (err) {
    console.error("Error updating schema:", err);
  }
  process.exit(0);
}

fixDb();
