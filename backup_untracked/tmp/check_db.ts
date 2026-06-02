import { pool } from '../server/db';
async function run() {
    const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'projects'");
    console.log(res.rows);
}
run().finally(() => process.exit(0));
