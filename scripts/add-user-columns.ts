
import { pool } from "../server/db";

async function runMigration() {
    console.log("Running migration: Adding department, designation, phone to users table...");

    try {
        // Add columns if they don't exist
        await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='department') THEN
          ALTER TABLE users ADD COLUMN department TEXT;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='designation') THEN
          ALTER TABLE users ADD COLUMN designation TEXT;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='phone') THEN
          ALTER TABLE users ADD COLUMN phone TEXT;
        END IF;
      END
      $$;
    `);

        console.log("Migration completed successfully!");
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        process.exit();
    }
}

runMigration();
