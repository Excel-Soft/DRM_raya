
const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        const res = await pool.query(`
            SELECT table_name, column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'drm'
            ORDER BY table_name, ordinal_position
        `);
        
        let currentTable = "";
        for (const row of res.rows) {
            if (row.table_name !== currentTable) {
                console.log(`\n--- ${row.table_name} ---`);
                currentTable = row.table_name;
            }
            console.log(`  ${row.column_name} (${row.data_type})`);
        }

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

main();
