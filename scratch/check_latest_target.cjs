require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  try {
    console.log("=== Latest 5 Targets ===");
    const targetsRes = await pool.query(`SELECT id, user_id, target_name, target, price, total, start_date, end_date FROM drm.target_system_user_targets ORDER BY created_at DESC LIMIT 5`);
    console.table(targetsRes.rows);

    if (targetsRes.rows.length > 0) {
      const latestTarget = targetsRes.rows[0];
      const userId = latestTarget.user_id;

      // Also get the user's name
      const userRes = await pool.query(`SELECT full_name, username FROM drm.users WHERE id = $1 OR full_name = $1 OR username = $1 LIMIT 1`, [userId]);
      const userFullName = userRes.rows[0]?.full_name || userRes.rows[0]?.username || userId;
      
      console.log(`\nTesting API logic for user_id/name: ${userId} / ${userFullName}`);

      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
      
      const targetQuery = await pool.query(
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
        [userFullName, endOfMonth, startOfMonth, userId]
      );
      
      console.log("API target_amount result:", targetQuery.rows[0].target_amount);
    }
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
check();
