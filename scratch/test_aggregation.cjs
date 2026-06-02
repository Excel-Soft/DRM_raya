require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  try {
    const res = await pool.query(`
        select fu.id,
               fu.created_at,
               fu.due_at,
               c.company_name,
               string_agg(distinct s.name, ', ') as service_name,
               string_agg(distinct ss.name, ', ') as subservice_name,
               string_agg(distinct fsd.purpose, ', ') as purpose,
               coalesce(max(fsd.grade), c.grade) as grade
          from drm.follow_ups fu
          left join drm.customers c on c.id::text = fu.customer_id::text
          left join drm.followup_services fs on fs.followup_id = fu.id
          left join drm.services s on s.id = fs.service_id
          left join drm.followup_subservice_details fsd on fsd.followup_id = fu.id and fsd.service_id = s.id
          left join drm.service_subservices ss on ss.id = fsd.subservice_id
          where c.company_name in ('shahzad', 'Coffey Mckay Plc')
          group by fu.id, c.id
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
