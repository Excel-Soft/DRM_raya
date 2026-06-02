require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  try {
    const userFullName = "fakhar";
    const userId = "0dccb495-9eb3-4ad8-923d-5e6a9677beff";
    const dateFrom = new Date("2026-05-01T00:00:00Z");
    const dateTo = new Date("2026-05-31T23:59:59Z");
    
    const targetRes = await pool.query(
      `SELECT SUM(
           CASE 
             WHEN CAST(target AS NUMERIC) > 0 AND CAST(price AS NUMERIC) > 0 THEN CAST(target AS NUMERIC) * CAST(price AS NUMERIC)
             WHEN CAST(total AS NUMERIC) > 0 THEN CAST(total AS NUMERIC)
             ELSE CAST(target AS NUMERIC)
           END
         ) as target_amount 
         FROM drm.target_system_user_targets 
         WHERE (user_id = $1 OR user_id = $4)
           AND start_date <= $2 
           AND end_date >= $3`,
      [userFullName, dateTo, dateFrom, userId]
    );
    console.log("Query Result:", targetRes.rows[0]);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
check();
