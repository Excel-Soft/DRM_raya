import { pool } from "./server/db";

async function run() {
  const gms = await pool.query("SELECT id, company_name FROM drm.gm_entries WHERE approval_status IS NULL OR approval_status = 'pending_hod'");
  console.log("GM Count:", gms.rows.length);
  process.exit(0);
}
run();
