require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  try {
    const userFullName = "fakhar";
    const userId = "0dccb495-9eb3-4ad8-923d-5e6a9677beff";
    
    // Simulate what getDateRangeFromPeriodParam("thisMonth") returns
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
    
    const dateFrom = startOfMonth;
    const dateTo = endOfMonth;
    
    console.log("dateFrom:", dateFrom, "dateTo:", dateTo);

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
           AND (start_date IS NULL OR start_date <= $2)
           AND (end_date IS NULL OR end_date >= $3)`,
      [userFullName, dateTo, dateFrom, userId]
    );
    console.log("Query Result:", targetRes.rows[0]);
    
    const targets = await pool.query(`SELECT * FROM drm.target_system_user_targets WHERE user_id = $1 OR user_id = $2`, [userFullName, userId]);
    console.log("All targets for fakhar:", targets.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
check();
