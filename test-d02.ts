import { pool } from "./server/db";

async function main() {
  try {
    console.log("=== Finding Sales Executives ===");
    const usersRes = await pool.query(`SELECT id, full_name, email, role FROM drm.users WHERE role = 'sales_executive' LIMIT 5;`);
    const users = usersRes.rows;
    console.log("Found users:", users);

    if (users.length === 0) {
      console.log("No sales executives found.");
      process.exit(0);
    }

    const assignedUser = users[0];
    const unassignedUser = users.length > 1 ? users[1] : users[0];

    console.log("\n=== Checking assignments for User 1:", assignedUser.full_name, "===");
    const countRes1 = await pool.query(`SELECT COUNT(*) FROM drm.target_system_user_targets WHERE user_id = $1`, [assignedUser.full_name]);
    console.log("Assignments Count:", countRes1.rows[0].count);

    if (countRes1.rows[0].count === '0') {
      console.log("Inserting test assignments for User 1...");
      await pool.query(
        `INSERT INTO drm.target_system_user_targets (user_id, target_name, category, target, vas, price, start_date, end_date) 
         VALUES ($1, 'mobile', 'Activity', '30', '15000', '0', now() - interval '5 days', now() + interval '5 days')`,
        [assignedUser.full_name]
      );
      await pool.query(
        `INSERT INTO drm.target_system_user_targets (user_id, target_name, category, target, vas, price, start_date, end_date) 
         VALUES ($1, 'whatsapp', 'Activity', '10', '5000', '0', now() - interval '5 days', now() + interval '5 days')`,
        [assignedUser.full_name]
      );
    }

    console.log("\n=== Checking assignments for User 2:", unassignedUser.full_name, "===");
    const countRes2 = await pool.query(`SELECT COUNT(*) FROM drm.target_system_user_targets WHERE user_id = $1`, [unassignedUser.full_name]);
    console.log("Assignments Count:", countRes2.rows[0].count);

    console.log("\n=== Checking /api/sales/targets/summary SQL Equivalent ===");
    const sumField = "vas";
    const dateFrom = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const dateTo = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
    
    const targetRes = await pool.query(
      `SELECT SUM(CAST(vas AS NUMERIC)) as target_amount 
       FROM drm.target_system_user_targets 
       WHERE user_id = $1 
         AND start_date <= $2 
         AND end_date >= $3`,
      [assignedUser.full_name, dateTo, dateFrom]
    );
    console.log("User 1 VAS Summary Query Result:", targetRes.rows[0]);

    const targetRes2 = await pool.query(
      `SELECT SUM(CAST(target AS NUMERIC)) as target_amount 
       FROM drm.target_system_user_targets 
       WHERE user_id = $1 
         AND start_date <= $2 
         AND end_date >= $3`,
      [assignedUser.full_name, dateTo, dateFrom]
    );
    console.log("User 1 AB Summary Query Result:", targetRes2.rows[0]);

    const targetResUnassigned = await pool.query(
      `SELECT SUM(CAST(vas AS NUMERIC)) as target_amount 
       FROM drm.target_system_user_targets 
       WHERE user_id = $1 
         AND start_date <= $2 
         AND end_date >= $3`,
      [unassignedUser.full_name, dateTo, dateFrom]
    );
    console.log("User 2 VAS Summary Query Result (Should be null or 0):", targetResUnassigned.rows[0]);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    process.exit(0);
  }
}
main();
