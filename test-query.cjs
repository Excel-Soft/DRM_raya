require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(`
  select coalesce(fsd.method, fu.method) as method, 
         count(*)::int as count,
         sum(coalesce(fsd.talk_time_minutes, 0))::int as talk_time_minutes
  from drm.follow_ups fu
  left join drm.followup_subservice_details fsd on fsd.followup_id = fu.id
  where coalesce(fu.is_deleted,false)=false 
  group by coalesce(fsd.method, fu.method)
`, (err, res) => {
  console.log(err ? err.message : res.rows);
  pool.end();
});
