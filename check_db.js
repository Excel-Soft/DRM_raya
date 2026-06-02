require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query("SELECT name FROM drm.attributes WHERE category='Job Designation'", (err, res) => {
  if (err) console.error(err);
  else console.log(res.rows);
  pool.end();
});
