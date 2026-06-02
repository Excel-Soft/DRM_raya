
import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function update() {
  try {
    console.log("Connecting...");
    // Set end_date to 5 days ago for 5 active projects
    const res = await pool.query(`
      UPDATE drm.projects 
      SET end_date = NOW() - INTERVAL '5 days'
      WHERE id IN (
        SELECT id FROM drm.projects 
        WHERE status = 'Active' 
        LIMIT 5
      )
      RETURNING id, name;
    `);
    console.log(`Updated ${res.rowCount} projects to be delayed:`);
    console.table(res.rows);

    // Set end_date to 10 days in future for 5 other active projects (for Upcoming)
    const resUpcoming = await pool.query(`
      UPDATE drm.projects 
      SET end_date = NOW() + INTERVAL '10 days'
      WHERE id IN (
        SELECT id FROM drm.projects 
        WHERE status = 'Active' AND end_date IS NULL
        LIMIT 5
      )
      RETURNING id, name;
    `);
    console.log(`Updated ${resUpcoming.rowCount} projects to be upcoming:`);
    console.table(resUpcoming.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

update();
