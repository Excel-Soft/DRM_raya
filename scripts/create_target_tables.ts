import { pool } from "../server/db";

async function createTables() {
  const client = await pool.connect();
  try {
    console.log("Creating target_system_daily_targets...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS drm.target_system_daily_targets (
        id SERIAL PRIMARY KEY,
        role TEXT NOT NULL,
        method TEXT NOT NULL,
        target INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    console.log("Creating target_system_user_targets...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS drm.target_system_user_targets (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        target_name TEXT NOT NULL,
        category TEXT NOT NULL,
        target TEXT NOT NULL DEFAULT '0',
        price NUMERIC(12,2) NOT NULL DEFAULT 0,
        bonus TEXT,
        vas NUMERIC(12,2) NOT NULL DEFAULT 0,
        kwa NUMERIC(12,2) NOT NULL DEFAULT 0,
        reward NUMERIC(12,2) NOT NULL DEFAULT 0,
        total NUMERIC(12,2) NOT NULL DEFAULT 0,
        start_date TIMESTAMP,
        end_date TIMESTAMP,
        sign_date TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    console.log("Creating target_system_kwa_records...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS drm.target_system_kwa_records (
        id SERIAL PRIMARY KEY,
        company TEXT NOT NULL,
        employee TEXT NOT NULL,
        kwa NUMERIC(12,2) NOT NULL DEFAULT 0,
        detail TEXT,
        remaining NUMERIC(12,2) NOT NULL DEFAULT 0,
        type TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    console.log("Tables created successfully.");
  } catch (error) {
    console.error("Error creating tables:", error);
  } finally {
    client.release();
    pool.end();
  }
}

createTables();
