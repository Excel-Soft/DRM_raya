import { pool } from "../db";

async function run() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT name, price FROM drm.service_subservices 
      WHERE name IN ('Alibaba Membership Premium Plan', 'EBay Store Design', 'Amazon Store Design')
    `);
    console.log(res.rows);
  } finally {
    client.release();
    process.exit(0);
  }
}
run();
