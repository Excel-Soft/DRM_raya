
import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    console.log("Connecting...");
    // Check projects status and end_date
    const res = await pool.query(`
      SELECT id, name, status, end_date, owner_user_id 
      FROM drm.projects 
      LIMIT 10;
    `);
    console.log("Projects Sample Data:");
    console.table(res.rows);

    const counts = await pool.query(`
      SELECT 
        status, 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE end_date IS NULL) as null_end_date,
        COUNT(*) FILTER (WHERE end_date < NOW()) as passed_deadline
      FROM drm.projects 
      GROUP BY status;
    `);
    console.log("Project Statistics by Status:");
    console.table(counts.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

check();
