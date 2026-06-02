
import { pool } from "../server/db";

async function fixGmSchemaFinal() {
    try {
        console.log("🔧 Fixing gm_entries schema (FINAL)...");

        await pool.query(`
      ALTER TABLE gm_entries 
      ADD COLUMN IF NOT EXISTS gm_type text DEFAULT 'GM',
      ADD COLUMN IF NOT EXISTS drm_id text,
      ADD COLUMN IF NOT EXISTS member_id text,
      ADD COLUMN IF NOT EXISTS order_id text,
      ADD COLUMN IF NOT EXISTS company_name text,
      ADD COLUMN IF NOT EXISTS sales_person_id varchar,
      ADD COLUMN IF NOT EXISTS sales_person_name text,
      ADD COLUMN IF NOT EXISTS added_by_id varchar,
      ADD COLUMN IF NOT EXISTS added_by_name text,
      ADD COLUMN IF NOT EXISTS package_type text,
      ADD COLUMN IF NOT EXISTS entry_type text,
      ADD COLUMN IF NOT EXISTS amount_usd decimal,
      ADD COLUMN IF NOT EXISTS customer_dollar decimal,
      ADD COLUMN IF NOT EXISTS dollar_rate decimal,
      ADD COLUMN IF NOT EXISTS amount_pkr decimal,
      ADD COLUMN IF NOT EXISTS alibaba_discount_usd decimal,
      ADD COLUMN IF NOT EXISTS final_order_usd decimal,
      ADD COLUMN IF NOT EXISTS extra_discount_usd decimal,
      ADD COLUMN IF NOT EXISTS extra_discount_pkr decimal,
      ADD COLUMN IF NOT EXISTS status text DEFAULT 'Pending',
      ADD COLUMN IF NOT EXISTS is_loan integer DEFAULT 0,
      ADD COLUMN IF NOT EXISTS is_partial_payment integer DEFAULT 0,
      ADD COLUMN IF NOT EXISTS notes text,
      ADD COLUMN IF NOT EXISTS approved_by_user_id varchar,
      ADD COLUMN IF NOT EXISTS approved_at timestamp,
      ADD COLUMN IF NOT EXISTS created_by_user_id varchar,
      ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT NOW();
    `);

        console.log("✅ Schema updated successfully (ALL columns checked).");

    } catch (err) {
        console.error("❌ Error fixing schema:", err);
    } finally {
        process.exit();
    }
}

fixGmSchemaFinal();
