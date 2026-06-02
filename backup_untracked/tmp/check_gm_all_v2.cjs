
const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        console.log("--- GM Pool Entries (drm.gm_pool_entries) ---");
        const res = await pool.query(`SELECT id, member_id, order_id, status, hod_approved FROM drm.gm_pool_entries`);
        console.table(res.rows);

        console.log("--- GM Entries (drm.gm_entries) ---");
        const res2 = await pool.query(`SELECT id, gm_type, company_name, status, approved_at FROM drm.gm_entries`);
        console.table(res2.rows);

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

main();
