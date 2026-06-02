import { pool } from './server/db';
async function main() {
  await pool.query("update overtime_records set user_id = '64b855c8-1136-4d7a-bc8c-17f172e65199', task_title = 'Missing Task', reason = 'Missing Task' where reason = 'faisal '");
  await pool.query("update overtime_records set user_id = 'b29868ad-e13c-4aed-8c70-444639c3bfaf', task_title = 'Missing Task', reason = 'Missing Task' where reason = 'bilal'");
  await pool.query("update overtime_records set task_title = 'tertertretet' where reason = 'tertertretet'");
  console.log('done');
  process.exit(0);
}
main();
