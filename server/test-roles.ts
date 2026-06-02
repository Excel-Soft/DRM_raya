import { pool } from "./db";

async function test() {
  try {
    const res = await pool.query("SELECT DISTINCT role, role_id FROM drm.users");
    console.log("Roles in DB:", res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
test();
