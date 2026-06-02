
import { pool } from "../server/db";

async function runFix() {
    console.log("Running schema fix: Recreating user_groups and user_group_members...");

    try {
        // 1. Drop the incorrect tables if they exist (to restart fresh for these tables)
        // using CASCADE to drop dependencies
        await pool.query(`DROP TABLE IF EXISTS user_group_members CASCADE`);
        await pool.query(`DROP TABLE IF EXISTS user_groups CASCADE`);

        // 2. Create user_groups correctly
        await pool.query(`
      CREATE TABLE IF NOT EXISTS user_groups (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        description text,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
    `);
        console.log("✓ user_groups table created.");

        // 3. Create user_group_members with correct UUID type for user_id
        await pool.query(`
      CREATE TABLE IF NOT EXISTS user_group_members (
        group_id uuid REFERENCES user_groups(id) ON DELETE CASCADE,
        user_id uuid REFERENCES users(id) ON DELETE CASCADE,
        joined_at timestamptz DEFAULT now(),
        PRIMARY KEY (group_id, user_id)
      );
    `);
        console.log("✓ user_group_members table created with correct UUID types.");

    } catch (err) {
        console.error("Schema fix failed:", err);
    } finally {
        process.exit();
    }
}

runFix();
