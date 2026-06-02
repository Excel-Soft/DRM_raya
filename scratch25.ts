import { pool } from "./server/db";

async function checkGmStatus() {
  try {
    const res = await pool.query("SELECT payment_status FROM drm.gm_entries LIMIT 10");
    console.log(res.rows);
  } catch(e) {
    console.error(e);
  }
  process.exit();
}
checkGmStatus();
