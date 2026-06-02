const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/postgres" });

async function run() {
  const res = await pool.query("SELECT distinct name, code from drm.services");
  console.log(res.rows);
  pool.end();
}

run();
