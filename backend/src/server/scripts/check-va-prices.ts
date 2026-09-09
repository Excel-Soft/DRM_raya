import { pool } from "../db";

async function run() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT name, price FROM drm.service_subservices 
      WHERE name IN ('Alibaba VA', 'AliBaba VA with RFQs', 'AliBaba VA without RFQs')
    `);
    console.log(res.rows);
  } finally {
    client.release();
    process.exit(0);
  }
}
run();
