import { pool } from "../server/db";

async function test() {
  const role = "sales_manager";
  const query = `
    SELECT id, name, full_name, email 
    FROM drm.users 
    WHERE (is_active = true OR is_active IS NULL) 
    AND (role_id = $1 OR role = $1 OR roles @> $2::jsonb)
  `;
  try {
    const result = await pool.query(query, [role, JSON.stringify([role])]);
    console.log("Success:", result.rows);
  } catch (error: any) {
    console.error("DB Query Error:", error.message);
  }
  process.exit(0);
}
test();
