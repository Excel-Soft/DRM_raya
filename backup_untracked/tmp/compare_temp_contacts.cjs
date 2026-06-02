
const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        console.log("--- public.temp_contacts ---");
        const res = await pool.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'temp_contacts'
        `);
        console.log(res.rows.map(r => r.column_name).join(","));

        console.log("--- drm.temp_contacts ---");
        const res2 = await pool.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_schema = 'drm' AND table_name = 'temp_contacts'
        `);
        console.log(res2.rows.map(r => r.column_name).join(","));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

main();
