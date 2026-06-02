import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function check() {
  try {
    const res = await pool.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'drm'");
    console.log('DRM schema exists:', res.rows.length > 0);
    if (res.rows.length === 0) {
      console.log('Creating DRM schema...');
      await pool.query("CREATE SCHEMA IF NOT EXISTS drm");
      console.log('DRM schema created.');
    }
  } catch (err) {
    console.error('Check failed', err);
  } finally {
    await pool.end();
  }
}

check();
