import { pool } from '../db.js';

async function cleanupSalesTables() {
  const client = await pool.connect();
  try {
    console.log("Starting cleanup of dynamic sales tables...");

    // 1. Drop trigger
    console.log("Dropping trigger trg_fanout_customers_to_sales...");
    await client.query(`DROP TRIGGER IF EXISTS trg_fanout_customers_to_sales ON drm.customers;`);

    // 2. Drop function
    console.log("Dropping function fanout_sales_executives()...");
    await client.query(`DROP FUNCTION IF EXISTS drm.fanout_sales_executives();`);

    // 3. Find and drop all sales_ tables
    console.log("Searching for sales_* tables...");
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'drm' 
      AND table_name LIKE 'sales_%';
    `);

    const tables = result.rows.map(r => r.table_name);
    console.log(`Found ${tables.length} dynamic sales tables to drop.`);

    for (const tableName of tables) {
      console.log(`Dropping table drm.${tableName}...`);
      await client.query(`DROP TABLE IF EXISTS drm."${tableName}" CASCADE;`);
    }

    console.log("✅ Cleanup complete!");
  } catch (error) {
    console.error("❌ Cleanup failed:", error);
  } finally {
    client.release();
  }
}

cleanupSalesTables().then(() => process.exit(0));
