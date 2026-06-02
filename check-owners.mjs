import pg from "pg";
import "dotenv/config";
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const client = await pool.connect();
await client.query("SET search_path TO drm, public");

console.log("--- Customers and Owners ---");
const res = await client.query(`
    SELECT 
        c.id, 
        c.company_name, 
        c.owner_user_id, 
        c.created_by, 
        op.owner_id as op_owner_id 
    FROM customers c 
    LEFT JOIN opportunities op ON op.customer_id = c.id
`);
console.table(res.rows);

client.release();
await pool.end();
