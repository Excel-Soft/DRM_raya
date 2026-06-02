import { pool } from "../server/db";

async function run() {
    try {
        const res = await pool.query(`
      SELECT table_schema, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'temp_contacts'
    `);
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    }
    process.exit();
}
run();
