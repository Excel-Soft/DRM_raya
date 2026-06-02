
const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        console.log("Checking for temp_contacts in all schemas...");
        const res = await pool.query(`
            SELECT table_schema, table_name 
            FROM information_schema.tables 
            WHERE table_name = 'temp_contacts'
        `);
        console.log("Found:", res.rows);

        for (const row of res.rows) {
            console.log(`\nColumns in ${row.table_schema}.${row.table_name}:`);
            const cols = await pool.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_schema = $1 AND table_name = $2
            `, [row.table_schema, row.table_name]);
            console.log(cols.rows.map(c => c.column_name).join(", "));
        }
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

main();
