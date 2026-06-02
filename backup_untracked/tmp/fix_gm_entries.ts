import { pool } from "../server/db";

async function main() {
    console.log("Fixing gm_entries installments column...");

    try {
        await pool.query("ALTER TABLE gm_entries ADD COLUMN IF NOT EXISTS installments jsonb DEFAULT '[]'::jsonb");
        console.log("OK: ALTER TABLE gm_entries ADD COLUMN IF NOT EXISTS installments jsonb");
    } catch (err: any) {
        console.log("SKIP/ERROR:", err.message);
    }

    process.exit(0);
}
main();
