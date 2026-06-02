import { pool } from "../server/db";

async function main() {
  try {
    await pool.query(`alter table drm.meetings add column IF NOT EXISTS notes text`);
    console.log("Success adding notes column");
  } catch (err) {
    console.error("Error", err);
  }
  process.exit(0);
}
main();
