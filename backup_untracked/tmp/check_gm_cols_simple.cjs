
const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        const gmPoolData = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'drm' AND table_name = 'gm_pool_entries'
        `);
        console.log("GM_POOL_ENTRIES_COLS:" + gmPoolData.rows.map(r => r.column_name).join(","));

        const gmData = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'drm' AND table_name = 'gm_entries'
        `);
        console.log("GM_ENTRIES_COLS:" + gmData.rows.map(r => r.column_name).join(","));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

main();
