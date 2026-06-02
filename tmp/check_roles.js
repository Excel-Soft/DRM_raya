
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
    console.log("Checking Roles Table...");
    const rolesRes = await pool.query("SELECT name FROM drm.roles");
    console.log("Roles:", rolesRes.rows.map(r => r.name));

    console.log("\nChecking Job Designation Attributes...");
    const attrRes = await pool.query("SELECT name FROM drm.attributes WHERE category = 'Job Designation'");
    console.log("Job Designations:", attrRes.rows.map(r => r.name));
    
    process.exit(0);
}

main();
