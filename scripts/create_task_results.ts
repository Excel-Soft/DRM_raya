import { pool } from "../server/db";

async function createTables() {
  const client = await pool.connect();
  try {
    console.log("Creating task_results table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS drm.task_results (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id UUID NOT NULL REFERENCES drm.tasks(id) ON DELETE CASCADE UNIQUE,
        links_posted INTEGER NOT NULL DEFAULT 0,
        total_duration_minutes INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
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
