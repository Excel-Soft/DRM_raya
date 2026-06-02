import { pool } from "../server/db";

async function main() {
  const { rows } = await pool.query(`
    SELECT id, drm_id, company_name, sales_person_id, sales_person_name, created_by, status, approval_status, final_status
    FROM drm.gm_entries
    WHERE company_name ILIKE '%Excels%' OR company_name ILIKE '%talha%' OR sales_person_name ILIKE '%talha%'
    ORDER BY created_at DESC LIMIT 10
  `);
  console.log("GM Entries:", JSON.stringify(rows, null, 2));

  // Let's also check project details
  const { rows: projects } = await pool.query(`
    SELECT id, name, owner_user_id, status FROM drm.projects
    WHERE name ILIKE '%Excels%' OR name ILIKE '%talha%'
    ORDER BY created_at DESC LIMIT 10
  `);
  console.log("Projects:", JSON.stringify(projects, null, 2));
}

main().catch(console.error).finally(() => process.exit(0));
