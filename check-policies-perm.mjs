import pg from "pg";
import "dotenv/config";
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const client = await pool.connect();
await client.query("SET search_path TO drm, public");

console.log("--- Checking for 'Policies' in menu_permissions ---");
const res = await client.query("SELECT * FROM menu_permissions WHERE name ILIKE 'Policies%'");
console.table(res.rows);

client.release();
await pool.end();
