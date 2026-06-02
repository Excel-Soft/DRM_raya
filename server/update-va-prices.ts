import { pool } from "./db.js";

async function run() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    await client.query(`
      UPDATE drm.service_subservices 
      SET price = 0 
      WHERE name IN ('AliBaba VA with RFQs', 'AliBaba VA without RFQs') AND is_active = true
    `);
    
    await client.query("COMMIT");
    console.log("VA Prices updated successfully to 0.");
  } catch(e) {
    await client.query("ROLLBACK");
    console.error(e);
  } finally {
    client.release();
    process.exit(0);
  }
}
run();
