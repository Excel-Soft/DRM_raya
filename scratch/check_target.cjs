require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query('SELECT * FROM drm.target_system_user_targets LIMIT 1')
  .then(res => console.log(JSON.stringify(res.rows[0])))
  .catch(err => console.error(err))
  .finally(() => pool.end());
