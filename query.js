import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const res = await pool.query("SELECT id, name, route_departments FROM drm.service_subservices WHERE name = 'Dynamic Website'");
  console.log('Subservices:', res.rows);
  const res2 = await pool.query("SELECT id, name, route_departments FROM drm.services WHERE name = 'Dynamic Website'");
  console.log('Services:', res2.rows);
  pool.end();
}
run();
