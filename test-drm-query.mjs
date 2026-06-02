import pg from "pg";
import "dotenv/config";
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
    const client = await pool.connect();
    try {
        await client.query("SET search_path TO drm, public");
        const query = `
            select t.drm_id from temp_contacts t limit 1
        `;
        const res = await client.query(query);
        console.log("Success:", res.rows);
    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        client.release();
        await pool.end();
    }
}
run();
