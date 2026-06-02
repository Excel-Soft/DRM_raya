import { Pool } from "pg";
import { config } from "dotenv";

config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const managers = await pool.query("SELECT id FROM drm.users WHERE role = 'sales_manager' OR role = 'lead_manager' LIMIT 1");
  if (managers.rows.length === 0) {
    console.log("no manager found");
    return;
  }
  const managerId = managers.rows[0].id;
  const res = await pool.query(
    "UPDATE drm.meetings SET created_by = $1 WHERE meeting_type = 'Team Meeting' AND created_by IS NULL",
    [managerId]
  );
  console.log(`Updated ${res.rowCount} meetings to belong to manager ${managerId}`);
  pool.end();
}

main().catch(console.error);
