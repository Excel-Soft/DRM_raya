import pg from "pg";
import "dotenv/config";
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const client = await pool.connect();
await client.query("SET search_path TO drm, public");

console.log("--- opportunities columns ---");
const oppCols = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'drm' AND table_name = 'opportunities'");
console.table(oppCols.rows);

console.log("--- customers columns ---");
const custCols = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'drm' AND table_name = 'customers'");
console.table(custCols.rows);

client.release();
await pool.end();
