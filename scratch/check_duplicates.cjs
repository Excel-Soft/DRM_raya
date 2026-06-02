require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  try {
    const res = await pool.query(`
        select fu.id, fu.created_at, fu.due_at, fu.date_time, c.company_name, s.name as service_name, fsd.purpose
          from drm.follow_ups fu
          left join drm.customers c on c.id::text = fu.customer_id::text
          left join drm.followup_services fs on fs.followup_id = fu.id
          left join drm.services s on s.id = fs.service_id
          left join drm.followup_subservice_details fsd on fsd.followup_id = fu.id and fsd.service_id = s.id
          where c.company_name in ('shahzad', 'Coffey Mckay Plc')
          order by c.company_name, fu.created_at desc
    `);
    console.table(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
check();
