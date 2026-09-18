import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/drm_raya' });
async function run() {
  const res = await pool.query(`SELECT COUNT(*) FROM drm.service_pool_entries`);
  console.log(res.rows);
  process.exit();
}
run();
