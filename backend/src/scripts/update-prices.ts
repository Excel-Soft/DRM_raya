import { pool } from "../db";

async function run() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    await client.query(`
      UPDATE drm.service_subservices 
      SET price = 4999 
      WHERE name IN ('EBay Store Design', 'Amazon Store Design') AND is_active = true
    `);
    
    await client.query("COMMIT");
    console.log("Prices updated successfully.");
  } catch(e) {
    await client.query("ROLLBACK");
    console.error(e);
  } finally {
    client.release();
    process.exit(0);
  }
}
run();
