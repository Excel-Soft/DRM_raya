import { pool } from "../db";

async function createPoliciesTable() {
  console.log("Creating policies table...");
  const sql = `
    CREATE TABLE IF NOT EXISTS drm.drm_policies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      head TEXT NOT NULL,
      type TEXT,
      file_url TEXT,
      penalty DECIMAL(10, 2),
      min_allow INTEGER,
      max_allow INTEGER,
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  try {
    await pool.query(sql);
    console.log("Policies table created successfully (if it didn't exist).");
  } catch (err) {
    console.error("Failed to create policies table:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createPoliciesTable();
