import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function check() {
  try {
    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'drm'
    `);
    console.log('Tables in DRM schema:', res.rows.map(r => r.table_name).join(', '));
  } catch (err) {
    console.error('Check failed', err);
  } finally {
    await pool.end();
  }
}

check();
