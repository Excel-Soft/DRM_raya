import { config } from 'dotenv';
config();
import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT * FROM follow_ups LIMIT 1', (e, r) => {
  console.log(e ? e.message : 'follow_ups exists');
  pool.end();
});