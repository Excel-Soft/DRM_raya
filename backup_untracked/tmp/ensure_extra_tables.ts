import { pool } from "../server/db";

async function main() {
    console.log("Ensuring extra schemas and tables exist...");

    try {
        await pool.query("CREATE SCHEMA IF NOT EXISTS drm");
        console.log("OK: Schema 'drm' ensured.");

        await pool.query(`
            CREATE TABLE IF NOT EXISTS drm.menu_permissions (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                name text NOT NULL,
                menu_icon text DEFAULT 'Home',
                permissions jsonb DEFAULT '[]'::jsonb,
                sub_urls jsonb DEFAULT '{"isRoot": true, "items": []}'::jsonb,
                allowed_role_ids text[] DEFAULT '{}'::text[],
                is_active boolean DEFAULT true,
                created_at timestamptz DEFAULT now(),
                updated_at timestamptz DEFAULT now()
            )
        `);
        console.log("OK: Table 'drm.menu_permissions' ensured.");

        // Also ensure bv_reports if it's causing issues
        await pool.query(`
            CREATE TABLE IF NOT EXISTS bv_reports (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id uuid NOT NULL,
                customer_id uuid,
                report_date timestamptz NOT NULL DEFAULT now(),
                status text NOT NULL DEFAULT 'Draft',
                title text,
                summary text,
                notes text,
                total_tasks int NOT NULL DEFAULT 0,
                value_sold numeric(14,2) NOT NULL DEFAULT 0,
                success_rate numeric(6,2) NOT NULL DEFAULT 0,
                follow_ups_done int NOT NULL DEFAULT 0,
                missed_leads int NOT NULL DEFAULT 0,
                meta jsonb,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NOT NULL DEFAULT now(),
                assigned_to uuid,
                company_name text
            )
        `);
        console.log("OK: Table 'bv_reports' ensured.");

    } catch (err: any) {
        console.log("ERROR:", err.message);
    }

    process.exit(0);
}
main();
