import { pool } from "../server/db.ts";

async function main() {
  const result = await pool.query("SELECT id, name, username, email, role, role_id, roles, is_active FROM drm.users WHERE id = $1", ["64b855c8-1136-4d7a-bc8c-17f172e65199"]);
  console.log("Faisal user details:", result.rows[0]);
}

main().catch(console.error).finally(() => pool.end());
