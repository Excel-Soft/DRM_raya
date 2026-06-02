
const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        const res = await pool.query(`
            SELECT table_schema, table_name 
            FROM information_schema.tables 
            WHERE table_name = 'temp_contacts'
        `);
        console.table(res.rows);

        for (const row of res.rows) {
            console.log(`--- Columns for ${row.table_schema}.${row.table_name} ---`);
            const colRes = await pool.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'temp_contacts' AND table_schema = $1
            `, [row.table_schema]);
            console.table(colRes.rows);
        }

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

main();
