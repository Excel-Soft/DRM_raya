import { pool } from "./server/db";

async function run() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS leave_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        user_name VARCHAR(255),
        reason TEXT,
        type VARCHAR(50),
        start_date DATE,
        end_date DATE,
        status VARCHAR(50) DEFAULT 'Pending',
        approved_by_user_id UUID REFERENCES users(id),
        rejection_reason TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log("leave_requests table created successfully.");
  } catch (err) {
    console.error("Error creating leave_requests table:", err);
  } finally {
    process.exit(0);
  }
}

run();
