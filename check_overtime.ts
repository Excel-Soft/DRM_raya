import { pool } from "./server/db";
async function main() {
  const res = await pool.query("SELECT id, user_id, task_title, task_details, time_spent FROM overtime_records");
  console.log(res.rows);
  process.exit(0);
}
main();
