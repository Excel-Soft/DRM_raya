import pg from "pg";
import "dotenv/config";
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const client = await pool.connect();
console.log("--- temp_contacts column names ---");
const res = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'drm' AND table_name = 'temp_contacts'");
console.log(res.rows.map(r => r.column_name).join(", "));

client.release();
await pool.end();
