import { pool } from "../server/db";

async function createTable() {
  try {
    // Actually the app expects id to be varchar, but users.id is UUID.
    // Let's create impersonation_audit_logs with admin_user_id as uuid.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS drm.impersonation_audit_logs (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
        admin_user_id UUID NOT NULL REFERENCES drm.users(id),
        target_role VARCHAR NOT NULL,
        action TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    console.log("Table impersonation_audit_logs created in drm schema.");
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

createTable();
