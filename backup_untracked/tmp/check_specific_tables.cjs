
const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    const tables = ['gm_pool_entries', 'gm_entries', 'customers', 'temp_contacts'];
    try {
        for (const table of tables) {
            console.log(`\n--- ${table} ---`);
            const res = await pool.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_schema = 'drm' AND table_name = $1
                ORDER BY ordinal_position
            `, [table]);
            for (const row of res.rows) {
                console.log(`  ${row.column_name} (${row.data_type})`);
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

main();
