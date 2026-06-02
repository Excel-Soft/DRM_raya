<<<<<<< HEAD
import { pool } from '../server/db';
async function test() {
  const o = await pool.query('select count(*) from drm.product_posting_invoices');
  console.log('Total invoices:', o.rows[0].count);
  const o2 = await pool.query('select sales_exec_id, count(*) from drm.product_posting_invoices group by sales_exec_id');
  console.log('Invoices by user:', o2.rows);
  const u = await pool.query('select id, username, full_name from drm.users where id in (select sales_exec_id from drm.product_posting_invoices)');
  console.log('Users who have invoices:', u.rows);
  process.exit(0);
}
test();
=======
import { pool } from "../server/db";

async function check() {
    const res = await pool.query("SELECT * FROM drm.meetings ORDER BY start_time DESC LIMIT 5");
    console.log(res.rows);
    process.exit(0);
}

check();
>>>>>>> 697d41e (fix(rbac): hide loan report actions and filters for non-managers)
