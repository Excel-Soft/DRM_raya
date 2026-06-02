import pg from "pg";
import "dotenv/config";
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const client = await pool.connect();
await client.query("SET search_path TO drm, public");

console.log("--- Most Recent Customers ---");
const res = await client.query(`
    SELECT 
        c.id, 
        c.company_name, 
        c.owner_user_id, 
        c.created_by, 
        c.created_at,
        u.email as owner_email,
        u.role_id as owner_role
    FROM customers c 
    LEFT JOIN users u ON u.id = c.owner_user_id
    ORDER BY c.created_at DESC
    LIMIT 5
`);
console.table(res.rows);

client.release();
await pool.end();
