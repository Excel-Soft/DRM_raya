import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/drm_raya' });
async function run() {
  const res = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='drm' AND table_name='customers'`);
  console.log(res.rows.map(r => r.column_name));
  process.exit();
}
run();
