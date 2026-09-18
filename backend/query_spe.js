import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/drm_raya' });
async function run() {
  try {
    const res = await pool.query(`
      SELECT spe.id, c.company_name, spe.service_code, spe.subservice_code, spe.status
      FROM drm.service_pool_entries spe
      JOIN drm.customers c ON c.id = spe.customer_id
      WHERE c.company_name ILIKE '%Webxl%'
    `);
    console.log(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}
run();
