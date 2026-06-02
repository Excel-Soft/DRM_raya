
import { pool } from "../server/db";

async function fixBvSchema() {
    try {
        console.log("🔧 Creating bv_entries table...");

        await pool.query(`
      CREATE TABLE IF NOT EXISTS bv_entries (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        company_name text NOT NULL,
        package_type text NOT NULL,
        amount decimal(12,2) NOT NULL,
        commission decimal(12,2),
        reward decimal(12,2),
        vas_amount decimal(12,2),
        kwa_amount decimal(12,2),
        method text,
        person_name text,
        pay_amount decimal(12,2),
        bv_amount decimal(12,2),
        entry_type text,
        type text,
        received_at timestamp DEFAULT NOW(),
        sales_person_id varchar REFERENCES users(id),
        created_by_user_id varchar REFERENCES users(id),
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW()
      );
    `);

        console.log("✅ bv_entries table created successfully.");

    } catch (err) {
        console.error("❌ Error creating table:", err);
    } finally {
        process.exit();
    }
}

fixBvSchema();
