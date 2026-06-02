const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.tdofmdaeahxfgmlmjgbp:SajjadAgent2026%21@aws-1-us-east-2.pooler.supabase.com:5432/postgres' });
pool.query(`
  select coalesce(fsd.method, fu.method) as method, 
         coalesce(fu.date_time, fu.created_at) as dt, 
         fu.created_at as created, 
         fu.assigned_to, 
         fu.created_by, 
         fsd.talk_time_minutes 
  from follow_ups fu 
  left join followup_subservice_details fsd on fsd.followup_id = fu.id 
  order by fu.created_at desc 
  limit 5
`, (err, res) => {
  console.log(err || res.rows);
  pool.end();
});
