import { pool } from "./server/db";

async function run() {
  try {
    console.log("Creating target_system_targets table...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS drm.target_system_targets (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        target_name TEXT NOT NULL,
        package TEXT,
        reward INTEGER NOT NULL DEFAULT 0,
        bonus TEXT,
        price DECIMAL(12, 2) NOT NULL DEFAULT 0,
        max_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
        penalty DECIMAL(12, 2) NOT NULL DEFAULT 0,
        amount TEXT,
        number INTEGER NOT NULL DEFAULT 0,
        kwa INTEGER NOT NULL DEFAULT 0,
        vas INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log("Table created successfully.");
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
