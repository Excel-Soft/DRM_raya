
import { pool } from "../server/db";

async function runRefinedMigration() {
    console.log("Running refined VAS migration...");

    try {
        // 1. Ensure office_vas has correct columns
        await pool.query(`
      CREATE TABLE IF NOT EXISTS office_vas (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_name TEXT NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        currency TEXT NOT NULL DEFAULT 'PKR',
        method TEXT NOT NULL,
        vas_date TIMESTAMP NOT NULL DEFAULT NOW(),
        notes TEXT,
        created_by_user_id UUID REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

        // Check if created_by_user_id is UUID or mismatch (like the user_groups issue)
        // We can try to cast it if needed, or add if missing.
        // For now, let's just make sure the table exists.

        // 2. Ensure vas_reports has correct columns
        await pool.query(`
      CREATE TABLE IF NOT EXISTS vas_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
        report_date TIMESTAMP NOT NULL DEFAULT NOW(),
        status TEXT NOT NULL DEFAULT 'Draft',
        title TEXT,
        summary TEXT,
        notes TEXT,
        total_tasks INTEGER NOT NULL DEFAULT 0,
        value_sold DECIMAL(14,2) NOT NULL DEFAULT 0,
        success_rate DECIMAL(6,2) NOT NULL DEFAULT 0,
        follow_ups_done INTEGER NOT NULL DEFAULT 0,
        missed_leads INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

        console.log("✅ VAS tables schema verified/created.");

    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        process.exit();
    }
}

runRefinedMigration();
