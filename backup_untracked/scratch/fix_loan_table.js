
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
    await pool.query(`
      ALTER TABLE drm.loan_requests 
      ADD COLUMN IF NOT EXISTS installment_amount NUMERIC(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS remaining_amount NUMERIC(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS detail TEXT,
      ADD COLUMN IF NOT EXISTS manager_approved_by_user_id UUID,
      ADD COLUMN IF NOT EXISTS manager_approved_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS hod_approved_by_user_id UUID,
      ADD COLUMN IF NOT EXISTS hod_approved_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
    `);
    console.log("Database table drm.loan_requests updated successfully!");
  } catch (err) {
    console.error("Failed to update database:", err);
  } finally {
    await pool.end();
  }
}

fix();
