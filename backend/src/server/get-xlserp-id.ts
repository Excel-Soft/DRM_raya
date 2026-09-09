import { pool } from "./db.js";

async function run() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT id, name FROM drm.service_subservices 
      WHERE name = 'Xlserp - Free Website'
    `);
    console.log(res.rows);
  } finally {
    client.release();
    process.exit(0);
  }
}
run();
