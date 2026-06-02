import { pool } from "../server/db";

async function run() {
    try {
        const res = await pool.query('SELECT * FROM temp_contacts');
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    }
    process.exit();
}
run();
