require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(`
  select fu.id, fu.customer_id, fu.assigned_to, fu.created_by, fu.method as fu_method, fsd.method as fsd_method, 
         fu.created_at, fu.date_time, fsd.talk_time_minutes
  from drm.follow_ups fu
  left join drm.followup_subservice_details fsd on fsd.followup_id = fu.id
  order by fu.created_at desc
  limit 10
`, (err, res) => {
  console.log(err ? err.message : res.rows);
  pool.end();
});
