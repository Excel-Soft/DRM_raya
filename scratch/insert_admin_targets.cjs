require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function insertTargets() {
  try {
    const userIds = [
      '00e97543-f362-46d4-a6a8-e397998d99db', // nisar (account_manager)
      '9ea6656a-bed3-4549-b60d-cba847c1c5ab', // talha (admin)
      '512a8be4-e78c-4f7d-afbb-8c6740007ba5'  // admin
    ];

    for (const uid of userIds) {
      await pool.query(`
        INSERT INTO drm.target_system_user_targets 
        (user_id, target_name, category, target, price, vas, kwa, reward, total, start_date, end_date)
        VALUES ($1, 'Test Target for Admin View', 'AB New Terget', '5', '100.00', '0.00', '0.00', '0.00', '500.00', '2026-05-01', '2026-05-31')
      `, [uid]);
    }
    console.log("Inserted test targets for admin/account manager users.");
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
insertTargets();
