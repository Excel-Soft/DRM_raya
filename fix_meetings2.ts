import { Pool } from "pg";
import { config } from "dotenv";

config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const res = await pool.query(
    "UPDATE drm.meetings SET status = 'ended', end_time = now(), notes = 'Auto-ended during system fix' WHERE meeting_type = 'Team Meeting' AND status = 'in_progress'"
  );
  console.log(`Ended ${res.rowCount} stuck meetings`);
  pool.end();
}

main().catch(console.error);
