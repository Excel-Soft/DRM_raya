import { pool } from "../server/db";

async function run() {
    try {
        await pool.query(`
      ALTER TABLE temp_contacts 
      ADD COLUMN IF NOT EXISTS user_id varchar(255),
      ADD COLUMN IF NOT EXISTS title text,
      ADD COLUMN IF NOT EXISTS person_name text,
      ADD COLUMN IF NOT EXISTS mobile text,
      ADD COLUMN IF NOT EXISTS country text,
      ADD COLUMN IF NOT EXISTS drm_id text,
      ADD COLUMN IF NOT EXISTS source text,
      ADD COLUMN IF NOT EXISTS grade text,
      ADD COLUMN IF NOT EXISTS comment text,
      ADD COLUMN IF NOT EXISTS service_types text[],
      ADD COLUMN IF NOT EXISTS status text DEFAULT 'Pending',
      ADD COLUMN IF NOT EXISTS promoted_to_customer_id varchar(255),
      ADD COLUMN IF NOT EXISTS promoted_at timestamp with time zone,
      ADD COLUMN IF NOT EXISTS promoted_by_user_id varchar(255);
    `);
        console.log("temp_contacts altered successfully");
    } catch (err) {
        console.error("Error:", err);
    }
    process.exit();
}
run();
