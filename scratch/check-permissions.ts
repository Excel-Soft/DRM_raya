import { pool } from "../server/db";

async function main() {
  const result = await pool.query("select id, path, allowed_role_ids from drm.url_permissions");
  console.log("=== Url Permissions ===");
  for (const row of result.rows) {
    console.log(`Path: ${row.path}\n  Allowed Roles: ${JSON.stringify(row.allowed_role_ids)}`);
  }
}

main().catch(console.error).finally(() => process.exit(0));
