import { pool } from "../db";

async function createNoticesTable() {
  console.log("Creating notices table...");
  const sql = `
    DO $$ 
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notice_status' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'drm')) THEN
            CREATE TYPE drm.notice_status AS ENUM ('Active', 'Inactive', 'Archived');
        END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS drm.notices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status drm.notice_status DEFAULT 'Active',
      assigned_by_user_id UUID REFERENCES drm.users(id),
      assigned_to_role TEXT,
      assigned_to_department TEXT,
      assigned_date TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  try {
    await pool.query(sql);
    console.log("Notices table created successfully (if it didn't exist).");
  } catch (err) {
    console.error("Failed to create notices table:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createNoticesTable();
