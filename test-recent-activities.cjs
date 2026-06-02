require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(`
  select id, customer_id, created_by, type as method, activity_date, created_at, notes
  from drm.activities
  order by created_at desc
  limit 10
`, (err, res) => {
  console.log(err ? err.message : res.rows);
  pool.end();
});
