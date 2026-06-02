require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query("SELECT name FROM drm.attributes WHERE category='Job Designation'", (err, res) => {
  if (err) console.error(err);
  else console.log(res.rows);
  pool.query("SELECT name FROM drm.roles", (err2, res2) => {
      console.log(res2.rows);
      pool.end();
  });
});
