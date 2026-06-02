
const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        console.log("--- GM Entries (drm.gm_entries) ---");
        const res = await pool.query(`SELECT id, gm_type, company_name, status, hod_approved, accountant_verified FROM drm.gm_entries`);
        console.table(res.rows);

        console.log("--- Account Manager dashboard view (conceptual) ---");
        // This query might simulate what the frontend sees or the repository method returns
        const res2 = await pool.query(`SELECT status, count(*) FROM drm.gm_entries GROUP BY status`);
        console.table(res2.rows);

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

main();
