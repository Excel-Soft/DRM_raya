
import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fix() {
  try {
    console.log("Connecting...");
    const res = await pool.query(`
      UPDATE drm.projects 
      SET end_date = NOW() + INTERVAL '4 days'
      WHERE id IN (
        SELECT id FROM drm.projects 
        WHERE status = 'Active' AND end_date > NOW()
        LIMIT 5
      );
    `);
    console.log(`Adjusted ${res.rowCount} upcoming projects.`);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

fix();
