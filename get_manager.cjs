require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query("SELECT email FROM users WHERE role_id = (SELECT id FROM roles WHERE name = 'lead_manager') LIMIT 1").then(res => { console.log(res.rows); process.exit(0); });
