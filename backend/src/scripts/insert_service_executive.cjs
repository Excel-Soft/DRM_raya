require('dotenv').config();
const pg = require('pg');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    // Check if role exists
    const checkUser = await pool.query("SELECT * FROM drm.roles WHERE name = 'service_executive'");
    if (checkUser.rows.length === 0) {
      await pool.query("INSERT INTO drm.roles (name, description) VALUES ('service_executive', 'Service Executive')");
      console.log("Successfully inserted service_executive into drm.roles table");
      
      // I should also ensure product_posting_executive is in there! The screenshot didn't have it.
      const checkProductPostingExec = await pool.query("SELECT * FROM drm.roles WHERE name = 'product_posting_executive'");
      if (checkProductPostingExec.rows.length === 0) {
         await pool.query("INSERT INTO drm.roles (name, description) VALUES ('product_posting_executive', 'Product Posting Executive')");
         console.log("Successfully inserted product_posting_executive into drm.roles table");
      }
    } else {
      console.log("Role already exists!");
    }
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

run();
