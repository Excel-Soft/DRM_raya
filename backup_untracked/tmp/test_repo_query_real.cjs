
const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    const client = await pool.connect();
    try {
        console.log("Setting search_path to drm, public...");
        await client.query("SET search_path TO drm, public");
        
        console.log("Testing query: select drm_id from temp_contacts limit 1");
        const res = await client.query("select drm_id from temp_contacts limit 1");
        console.log("Success! drm_id exists.");
        
        console.log("Testing union query similar to repository...");
        const unionRes = await client.query(`
            select drm_id from customers c limit 1
            union all
            select drm_id from temp_contacts t limit 1
        `);
        console.log("Union Success! found", unionRes.rows.length, "rows");
    } catch (err) {
        console.error("FAILED:", err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
