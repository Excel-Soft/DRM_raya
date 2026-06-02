import { pool } from "../server/db";

async function run() {
    const res = await pool.query("select * from drm.attributes where category = 'Job Designation'");
    console.table(res.rows);
    process.exit(0);
}
run();
