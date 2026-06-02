
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function findUser() {
  try {
    const res = await pool.query("SELECT * FROM drm.users WHERE full_name = 'umer' OR name = 'umer' OR email = 'umer@excelstech.com' OR username = 'umer@excelstech.com'");
    console.log("Users found:", JSON.stringify(res.rows, null, 2));
    
    const res2 = await pool.query("SELECT * FROM drm.users WHERE email = 'umer@excelstech.com'");
    console.log("DRM schema:", JSON.stringify(res2.rows, null, 2));
  } catch (err) {
    console.error(err.message);
  } finally {
    await pool.end();
  }
}

findUser();
