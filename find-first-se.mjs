import pg from "pg";
import "dotenv/config";
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const client = await pool.connect();
await client.query("SET search_path TO drm, public");

console.log("--- First Sales Executive ---");
const res = await client.query(`
    SELECT id, email FROM users WHERE role_id = 'sales_executive' AND is_active = true LIMIT 1
`);
console.table(res.rows);

client.release();
await pool.end();
