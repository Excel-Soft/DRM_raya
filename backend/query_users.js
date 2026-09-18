import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/drm_raya' });
async function run() {
  const res = await pool.query(`SELECT id, role, role_id, name FROM drm.users WHERE role ILIKE '%service%' AND role ILIKE '%exec%' LIMIT 10`);
  console.log(res.rows);
  process.exit();
}
run();
